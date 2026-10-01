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

  getOrganizations() { return this.context.organizations; },
  getActiveOrg()     { return this.context.currentOrg; },
  isSuperuser()      { return this.context.isPlatformSuperuser; }
};

window.Platform = Platform;
