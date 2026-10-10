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
    legacySelectedOrgId: null,
    authTenantOrgIds: [],
    organizations: [],
    loadedFromRemote: false,
    operationalStatus: 'loading',
    operationalError: null,
    operationalWarnings: [],
    operationalCounts: null,
    writeCapabilities: {
      member_create: false,
      counter_post: false,
      manual_journal: false,
      credit_application: false,
      credit_admin: false,
      treasury_drawdown: false,
      treasury_invest: false,
      opex_manage: false,
      branch_reconcile: false,
      till_reconcile: false,
      portfolio_provision: false,
      user_manage: false
    },

    emptyWriteCapabilities() {
      return {
        member_create: false, counter_post: false, manual_journal: false,
        credit_application: false, credit_admin: false, treasury_drawdown: false,
        credit_release: false, treasury_invest: false, opex_manage: false, branch_reconcile: false,
        till_reconcile: false, portfolio_provision: false, user_manage: false
      };
    },

    async executeDomainAction(action, payload, { idempotencyKey, notify = true } = {}) {
      const capability = {
        create_loan_product: 'credit_admin',
        update_loan_product: 'credit_admin',
        create_loan_application: 'credit_application',
        review_loan_application: 'credit_admin',
        set_loan_pacing: 'credit_admin',
        disburse_loan_application: 'credit_release',
        assess_loan_penalty: 'credit_admin',
        create_external_facility: 'treasury_drawdown',
        draw_external_facility: 'treasury_drawdown',
        create_operating_expense: 'opex_manage',
        reconcile_vault: 'branch_reconcile',
        reconcile_assigned_till: 'till_reconcile',
        create_investment: 'treasury_invest',
        redeem_investment: 'treasury_invest',
        post_portfolio_provision: 'portfolio_provision',
        update_user_roles: 'user_manage',
        update_user_status: 'user_manage'
      }[action];
      const authorized = action === 'disburse_loan_application'
        ? this.context.writeCapabilities.credit_admin === true || this.context.writeCapabilities.credit_release === true
        : this.context.writeCapabilities[capability] === true;
      if (!capability || !authorized) {
        throw new Error(`The ${action} operation is not enabled for this user.`);
      }
      if (!window.supabase || !this.context.currentOrgId) throw new Error('An authenticated online organization is required.');
      const { data, error } = await window.supabase.rpc('execute_tenant_domain_action', {
        p_org_id: this.context.currentOrgId,
        p_action: action,
        p_payload: payload || {},
        p_idempotency_key: idempotencyKey || crypto.randomUUID()
      });
      if (error) throw new Error(`Supabase rejected ${action}: ${error.message}`);
      if (!data || typeof data !== 'object') throw new Error(`Supabase did not confirm ${action}.`);
      let refreshError = null;
      try {
        await this.loadOperationalData({ notify });
      } catch (cause) {
        refreshError = cause;
      }
      return { result: data, refreshError };
    },

    async executeFinancialAction(action, amount, description, { idempotencyKey, memberId = null, loanId = null, referenceId = null, notify = true } = {}) {
      const capability = {
        loan_disbursement: 'credit_release',
        dfi_drawdown: 'treasury_drawdown',
        loan_loss_provision: 'portfolio_provision',
        investment_placement: 'treasury_invest',
        investment_redemption: 'treasury_invest'
      }[action];
      if (!capability || this.context.writeCapabilities[capability] !== true) {
        throw new Error(`The ${action} posting is not enabled for this user.`);
      }
      if (!window.supabase || !this.context.currentOrgId) throw new Error('An authenticated online organization is required.');
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error('Enter a positive transaction amount.');
      const { data, error } = await window.supabase.rpc('execute_tenant_financial_action', {
        p_org_id: this.context.currentOrgId,
        p_action: action,
        p_amount: parsedAmount,
        p_description: description || action,
        p_idempotency_key: idempotencyKey || crypto.randomUUID(),
        p_member_id: memberId,
        p_loan_id: loanId,
        p_reference_id: referenceId
      });
      if (error) throw new Error(`Supabase rejected ${action}: ${error.message}`);
      if (!data?.id) throw new Error(`Supabase did not confirm ${action}.`);
      let refreshError = null;
      try {
        await this.loadOperationalData({ notify });
      } catch (cause) {
        refreshError = cause;
      }
      return { transaction: data, refreshError };
    },
  },

  emptyWriteCapabilities() {
    return {
      member_create: false, counter_post: false, manual_journal: false,
      credit_application: false, credit_admin: false, credit_release: false,
      treasury_drawdown: false, treasury_invest: false, opex_manage: false,
      branch_reconcile: false, till_reconcile: false,
      portfolio_provision: false, user_manage: false
    };
  },

  executeDomainAction(action, payload, options) {
    return this.context.executeDomainAction.call(this, action, payload, options);
  },

  executeFinancialAction(action, amount, description, options) {
    return this.context.executeFinancialAction.call(this, action, amount, description, options);
  },

  hasOperationalAccess() {
    return ['partial', 'read_only', 'ready'].includes(this.context.operationalStatus);
  },

  // Bootstrap the verified Supabase identity, tenant authorization, and remote records.
  async init() {
    const preferredOrgId = localStorage.getItem('finage_active_org_id');
    this.context.currentOrgId = null;
    this.context.currentOrgSchema = null;
    this.context.currentOrg = null;
    this.context.isPlatformSuperuser = false;
    this.context.platformUser = null;
    this.context.authTenantOrgIds = [];
    this.context.organizations = [];
    this.context.loadedFromRemote = false;
    this.context.legacySelectedOrgId = preferredOrgId;
    this.context.operationalStatus = 'loading';
    this.context.operationalError = null;
    this.context.operationalWarnings = [];
    this.context.operationalCounts = null;
    this.context.writeCapabilities = this.emptyWriteCapabilities();
    if (window.store?.prepareTenantState) {
      window.store.prepareTenantState('');
      window.store.state.institution.orgId = null;
      window.store.state.institution.schemaName = null;
    }
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
        this.context.operationalStatus = 'no_org';
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
      } else if (orgsErr) {
        throw new Error(`Could not load organizations: ${orgsErr.message}`);
      }

      // 3. Restore last selected org from localStorage
      const savedOrgId = preferredOrgId;
      if (savedOrgId) {
        const org = this.context.organizations.find(o => o.id === savedOrgId);
        if (org && org.status === 'active') await this.activateOrg(org.id);
      }

      // 4. If only one active org, auto-select it
      const activeOrgs = this.context.organizations.filter(o => o.status === 'active');
      if (activeOrgs.length === 1 && !this.context.currentOrgId) {
        await this.activateOrg(activeOrgs[0].id);
      }
      if (!this.context.isPlatformSuperuser && authUser.email &&
          activeOrgs.length > 1 && !this.context.currentOrgId) {
        const candidates = await Promise.all(activeOrgs
          .filter(org => /^org_[a-z0-9_]+$/.test(org.schema_name || ''))
          .map(async org => {
            const { data, error } = await window.supabase.schema(org.schema_name)
              .from('users').select('id').ilike('email', authUser.email).maybeSingle();
            if (error) return null;
            return data?.id ? org.id : null;
          }));
        this.context.authTenantOrgIds = candidates.filter(Boolean);
        if (this.context.authTenantOrgIds.length) {
          await this.activateOrg(this.context.authTenantOrgIds[0]);
          if (this.context.authTenantOrgIds.length > 1 && window.store?.state) {
            window.store.state.orgSelectorShown = true;
          }
        }
      }
      if (!this.context.currentOrgId && activeOrgs.length === 0) {
        this.context.operationalStatus = 'no_org';
      }
    } catch (e) {
      this.context.operationalStatus = 'error';
      this.context.operationalError = e.message;
      console.warn('[Platform] init error:', e.message);
    }
  },

  setActiveOrg(orgId) {
    const org = this.context.organizations.find(o => o.id === orgId);
    if (!org) return false;
    this.context.currentOrgId = org.id;
    this.context.currentOrgSchema = org.schema_name;
    this.context.currentOrg = org;
    if (this.context.legacySelectedOrgId === null) {
      this.context.legacySelectedOrgId = localStorage.getItem('finage_active_org_id');
    }
    localStorage.setItem('finage_active_org_id', org.id);
    this.context.operationalStatus = 'loading';
    this.context.operationalError = null;
    this.context.operationalCounts = null;
    this.context.writeCapabilities = this.emptyWriteCapabilities();
    if (window.store) {
      if (typeof store.prepareTenantState === 'function') store.prepareTenantState(org.schema_name);
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

  async activateOrg(orgId) {
    if (!this.setActiveOrg(orgId)) return false;
    await this.loadOperationalData();
    return true;
  },

  async loadOperationalData({ notify = true } = {}) {
    const schemaName = this.context.currentOrgSchema;
    if (!window.supabase || !schemaName || !/^org_[a-z0-9_]+$/.test(schemaName)) {
      throw new Error('An authenticated tenant schema is required to load operational records.');
    }
    this.context.operationalStatus = 'loading';
    this.context.operationalError = null;
    try {
      const tables = [
        'roles', 'users', 'branches', 'members', 'general_ledger', 'transactions', 'audit_trail',
        'loan_products', 'loan_applications', 'workflow_tasks', 'external_facilities',
        'operating_expenses', 'branch_reconciliations', 'investment_positions'
      ];
      const results = await Promise.all(tables.map(table =>
        window.supabase.schema(schemaName).from(table).select('*')
      ));
      const failed = results.slice(0, 7).find(result => result.error);
      if (failed) throw new Error(failed.error.message || 'Tenant data query failed.');
      if (this.context.currentOrgSchema !== schemaName) return false;

      const rows = results.map(result => result.error ? [] : (result.data || []));
      this.context.operationalWarnings = results.slice(7).flatMap((result, index) =>
        result.error ? [{
          service: tables[index + 7],
          message: result.error.message || 'Tenant service query failed.'
        }] : []
      );
      const [roles, users, branches, members, ledger, transactions, audit,
        loanProductRows, applicationRows, workflowRows, facilityRows, expenseRows,
        reconciliationRows, investmentRows] = rows;
      const loanProducts = loanProductRows.map(row => ({
        id: row.id, name: row.name, annualInterestRate: Number(row.annual_interest_rate) || 0,
        rateConfigured: true, repaymentMethod: row.repayment_method,
        penaltyGraceDays: Number(row.penalty_grace_days) || 0,
        penaltyFixedFee: Number(row.penalty_fixed_fee) || 0,
        penaltyDailyRate: Number(row.penalty_daily_rate) || 0,
        policyVersion: Number(row.policy_version) || 1
      }));
      const workflowTasks = workflowRows.map(row => ({
        id: row.id, type: row.type, entityId: row.entity_id, title: row.title,
        amount: Number(row.amount) || 0, makerUserId: row.maker_user_id,
        approverRole: row.approver_role, makerCheckerStatus: row.status,
        priority: row.priority, history: row.history || [], createdAt: row.created_at
      }));
      const disbursementQueue = applicationRows.map(row => ({
        id: row.id, memberId: row.member_id, clientName: members.find(m => m.id === row.member_id)?.name || '',
        branch: branches.find(branch => branch.id === row.branch_id)?.name || '',
        branchId: row.branch_id, productId: row.product_id,
        product: loanProducts.find(product => product.id === row.product_id)?.name || row.product_id,
        amount: Number(row.amount) || 0, purpose: row.purpose, termMonths: Number(row.term_months) || 0,
        guarantorMemberId: row.guarantor_member_id, appliedDate: row.applied_at,
        annualInterestRate: Number(row.annual_interest_rate) || 0,
        expectedYield: Number(row.annual_interest_rate) || 0,
        repaymentMethod: row.repayment_method, penaltyPolicy: row.penalty_policy || {},
        urgency: row.urgency, status: row.status, staggeredBatch: row.staggered_batch,
        workflowTaskId: row.workflow_task_id, disbursedAt: row.disbursed_at
      }));
      const externalFacilities = facilityRows.map(row => ({
        id: row.id, lender: row.lender, facilityType: row.facility_type,
        totalCommitment: Number(row.total_commitment) || 0,
        drawnAmount: Number(row.drawn_amount) || 0,
        availableToDraw: Math.max(0, (Number(row.total_commitment) || 0) - (Number(row.drawn_amount) || 0)),
        interestRate: Number(row.interest_rate) || 0,
        nextRepaymentDate: row.first_repayment_date,
        nextRepaymentAmount: Number(row.repayment_amount) || 0,
        nextExpectedDrawdownDate: row.expected_drawdown_date,
        nextExpectedDrawdownAmount: Number(row.expected_drawdown_amount) || 0
      }));
      const operatingExpenses = expenseRows.map(row => ({
        id: row.id, category: row.category, monthlyAmount: Number(row.monthly_amount) || 0,
        dueDayOfMonth: Number(row.due_day) || 15
      }));
      const shortTermInvestments = investmentRows.map(row => ({
        id: row.id, institution: row.institution, product: row.product,
        principal: Number(row.principal) || 0, annualYield: Number(row.annual_yield) || 0,
        placementDate: row.placed_at, maturityDate: row.maturity_date, status: row.status
      }));
      Object.assign(window.store.state, {
        roles,
        users,
        branches,
        members,
        generalLedger: ledger,
        transactions,
        recentTransactions: [...transactions]
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
          .slice(0, 100)
          .map(tx => ({
            id: tx.id, type: tx.type, client: tx.memberName || tx.details || tx.type,
            amount: Number(tx.amount) || 0, time: tx.date || '', status: tx.status, channel: tx.channel
          })),
        auditTrail: audit,
        loanProducts,
        disbursementQueue,
        workflowTasks,
        externalFacilities,
        operatingExpenses,
        branchReconciliations: reconciliationRows,
        shortTermInvestments,
        loanPenaltyPolicyVersion: Math.max(1, ...loanProducts.map(item => item.policyVersion || 1))
      });
      this.context.operationalCounts = {
        branches: branches.length, members: members.length, generalLedger: ledger.length,
        transactions: transactions.length, auditTrail: audit.length,
        loanProducts: loanProducts.length, loanApplications: disbursementQueue.length,
        workflows: workflowTasks.length, treasuryFacilities: externalFacilities.length,
        operatingExpenses: operatingExpenses.length, investments: shortTermInvestments.length
      };
      const hasOperationalData = Object.values(this.context.operationalCounts).some(count => count > 0);
      try {
        const { data: capabilities, error: capabilityError } = await window.supabase.rpc('online_write_capabilities', {
          p_org_id: this.context.currentOrgId
        });
        if (capabilityError) throw capabilityError;
        this.context.writeCapabilities = Object.fromEntries(
          Object.keys(this.emptyWriteCapabilities()).map(key => [key, capabilities?.[key] === true])
        );
      } catch (capabilityError) {
        this.context.writeCapabilities = this.emptyWriteCapabilities();
        this.context.operationalError = `Online write migration unavailable or unauthorized: ${capabilityError.message}`;
      }
      const hasEnabledWrites = Object.values(this.context.writeCapabilities).some(Boolean);
      this.context.operationalStatus = hasEnabledWrites
        ? 'partial'
        : (hasOperationalData ? 'read_only' : 'empty');
      if (notify) window.store.notify();
      return true;
    } catch (error) {
      this.context.operationalStatus = 'error';
      this.context.operationalError = error.message;
      throw error;
    }
  },

  async createMember(memberData, { notify = true } = {}) {
    if (!this.context.writeCapabilities.member_create) {
      throw new Error('Member creation is not enabled for this user. Apply online_financial_writes.sql and verify onboarding permission.');
    }
    const { data, error } = await window.supabase.rpc('create_tenant_member', {
      p_org_id: this.context.currentOrgId,
      p_member: {
        name: memberData.name,
        nationalId: memberData.nationalId,
        phone: memberData.phone,
        email: memberData.email || null,
        branchId: memberData.branchId,
        occupation: memberData.occupation || null,
        employer: memberData.employer || null
      }
    });
    if (error) throw new Error(`Member creation was rejected: ${error.message}`);
    if (!data?.id) throw new Error('Supabase did not confirm member creation.');
    let refreshError = null;
    try {
      await this.loadOperationalData({ notify });
    } catch (cause) {
      refreshError = cause;
    }
    return { member: data, refreshError };
  },

  async postFinancialTransaction({ type, memberId = null, loanId = null, amount, channel, description, legs, idempotencyKey, notify = true }) {
    const manualJournal = type === 'Manual GL Journal';
    const allowed = manualJournal
      ? this.context.writeCapabilities.manual_journal
      : this.context.writeCapabilities.counter_post;
    if (!allowed) {
      throw new Error(`${manualJournal ? 'Manual journals' : 'Counter transactions'} are not enabled for this user.`);
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error('Enter a positive transaction amount.');
    if (!Array.isArray(legs) || legs.length !== 2) throw new Error('This online posting requires exactly two legs.');
    const { data, error } = await window.supabase.rpc('post_tenant_financial_transaction', {
      p_org_id: this.context.currentOrgId,
      p_type: type,
      p_member_id: memberId,
      p_loan_id: loanId,
      p_amount: parsedAmount,
      p_channel: channel || 'Branch FOSA',
      p_description: description || type,
      p_legs: legs,
      p_idempotency_key: idempotencyKey || crypto.randomUUID()
    });
    if (error) throw new Error(`Transaction was rejected: ${error.message}`);
    if (!data?.id) throw new Error('Supabase did not confirm the transaction.');
    let refreshError = null;
    try {
      await this.loadOperationalData({ notify });
    } catch (cause) {
      refreshError = cause;
    }
    return { transaction: data, refreshError };
  },

  getLegacyImportPayload() {
    if (!this.context.currentOrgId || !this.context.currentOrgSchema) {
      throw new Error('Select an organization before reviewing browser data.');
    }
    const schemaName = this.context.currentOrgSchema;
    let tenantData = null;
    let legacyStorageKeys = [];
    try {
      const storedOrgId = localStorage.getItem('finage_active_org_id');
      const storedSchema = localStorage.getItem('finage_active_data_schema');
      const previouslySelectedOrgId = this.context.legacySelectedOrgId ?? storedOrgId;
      const cachedTenant = localStorage.getItem(`finage_tenant_modules_${schemaName}`);
      const legacyState = JSON.parse(localStorage.getItem('finage_os_v3_state') || 'null');
      const savedOrgId = legacyState?.institution?.orgId || null;
      const savedSchema = legacyState?.institution?.schemaName || null;
      const identityConflicts = (savedOrgId && savedOrgId !== this.context.currentOrgId) ||
        (savedSchema && savedSchema !== schemaName);
      const baseStateMatches = !identityConflicts && (
        savedOrgId === this.context.currentOrgId ||
        savedSchema === schemaName ||
        (previouslySelectedOrgId === this.context.currentOrgId && storedSchema === schemaName)
      );
      if (cachedTenant) {
        tenantData = JSON.parse(cachedTenant);
        legacyStorageKeys = [`finage_tenant_modules_${schemaName}`];
        if (baseStateMatches) legacyStorageKeys.push('finage_os_v3_state');
      } else if (baseStateMatches) {
        tenantData = legacyState;
        legacyStorageKeys = ['finage_os_v3_state'];
      }
    } catch (_) {
      throw new Error('Saved browser data could not be read. No data was uploaded.');
    }
    if (!tenantData) {
      throw new Error('No saved operational data could be positively matched to this organization.');
    }
    const transactions = [...(tenantData.transactions || [])];
    const transactionIds = new Set(transactions.map(tx => tx.id).filter(Boolean));
    (tenantData.ledger || []).forEach(entry => {
      if (!entry.id || transactionIds.has(entry.id)) return;
      const member = (tenantData.members || []).find(item => item.id === entry.memberId);
      const legs = Array.isArray(entry.legs) ? entry.legs : [];
      transactions.push({
        id: entry.id,
        date: entry.timestamp || '',
        type: entry.type || 'Legacy Ledger Entry',
        status: 'Completed',
        channel: entry.channel || 'Legacy',
        memberId: entry.memberId || null,
        memberName: member?.name || entry.memberId || '',
        amount: Number(entry.amount) || 0,
        details: JSON.stringify({ legacyJournal: entry }),
        glDebit: legs.find(leg => leg.type === 'Debit')?.glCode || null,
        glCredit: legs.find(leg => leg.type === 'Credit')?.glCode || null,
        postedBy: typeof entry.user === 'string' ? entry.user : entry.user?.id || null,
        branchId: member?.branchId || null
      });
      transactionIds.add(entry.id);
    });
    const arrays = {
      branches: tenantData.branches || [],
      glAccounts: tenantData.generalLedger || [],
      members: tenantData.members || [],
      transactions,
      auditTrail: tenantData.auditTrail || []
    };
    const totalRecords = Object.values(arrays).reduce((total, rows) => total + rows.length, 0);
    if (totalRecords === 0) throw new Error('The matched browser dataset contains no supported operational records.');
    return {
      payload: {
        name: this.context.currentOrg.name,
        type: this.context.currentOrg.type,
        regNumber: this.context.currentOrg.reg_number || '',
        country: this.context.currentOrg.country || '',
        baseCurrency: this.context.currentOrg.base_currency || 'UGX',
        financialYear: this.context.currentOrg.financial_year || '2026',
        branches: arrays.branches,
        glAccounts: arrays.glAccounts,
        members: arrays.members,
        transactions: arrays.transactions,
        auditTrail: arrays.auditTrail,
        openingBalances: [],
        migrationBatchId: `LEGACY-${crypto.randomUUID()}`,
        migrationSourceFiles: ['This browser’s selected-organization legacy cache'],
        migrationRowCounts: {
          branches: arrays.branches.length, glAccounts: arrays.glAccounts.length,
          members: arrays.members.length, transactions: arrays.transactions.length,
          auditTrail: arrays.auditTrail.length
        },
        migrationControlTotals: {}
      },
      counts: {
        branches: arrays.branches.length, glAccounts: arrays.glAccounts.length,
        members: arrays.members.length, transactions: arrays.transactions.length,
        auditTrail: arrays.auditTrail.length, totalRecords
      },
      legacyStorageKeys
    };
  },

  async importCurrentBrowserData() {
    if (!window.supabase || !this.context.currentOrgId) throw new Error('Connect to a selected organization first.');
    if (this.context.operationalStatus !== 'empty') {
      throw new Error('Import is only available when the remote organization has no operational records.');
    }
    const { payload, counts, legacyStorageKeys } = this.getLegacyImportPayload();
    const { data, error } = await window.supabase.rpc('import_legacy_tenant_state', {
      p_org_id: this.context.currentOrgId,
      p_org_data: payload
    });
    if (error) throw new Error(`One-time import was rejected: ${error.message}`);
    if (!data?.success) throw new Error(data?.error || 'One-time import was not confirmed by the server.');

    legacyStorageKeys.forEach(key => localStorage.removeItem(key));
    if (localStorage.getItem('finage_active_data_schema') === this.context.currentOrgSchema) {
      localStorage.removeItem('finage_active_data_schema');
    }
    try {
      await this.loadOperationalData();
    } catch (reloadError) {
      this.context.operationalError = `Supabase accepted the import, but the post-import reload failed: ${reloadError.message}`;
      window.store?.notify();
    }
    return { ...data, counts };
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
    await this.activateOrg(formData.id);

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
    }
    await this.loadOperationalData();
    return updatedOrg;
  },

  getOrganizations() { return this.context.organizations; },
  getActiveOrg()     { return this.context.currentOrg; },
  isSuperuser()      { return this.context.isPlatformSuperuser; }
};

window.Platform = Platform;
