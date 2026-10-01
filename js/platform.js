/**
 * Finage OS Platform — Multi-Organisation Context Manager
 * Manages platform superuser session, org registry, and org switching.
 * All org data lives in Supabase `public.organizations` + per-schema tables.
 */

const Platform = {
  context: {
    isPlatformSuperuser: false,
    currentOrgId: null,
    currentOrgSchema: null,
    currentOrg: null,
    organizations: [],
    loadedFromRemote: false,
  },

  // Bootstrap — called after Supabase auth session is restored
  async init() {
    if (!window.supabase) return;
    try {
      // 1. Check if caller is a platform superuser
      const { data: spData } = await window.supabase
        .from('platform_superusers')
        .select('id, name, email, is_active')
        .limit(1);
      this.context.isPlatformSuperuser = !!(spData && spData.length > 0);

      // 2. Load organizations list
      const { data: orgs, error: orgsErr } = await window.supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (!orgsErr && orgs) {
        this.context.organizations = orgs;
        this.context.loadedFromRemote = true;
      }

      // 3. Restore last selected org from localStorage
      const savedOrgId = localStorage.getItem('finage_active_org_id');
      if (savedOrgId) {
        const org = this.context.organizations.find(o => o.id === savedOrgId);
        if (org && org.status === 'active') this.setActiveOrg(org.id);
      }

      // 4. If only one active org, auto-select it
      const activeOrgs = this.context.organizations.filter(o => o.status === 'active');
      if (activeOrgs.length === 1 && !this.context.currentOrgId) {
        this.setActiveOrg(activeOrgs[0].id);
      }
    } catch (e) {
      console.warn('[Platform] init error:', e.message);
    }
  },

  setActiveOrg(orgId) {
    const org = this.context.organizations.find(o => o.id === orgId);
    if (!org) return false;
    this.context.currentOrgId = org.id;
    this.context.currentOrgSchema = org.schema_name;
    this.context.currentOrg = org;
    localStorage.setItem('finage_active_org_id', org.id);
    if (window.store) {
      store.state.institution.name = org.name;
      store.state.institution.type = org.type;
      store.state.institution.baseCurrency = org.base_currency || 'UGX';
      store.state.institution.financialYear = org.financial_year || '2026';
      store.state.institution.regulatoryBody = org.regulatory_body || '';
      store.state.institution.orgId = org.id;
      store.state.institution.schemaName = org.schema_name;
    }
    console.log('[Platform] Active org: ' + org.name + ' (schema: ' + org.schema_name + ')');
    return true;
  },

  // Provision a new organization — superuser only
  async provisionOrg(formData) {
    if (!window.supabase) throw new Error('Supabase not available');
    if (!this.context.isPlatformSuperuser) throw new Error('Platform superuser access required');

    const { id, name, type, regNumber, country, baseCurrency,
      financialYear, regulatoryBody, minLiquidityRatio, superuserEmail,
      branches = [], roles = [], glAccounts = [], staffUsers = [] } = formData;

    // 1. Insert org record
    const userRes = await window.supabase.auth.getUser();
    const { error: orgErr } = await window.supabase.from('organizations').insert({
      id, name, type,
      reg_number: regNumber,
      country,
      base_currency: baseCurrency,
      financial_year: financialYear,
      regulatory_body: regulatoryBody,
      min_liquidity_ratio: minLiquidityRatio || 15.0,
      superuser_email: superuserEmail,
      status: 'pending_setup',
      created_by: userRes.data?.user?.id || null
    });
    if (orgErr) throw new Error('Failed to create org: ' + orgErr.message);

    // 2. Provision schema via stored function
    const { error: provErr } = await window.supabase.rpc('provision_org_schema', { p_org_id: id });
    if (provErr) throw new Error('Schema provision failed: ' + provErr.message);

    // 3. Get schema_name
    const { data: updatedOrg } = await window.supabase
      .from('organizations').select('*').eq('id', id).single();
    const schemaName = updatedOrg && updatedOrg.schema_name;
    if (!schemaName) throw new Error('Schema name not returned after provisioning');

    // 4. Seed roles
    if (roles.length > 0) {
      const { error: rolesErr } = await window.supabase.schema(schemaName).from('roles').insert(roles);
      if (rolesErr) console.warn('[Platform] Roles seed error:', rolesErr.message);
    }
    // 5. Seed branches
    if (branches.length > 0) {
      const { error: brErr } = await window.supabase.schema(schemaName).from('branches').insert(branches);
      if (brErr) console.warn('[Platform] Branches seed error:', brErr.message);
    }
    // 6. Seed GL accounts
    if (glAccounts.length > 0) {
      const { error: glErr } = await window.supabase.schema(schemaName).from('general_ledger').insert(glAccounts);
      if (glErr) console.warn('[Platform] GL seed error:', glErr.message);
    }
    // 7. Seed staff users
    if (staffUsers.length > 0) {
      const { error: usrErr } = await window.supabase.schema(schemaName).from('users').insert(staffUsers);
      if (usrErr) console.warn('[Platform] Users seed error:', usrErr.message);
    }

    // 8. Mark org active
    await window.supabase.from('organizations')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', id);

    // 9. Generate SQL artifact
    const sqlContent = this.generateOrgSql(formData, schemaName);

    // 10. Reload orgs
    await this.init();
    this.setActiveOrg(id);

    return { success: true, schemaName, sqlContent };
  },

  // Generate a dedicated SQL seed file for the new org (downloadable)
  generateOrgSql(formData, schemaName) {
    const { id, name, type, regNumber = '', country, baseCurrency,
      financialYear, regulatoryBody = '', minLiquidityRatio = 15.0, superuserEmail,
      branches = [], roles = [], glAccounts = [], staffUsers = [] } = formData;

    const now = new Date().toISOString();

    const escape = s => String(s || '').replace(/'/g, "''");

    const roleSql = roles.map(r =>
      "  ('" + r.id + "', '" + escape(r.name) + "', '" + r.category + "', '" + escape(JSON.stringify(r.permissions)) + "')"
    ).join(',\n');

    const branchSql = branches.map(b =>
      "  ('" + b.id + "', '" + escape(b.name) + "', '" + b.code + "', " +
      (b.tellerCount || 0) + ', ' + (b.vaultLimit || 0) + ", 0, " +
      (b.tellerCashLimit || 0) + ", '[]', '', 0, 'Active')"
    ).join(',\n');

    const glSql = glAccounts.map(g =>
      "  ('" + g.code + "', '" + escape(g.name) + "', '" + g.category + "', '" +
      (g.type || '') + "', '" + g.normal + "', 0, " + (g.isContra ? 'true' : 'false') + ')'
    ).join(',\n');

    const userSql = staffUsers.map(u =>
      "  ('" + u.id + "', '" + escape(u.name) + "', '" + escape(u.email) + "', '" +
      escape(JSON.stringify(u.roles || [])) + "', '" + (u.branchId || '') + "', '" +
      escape(u.branchName || '') + "', " + (u.singleApprovalLimit || 0) + ', ' +
      (u.dailyApprovalLimit || 0) + ", 'Active', true)"
    ).join(',\n');

    const lines = [];
    lines.push('-- ============================================================');
    lines.push('-- FINAGE OS — ' + name.toUpperCase() + ' ORGANISATION SCHEMA SEED');
    lines.push('-- Generated: ' + now);
    lines.push('-- Org ID: ' + id);
    lines.push('-- Schema: ' + schemaName);
    lines.push('-- Run AFTER platform_schema.sql is applied.');
    lines.push('-- ============================================================');
    lines.push('');
    lines.push('INSERT INTO public.organizations (');
    lines.push('  id, name, type, reg_number, country, base_currency,');
    lines.push('  financial_year, regulatory_body, min_liquidity_ratio,');
    lines.push('  superuser_email, status, schema_name, activated_at');
    lines.push(') VALUES (');
    lines.push("  '" + id + "', '" + escape(name) + "', '" + type + "', '" + escape(regNumber) + "', '" + country + "',");
    lines.push("  '" + baseCurrency + "', '" + financialYear + "', '" + escape(regulatoryBody) + "',");
    lines.push("  " + minLiquidityRatio + ", '" + escape(superuserEmail) + "', 'active', '" + schemaName + "', NOW()");
    lines.push(') ON CONFLICT (id) DO UPDATE SET status = \'active\', activated_at = NOW();');
    lines.push('');
    lines.push("SELECT public.provision_org_schema('" + id + "');");
    lines.push('');

    if (roles.length > 0) {
      lines.push('-- Roles');
      lines.push('INSERT INTO ' + schemaName + '.roles (id, name, category, permissions) VALUES');
      lines.push(roleSql);
      lines.push('ON CONFLICT (id) DO NOTHING;');
      lines.push('');
    }

    if (branches.length > 0) {
      lines.push('-- Branches');
      lines.push('INSERT INTO ' + schemaName + '.branches (');
      lines.push('  id, name, code, "tellerCount", "vaultLimit", "cashInVault",');
      lines.push('  "tellerCashLimit", "tillBalances", "lastReconciledAt",');
      lines.push('  "reconciliationDiscrepancy", status');
      lines.push(') VALUES');
      lines.push(branchSql);
      lines.push('ON CONFLICT (id) DO NOTHING;');
      lines.push('');
    }

    if (glAccounts.length > 0) {
      lines.push('-- General Ledger (Chart of Accounts)');
      lines.push('INSERT INTO ' + schemaName + '.general_ledger (code, name, category, type, normal, balance, "isContra") VALUES');
      lines.push(glSql);
      lines.push('ON CONFLICT (code) DO NOTHING;');
      lines.push('');
    }

    if (staffUsers.length > 0) {
      lines.push('-- Staff Users');
      lines.push('INSERT INTO ' + schemaName + '.users (');
      lines.push('  id, name, email, roles, "branchId", "branchName",');
      lines.push('  "singleApprovalLimit", "dailyApprovalLimit", status, "mfaEnabled"');
      lines.push(') VALUES');
      lines.push(userSql);
      lines.push('ON CONFLICT (id) DO NOTHING;');
      lines.push('');
    }

    lines.push("SELECT 'Org Seeded' AS result, '" + escape(name) + "' AS org_name, '" + schemaName + "' AS schema;");

    return lines.join('\n');
  },

  getOrganizations() { return this.context.organizations; },
  getActiveOrg()     { return this.context.currentOrg; },
  isSuperuser()      { return this.context.isPlatformSuperuser; }
};

window.Platform = Platform;
