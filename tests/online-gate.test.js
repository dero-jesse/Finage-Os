const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadPlatform(remoteRows, {
  importResponse = { success: true },
  capabilities = { member_create: false, counter_post: false, manual_journal: false },
  writeResponse = { id: 'TX-online-1', type: 'Teller Deposit', amount: 5 },
  domainResponse = { id: 'server-operation-1' }
} = {}) {
  const localStorage = createLocalStorage();
  const state = {};
  const calls = [];
  let notificationCount = 0;
  const supabase = {
    schema(schemaName) {
      return {
        from(table) {
          return {
            select: async () => ({
              data: remoteRows[table] || [],
              error: null
            })
          };
        }
      };
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'online_write_capabilities') return { data: capabilities, error: null };
      if (name === 'create_tenant_member') {
        const member = { id: 'MEM-online-1', savingsBalance: 0, activeLoans: [], ...args.p_member };
        remoteRows.members.push(member);
        return { data: member, error: null };
      }
      if (name === 'post_tenant_financial_transaction') {
        remoteRows.transactions.push({ ...writeResponse, postedBy: 'USR-test' });
        return { data: writeResponse, error: null };
      }
      if (name === 'execute_tenant_domain_action') return { data: domainResponse, error: null };
      if (name === 'execute_tenant_financial_action') return { data: writeResponse, error: null };
      if (name === 'import_legacy_tenant_state' && importResponse.success) {
        remoteRows.branches = args.p_org_data.branches;
        remoteRows.members = args.p_org_data.members;
        remoteRows.general_ledger = args.p_org_data.glAccounts;
        remoteRows.transactions = args.p_org_data.transactions;
        remoteRows.audit_trail = args.p_org_data.auditTrail;
      }
      return { data: importResponse, error: null };
    }
  };
  const window = {
    supabase,
    store: { state, notify() { notificationCount++; } }
  };
  const context = {
    window,
    localStorage,
    crypto: { randomUUID: () => 'test-import-id' },
    console,
    JSON,
    Promise,
    Object,
    String,
    Number
  };
  vm.runInNewContext(read('js/platform.js'), context, { filename: 'js/platform.js' });
  const platform = window.Platform;
  Object.assign(platform.context, {
    currentOrgId: 'org-1',
    currentOrgSchema: 'org_test',
    currentOrg: {
      id: 'org-1', name: 'Test Org', type: 'SACCO',
      base_currency: 'UGX', financial_year: '2026'
    }
  });
  return { platform, localStorage, state, calls, getNotificationCount: () => notificationCount };
}

test('store does not read or persist operational state in localStorage', () => {
  const forbiddenStorage = {
    getItem() { throw new Error('Operational localStorage read attempted'); },
    setItem() { throw new Error('Operational localStorage write attempted'); },
    removeItem() { throw new Error('Unexpected localStorage deletion'); }
  };
  const window = {};
  const context = { window, localStorage: forbiddenStorage, console, JSON, Date };
  vm.runInNewContext(read('js/store.js'), context, { filename: 'js/store.js' });
  assert.ok(window.store);
  assert.equal(window.store.save(), false);
  assert.equal(window.store.saveLocal(), false);
  assert.equal(window.store.saveQuiet(), false);
  window.store.prepareTenantState('org_test');
  assert.equal(window.store.state.institution.schemaName, 'org_test');
  window.Platform = { context: { operationalStatus: 'ready' } };
  assert.equal(window.store.postTransaction({ type: 'Member Deposit', amount: 5 }), false);
});

test('tenant reads are loaded from Supabase and operational data stays read-only', async () => {
  const remoteRows = {
    roles: [{ id: 'ROLE-1' }],
    users: [{ id: 'USR-1' }],
    branches: [{ id: 'br-1' }],
    members: [{ id: 'mem-1', name: 'Remote member' }],
    general_ledger: [{ code: '1010', balance: 200 }],
    transactions: [{ id: 'tx-1', amount: 5 }],
    audit_trail: [{ id: 'audit-1' }]
  };
  const { platform, state } = loadPlatform(remoteRows);
  await platform.loadOperationalData();
  assert.equal(platform.context.operationalStatus, 'read_only');
  assert.deepEqual(Array.from(state.members, member => member.id), ['mem-1']);
  assert.equal(state.generalLedger[0].balance, 200);
  assert.equal(state.transactions[0].id, 'tx-1');
});

test('one-time import is explicit and removes the legacy cache only after server acceptance', async () => {
  const remoteRows = {
    roles: [], users: [], branches: [], members: [], general_ledger: [],
    transactions: [], audit_trail: []
  };
  const { platform, localStorage, calls } = loadPlatform(remoteRows);
  const legacy = {
    branches: [{ id: 'br-1', name: 'Branch', code: 'B1' }],
    generalLedger: [{ code: '1010', name: 'Cash', category: 'Assets', normal: 'Debit', balance: 2 }],
    members: [{ id: 'mem-1', name: 'Member', nationalId: 'N1', phone: '1', joinDate: '2026-01-01', kycStatus: 'Verified' }],
    transactions: [{ id: 'tx-1', type: 'Import', status: 'Completed', channel: 'Legacy', amount: 2 }],
    ledger: [{
      id: 'tx-2', timestamp: '2026-01-02', type: 'Member Deposit',
      channel: 'Branch', memberId: 'mem-1', amount: 3, user: 'operator',
      legs: [{ glCode: '1010', type: 'Debit' }, { glCode: '2010', type: 'Credit' }]
    }],
    auditTrail: []
  };
  localStorage.setItem('finage_active_org_id', 'org-1');
  localStorage.setItem('finage_active_data_schema', 'org_test');
  localStorage.setItem('finage_tenant_modules_org_test', JSON.stringify(legacy));
  localStorage.setItem('finage_os_v3_state', JSON.stringify({ institution: { orgId: 'other-org' }, members: [{ id: 'other-member' }] }));
  await platform.loadOperationalData();
  const importPromise = platform.importCurrentBrowserData();
  await importPromise;
  const importCall = calls.find(call => call.name === 'import_legacy_tenant_state');
  assert.ok(importCall);
  assert.equal(importCall.args.p_org_id, 'org-1');
  assert.deepEqual(JSON.parse(JSON.stringify(importCall.args.p_org_data.migrationRowCounts)), {
    branches: 1, glAccounts: 1, members: 1, transactions: 2, auditTrail: 0
  });
  const importedJournal = importCall.args.p_org_data.transactions.find(tx => tx.id === 'tx-2');
  assert.equal(importedJournal.glDebit, '1010');
  assert.equal(JSON.parse(importedJournal.details).legacyJournal.id, 'tx-2');
  assert.equal(localStorage.getItem('finage_tenant_modules_org_test'), null);
  assert.ok(localStorage.getItem('finage_os_v3_state'));
  assert.equal(localStorage.getItem('finage_active_data_schema'), null);
  assert.equal(platform.context.operationalStatus, 'read_only');
});

test('existing remote data prevents import and preserves the browser cache', async () => {
  const { platform, localStorage, calls } = loadPlatform({
    roles: [], users: [], branches: [], members: [{ id: 'remote-member' }],
    general_ledger: [], transactions: [], audit_trail: []
  });
  localStorage.setItem('finage_active_org_id', 'org-1');
  localStorage.setItem('finage_tenant_modules_org_test', JSON.stringify({
    branches: [{ id: 'br-1' }], generalLedger: [{ code: '1010' }]
  }));
  await platform.loadOperationalData();
  await assert.rejects(platform.importCurrentBrowserData(), /only available when the remote organization has no operational records/i);
  assert.equal(calls.some(call => call.name === 'import_legacy_tenant_state'), false);
  assert.ok(localStorage.getItem('finage_tenant_modules_org_test'));
});

test('an import error never deletes local legacy data', async () => {
  const { platform, localStorage } = loadPlatform({
    roles: [], users: [], branches: [], members: [], general_ledger: [],
    transactions: [], audit_trail: []
  }, { importResponse: { success: false } });
  localStorage.setItem('finage_active_org_id', 'org-1');
  localStorage.setItem('finage_tenant_modules_org_test', JSON.stringify({
    branches: [{ id: 'br-1' }], generalLedger: [{ code: '1010' }]
  }));
  await platform.loadOperationalData();
  await assert.rejects(platform.importCurrentBrowserData(), /not confirmed by the server/i);
  assert.ok(localStorage.getItem('finage_tenant_modules_org_test'));
});

test('online member and transaction APIs wait for server acceptance and refresh remote state', async () => {
  const remoteRows = {
    roles: [], users: [], branches: [{ id: 'br-1' }], members: [], general_ledger: [],
    transactions: [], audit_trail: []
  };
  const { platform, state, calls, getNotificationCount } = loadPlatform(remoteRows, {
    capabilities: { member_create: true, counter_post: true, manual_journal: true },
    writeResponse: { id: 'TX-server-1', type: 'Teller Deposit', amount: 5 }
  });
  await platform.loadOperationalData();
  assert.equal(platform.context.operationalStatus, 'partial');
  const notificationsAfterInitialLoad = getNotificationCount();
  const memberResult = await platform.createMember({
    name: 'Online member', nationalId: 'N-1', phone: '555', branchId: 'br-1'
  }, { notify: false });
  assert.equal(memberResult.member.id, 'MEM-online-1');
  const posted = await platform.postFinancialTransaction({
    type: 'Teller Deposit', memberId: 'MEM-online-1', amount: 5,
    legs: [
      { glCode: '1010', type: 'Debit', amount: 5 },
      { glCode: '2010', type: 'Credit', amount: 5 }
    ],
    idempotencyKey: 'stable-request-key-0001',
    notify: false
  });
  assert.equal(posted.transaction.id, 'TX-server-1');
  const memberCall = calls.find(call => call.name === 'create_tenant_member');
  assert.equal(memberCall.args.p_org_id, 'org-1');
  const postCall = calls.find(call => call.name === 'post_tenant_financial_transaction');
  assert.equal(postCall.args.p_org_id, 'org-1');
  assert.equal(postCall.args.p_idempotency_key, 'stable-request-key-0001');
  assert.equal(postCall.args.p_legs.length, 2);
  assert.equal(state.members[0].id, 'MEM-online-1');
  assert.equal(state.transactions[0].id, 'TX-server-1');
  assert.equal(getNotificationCount(), notificationsAfterInitialLoad);
});

test('online operation capability failures keep APIs blocked and surfaced', async () => {
  const { platform } = loadPlatform({
    roles: [], users: [], branches: [], members: [], general_ledger: [],
    transactions: [], audit_trail: []
  });

  test('extended tenant reads map credit, workflow, funding, expense and investment records from Supabase', async () => {
    const remoteRows = {
      roles: [], users: [], branches: [{ id: 'br-1', name: 'Branch' }],
      members: [{ id: 'mem-1', name: 'Remote member', branchId: 'br-1', activeLoans: [] }],
      general_ledger: [], transactions: [], audit_trail: [],
      loan_products: [{ id: 'prod-1', name: 'Remote product', annual_interest_rate: 12, repayment_method: 'reducing', policy_version: 4 }],
      loan_applications: [{ id: 'app-1', member_id: 'mem-1', product_id: 'prod-1', amount: 100, status: 'Application Submitted', workflow_task_id: 'wf-1' }],
      workflow_tasks: [{ id: 'wf-1', type: 'Loan Application Review', entity_id: 'app-1', status: 'Pending Checker Release', history: [] }],
      external_facilities: [{ id: 'dfi-1', lender: 'Remote lender', total_commitment: 1000, drawn_amount: 200 }],
      operating_expenses: [{ id: 'opx-1', category: 'Rent', monthly_amount: 20, due_day: 5 }],
      branch_reconciliations: [{ id: 'rec-1', cash_in_vault: 50 }],
      investment_positions: [{ id: 'inv-1', institution: 'Bank', product: 'T-bill', principal: 80, status: 'Active' }]
    };
    const { platform, state } = loadPlatform(remoteRows, {
      capabilities: { credit_application: true, credit_admin: true, treasury_drawdown: true }
    });
    await platform.loadOperationalData();
    assert.equal(state.loanProducts[0].annualInterestRate, 12);
    assert.equal(state.disbursementQueue[0].workflowTaskId, 'wf-1');
    assert.equal(state.workflowTasks[0].entityId, 'app-1');
    assert.equal(state.externalFacilities[0].availableToDraw, 800);
    assert.equal(state.operatingExpenses[0].monthlyAmount, 20);
    assert.equal(state.shortTermInvestments[0].principal, 80);
    assert.equal(platform.context.writeCapabilities.credit_application, true);
    assert.equal(platform.context.writeCapabilities.credit_release, false);
  });

  test('extended operations wait for an authorized server RPC and do not mutate local records', async () => {
    const remoteRows = {
      roles: [], users: [], branches: [], members: [], general_ledger: [],
      transactions: [], audit_trail: [], loan_products: [], loan_applications: [],
      workflow_tasks: [], external_facilities: [], operating_expenses: [],
      branch_reconciliations: [], investment_positions: []
    };
    const { platform, state, calls, getNotificationCount } = loadPlatform(remoteRows, {
      capabilities: { credit_application: true, credit_admin: true }
    });
    await platform.loadOperationalData();
    const notifications = getNotificationCount();
    const result = await platform.executeDomainAction('create_loan_application', {
      memberId: 'member-1', productId: 'product-1', amount: 1, termMonths: 1, purpose: 'test'
    }, { idempotencyKey: 'stable-domain-key-001', notify: false });
    assert.equal(result.result.id, 'server-operation-1');
    assert.equal(state.disbursementQueue.length, 0);
    assert.equal(getNotificationCount(), notifications);
    const call = calls.find(item => item.name === 'execute_tenant_domain_action');
    assert.equal(call.args.p_action, 'create_loan_application');
    assert.equal(call.args.p_idempotency_key, 'stable-domain-key-001');
    await assert.rejects(platform.executeDomainAction('update_user_roles', {}, {}), /not enabled/i);
  });
  await platform.loadOperationalData();
  await assert.rejects(platform.createMember({ name: 'No', nationalId: 'N', phone: '1', branchId: 'b' }), /not enabled/i);
  await assert.rejects(platform.postFinancialTransaction({
    type: 'Teller Deposit', amount: 1, legs: [{}, {}]
  }), /not enabled/i);
});

test('SQL migrations expose only authenticated, authorized atomic writes', () => {
  const sql = read('online_data_migration.sql');
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /org_has_permission\(''MANAGE_USERS''\)/);
  assert.match(sql, /LOCK TABLE %1\$I\.branches.*ACCESS EXCLUSIVE MODE/s);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.apply_tenant_setup\(TEXT, JSONB, BOOLEAN\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /Import refused: this organization already contains operational data/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.import_legacy_tenant_state\(TEXT, JSONB\) TO authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.import_legacy_tenant_state\(TEXT, JSONB\) FROM PUBLIC, anon/);

  const writes = read('online_financial_writes.sql');
  assert.match(writes, /SECURITY DEFINER/);
  assert.match(writes, /org_current_user_id/);
  assert.match(writes, /org_has_permission\(''POST_COUNTER_TX''\)/);
  assert.match(writes, /org_has_permission\(''MODIFY_GL_JOURNAL''\)/);
  assert.match(writes, /create_tenant_member/);
  assert.match(writes, /post_tenant_financial_transaction/);
  assert.match(writes, /Insufficient member savings balance/);
  assert.match(writes, /Loan does not belong to this member/);
  assert.match(writes, /jsonb_array_length\(p_legs\) <> 2/);
  assert.match(writes, /v_till_count > 1/);
  assert.match(writes, /v_gl_code = '1010' AND p_type <> 'Manual GL Journal'/);
  assert.match(writes, /audit_trail/);
  assert.match(writes, /GRANT EXECUTE ON FUNCTION public\.post_tenant_financial_transaction/);
  assert.match(writes, /REVOKE ALL ON FUNCTION public\.create_tenant_member/);

  const extended = read('online_extended_writes.sql');
  assert.match(extended, /CREATE TABLE IF NOT EXISTS %1\$I\.loan_applications/);
  assert.match(extended, /CREATE TABLE IF NOT EXISTS %1\$I\.workflow_tasks/);
  assert.match(extended, /CREATE TABLE IF NOT EXISTS %1\$I\.investment_positions/);
  assert.match(extended, /CREATE OR REPLACE FUNCTION public\.execute_tenant_domain_action/);
  assert.match(extended, /CREATE OR REPLACE FUNCTION public\.execute_tenant_financial_action/);
  assert.match(extended, /CREATE TABLE IF NOT EXISTS %1\$I\.domain_action_idempotency/);
  assert.match(extended, /:domain:' \|\| v_key/);
  assert.match(extended, /v_saved_payload IS DISTINCT FROM p_payload/);
  assert.match(extended, /INSERT INTO %I\.domain_action_idempotency/);
  assert.match(extended, /to_regclass\(format\('%I\.domain_action_idempotency',v_schema\)\) IS NOT NULL/);
  assert.match(extended, /A maker cannot approve or reject their own application/);
  assert.match(extended, /Only an overdue unpaid instalment can receive a penalty assessment/);
  assert.match(extended, /v_extended_ready :=/);
  assert.match(extended, /'credit_application',false/);
  assert.match(extended, /loan-approval:/);
  assert.match(extended, /Idempotency key was already used for a different investment redemption/);
  assert.match(extended, /You cannot grant permissions that you do not hold/);
  assert.match(extended, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I.%I FROM authenticated/);
  assert.doesNotMatch(extended, /p_full_state|p_state_snapshot|replace_tenant_state/i);
});
