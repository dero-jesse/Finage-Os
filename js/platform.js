/**
 * Finage OS Platform — Multi-Organisation Context Manager
 * Manages platform superuser session, org registry, and org switching.
 * All org data lives in Supabase `public.organizations` + per-schema tables.
 */

const Platform = {
  context: {
    isPlatformSuperuser: false,
    platformUser: null,
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
      const { data: authData, error: authError } = await window.supabase.auth.getUser();
      const authUser = authData && authData.user;
      if (authError || !authUser) {
        this.context.isPlatformSuperuser = false;
        this.context.platformUser = null;
        this.context.organizations = [];
        this.context.currentOrgId = null;
        this.context.currentOrgSchema = null;
        this.context.currentOrg = null;
        return;
      }

      // Verify the active platform identity against this authenticated user.
      const { data: spData } = await window.supabase
        .from('platform_superusers')
        .select('id, name, email, is_active')
        .eq('id', authUser.id)
        .eq('is_active', true)
        .limit(1);
      this.context.isPlatformSuperuser = !!(spData && spData.some(user => user.id === authUser.id && user.is_active));
      this.context.platformUser = this.context.isPlatformSuperuser ? spData[0] : null;

      // Platform admins see the registry; tenant users only see linked memberships.
      const orgQuery = this.context.isPlatformSuperuser
        ? window.supabase.from('organizations').select('*').order('name')
        : window.supabase.rpc('my_tenant_organizations');
      const { data: orgs, error: orgsErr } = await orgQuery;
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
      if (typeof store.prepareTenantState === 'function') {
        store.prepareTenantState(org.schema_name);
      }
      store.state.institution.name = org.name;
      store.state.institution.type = org.type;
      store.state.institution.baseCurrency = org.base_currency || 'UGX';
      store.state.institution.financialYear = org.financial_year || '2026';
      store.state.institution.regulatoryBody = org.regulatory_body || '';
      store.state.institution.orgId = org.id;
      store.state.institution.schemaName = org.schema_name;
      store.state.institution.setupCompleted = org.setup_completed !== false;
    }
    console.log('[Platform] Active org: ' + org.name + ' (schema: ' + org.schema_name + ')');
    return true;
  },

  // Provision a new organization — superuser only
  async provisionOrg(formData) {
    if (!window.supabase) throw new Error('Supabase not available');
    if (!this.context.isPlatformSuperuser) throw new Error('Platform superuser access required');
    const { data: result, error } = await window.supabase.functions.invoke('provision-organization', {
      body: { organization: formData }
    });
    if (error) {
      let detail = error.message || 'Edge Function request failed.';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const responseBody = await error.context.json();
          detail = responseBody.error || responseBody.message || detail;
        } catch (_) {}
      }
      throw new Error('Organization provisioning failed: ' + detail);
    }
    if (!result?.success) throw new Error(result?.error || 'Organization provisioning did not complete.');

    await this.init();
    if (!this.context.organizations.some(org => org.id === formData.id)) {
      throw new Error('Organization was provisioned but could not be loaded into the platform registry.');
    }
    this.setActiveOrg(formData.id);
    if (window.store?.state) {
      const state = window.store.state;
      state.branches = formData.branches || [];
      state.members = formData.members || [];
      state.generalLedger = formData.glAccounts || [];
      state.transactions = formData.transactions || [];
      state.recentTransactions = formData.transactions || [];
      window.store.saveLocal();
    }

    return {
      success: true,
      schemaName: result.schemaName || this.context.currentOrgSchema,
      invitations: result.invitations || []
    };
  },

  async correctOwnerEmail(orgId, email) {
    if (!window.supabase) throw new Error('Supabase not available');
    if (!this.context.isPlatformSuperuser) throw new Error('Platform superuser access required');
    const { data, error } = await window.supabase.functions.invoke('provision-organization', {
      body: { action: 'correct-owner-email', orgId, email }
    });
    if (error) {
      let detail = error.message || 'Owner email update failed.';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const responseBody = await error.context.json();
          detail = responseBody.error || responseBody.message || detail;
        } catch (_) {}
      }
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || 'Owner email update did not complete.');
    await this.init();
    return data;
  },

  async createTenantUser(userData) {
    if (!window.supabase) throw new Error('Supabase not available');
    if (!this.context.currentOrgId) throw new Error('Select an organization before adding a user.');
    const { data, error } = await window.supabase.functions.invoke('provision-organization', {
      body: { ...userData, action: 'create-tenant-user', orgId: this.context.currentOrgId }
    });
    if (error) {
      let detail = error.message || 'User setup request failed.';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const responseBody = await error.context.json();
          detail = responseBody.error || responseBody.message || detail;
        } catch (_) {}
      }
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || 'User setup did not complete.');
    return data;
  },

  async applyTenantSetup(organization, importData, setupCompleted = true) {
    if (!window.supabase || !this.context.currentOrgSchema || !this.context.currentOrgId) {
      throw new Error('Select an organization and connect to Supabase before saving setup.');
    }

    const payload = {
      ...organization,
      branches: importData.branches || [],
      glAccounts: importData.glAccounts || [],
      members: importData.members || [],
      transactions: importData.transactions || [],
      openingBalances: importData.openingBalances || [],
      migrationBatchId: importData.migrationBatchId || null,
      migrationSourceFiles: importData.migrationSourceFiles || importData.sourceFiles || [],
      migrationRowCounts: importData.migrationRowCounts || {},
      migrationControlTotals: importData.migrationControlTotals || {},
      migrationRecords: importData.migrationRecords || []
    };
    const { data: updatedOrg, error } = await window.supabase.rpc('apply_tenant_setup', {
      p_org_id: this.context.currentOrgId,
      p_org_data: payload,
      p_setup_completed: setupCompleted
    });
    if (error) throw new Error(`Could not save organization setup: ${error.message}`);
    if (!updatedOrg) throw new Error('Organization setup was not saved.');

    this.context.currentOrg = updatedOrg;
    this.context.organizations = this.context.organizations.map(org =>
      org.id === updatedOrg.id ? updatedOrg : org
    );

    const state = window.store?.state;
    if (state) {
      state.institution.name = updatedOrg.name;
      state.institution.type = updatedOrg.type;
      state.institution.baseCurrency = updatedOrg.base_currency || 'UGX';
      state.institution.financialYear = updatedOrg.financial_year || '2026';
      state.institution.regulatoryBody = updatedOrg.regulatory_body || '';
      state.institution.regulatoryMinLiquidityRatio = Number(updatedOrg.min_liquidity_ratio) || 15;
      state.institution.setupCompleted = updatedOrg.setup_completed !== false;
      state.branches = importData.branches || state.branches;
      state.members = importData.members || state.members;
      state.transactions = importData.transactions || state.transactions;
      state.recentTransactions = importData.transactions || state.recentTransactions;
      state.generalLedger = importData.glAccounts || state.generalLedger;
      window.store.saveLocal();
    }
    return updatedOrg;
  },

  getOrganizations() { return this.context.organizations; },
  getActiveOrg()     { return this.context.currentOrg; },
  isSuperuser()      { return this.context.isPlatformSuperuser; }
};

window.Platform = Platform;
