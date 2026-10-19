const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = relPath => fs.readFileSync(path.join(root, relPath), 'utf8');

function setupPlatformEnvironment({ capabilities = {}, rpcResponses = {} } = {}) {
  const state = {
    institution: { orgId: 'org_test', schemaName: 'org_test_sacco' },
    users: [{ id: 'USR-1', name: 'Test Operator', status: 'Active' }],
    branches: [],
    members: [],
    generalLedger: [],
    transactions: [],
    auditTrail: [],
    loanProducts: [],
    disbursementQueue: [],
    workflowTasks: [],
    externalFacilities: [],
    operatingExpenses: [],
    shortTermInvestments: [],
    cashTransfers: [],
    expenseSettlements: [],
    bankAccounts: [],
    investmentAccruals: [],
    batchJobs: [],
    committeeReviews: []
  };

  const domainCalls = [];
  const supabase = {
    auth: {
      async getUser() {
        return { data: { user: { id: 'auth-user-1', email: 'operator@finage.test' } }, error: null };
      }
    },
    schema() {
      return {
        from() {
          return {
            select: async () => ({ data: [], error: null })
          };
        }
      };
    },
    async rpc(name, args) {
      if (name === 'online_write_capabilities') {
        return {
          data: {
            member_create: true, counter_post: true, manual_journal: true,
            credit_application: true, credit_admin: true, credit_release: true,
            treasury_drawdown: true, treasury_invest: true, opex_manage: true,
            branch_reconcile: true, till_reconcile: true, portfolio_provision: true,
            user_manage: true,
            cash_transfer: true, expense_settle: true, bank_manage: true,
            yield_accrue: true, batch_post: true, committee_approve: true,
            ...capabilities
          },
          error: null
        };
      }
      if (name === 'execute_tenant_domain_action') {
        domainCalls.push({ action: args.p_action, payload: args.p_payload });
        return {
          data: rpcResponses[args.p_action] || { id: 'RES-' + args.p_action, status: 'confirmed' },
          error: null
        };
      }
      return { data: { id: 'TX-100' }, error: null };
    }
  };

  const window = {
    supabase,
    store: {
      state,
      notify() {}
    }
  };

  const context = {
    window,
    localStorage: { getItem() { return 'org_test'; }, setItem() {} },
    crypto: { randomUUID: () => 'test-uuid-12345678' },
    console,
    JSON,
    Promise,
    Object,
    String,
    Number
  };

  vm.runInNewContext(read('js/platform.js'), context, { filename: 'js/platform.js' });
  window.Platform.context.currentOrgId = 'org_test';
  window.Platform.context.currentOrgSchema = 'org_test_sacco';
  window.Platform.context.writeCapabilities = {
    ...window.Platform.emptyWriteCapabilities(),
    cash_transfer: true,
    expense_settle: true,
    bank_manage: true,
    yield_accrue: true,
    batch_post: true,
    committee_approve: true,
    ...capabilities
  };

  return { platform: window.Platform, domainCalls, state };
}

test('advanced operations SQL migration contains required tables and atomic constraints', () => {
  const sql = read('online_advanced_operations.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.branch_cash_transfers/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.expense_settlements/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.bank_accounts/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.investment_accruals/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.batch_import_jobs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS %1\$I\.committee_reviews/);

  assert.match(sql, /'cash_transfer'/);
  assert.match(sql, /'expense_settle'/);
  assert.match(sql, /'bank_manage'/);
  assert.match(sql, /'yield_accrue'/);
  assert.match(sql, /'batch_post'/);
  assert.match(sql, /'committee_approve'/);
});

test('Platform initiates and accepts branch cash transfers', async () => {
  const { platform, domainCalls } = setupPlatformEnvironment();

  const initResult = await platform.initiateCashTransfer({
    branchId: 'BR-1',
    transferType: 'vault_to_teller',
    toUserId: 'USR-2',
    amount: 500000,
    notes: 'Morning float distribution'
  }, { notify: false });

  assert.equal(domainCalls[0].action, 'initiate_cash_transfer');
  assert.equal(domainCalls[0].payload.amount, 500000);
  assert.equal(initResult.result.status, 'confirmed');

  const acceptResult = await platform.acceptCashTransfer('XFER-123', { notify: false });
  assert.equal(domainCalls[1].action, 'accept_cash_transfer');
  assert.equal(domainCalls[1].payload.transferId, 'XFER-123');
  assert.equal(acceptResult.result.status, 'confirmed');
});

test('Platform settles operating expenses with voucher details', async () => {
  const { platform, domainCalls } = setupPlatformEnvironment();

  const result = await platform.settleExpense({
    payeeName: 'Power & Lighting Co',
    invoiceRef: 'INV-8891',
    expenseGL: '5020',
    fundingGL: '1020',
    amount: 150000,
    paymentMethod: 'Bank Transfer',
    description: 'Branch electricity bill'
  }, { notify: false });

  assert.equal(domainCalls[0].action, 'settle_expense');
  assert.equal(domainCalls[0].payload.expenseGL, '5020');
  assert.equal(domainCalls[0].payload.fundingGL, '1020');
  assert.equal(result.result.status, 'confirmed');
});

test('Platform manages commercial bank subledgers and investment yield accrual', async () => {
  const { platform, domainCalls } = setupPlatformEnvironment();

  await platform.manageBankAccount({
    bankName: 'Stanbic Bank',
    accountNumber: '9030012345678',
    accountTitle: 'Main Operations Account',
    glCode: '1020',
    currency: 'UGX',
    balance: 45000000
  }, { notify: false });

  assert.equal(domainCalls[0].action, 'manage_bank_account');
  assert.equal(domainCalls[0].payload.bankName, 'Stanbic Bank');

  await platform.accrueInvestmentYield({
    positionId: 'INV-POS-1',
    amount: 350000
  }, { notify: false });

  assert.equal(domainCalls[1].action, 'accrue_investment_yield');
  assert.equal(domainCalls[1].payload.amount, 350000);
});

test('Platform validates and executes batch transaction postings and committee reviews', async () => {
  const { platform, domainCalls } = setupPlatformEnvironment();

  const batch = [
    { type: 'Member Deposit', memberId: 'MBR-1', amount: 50000, debitGL: '1010', creditGL: '2010' },
    { type: 'Loan Repayment', memberId: 'MBR-2', loanId: 'LN-1', amount: 120000, debitGL: '1010', creditGL: '1200' }
  ];

  await platform.batchPostTransactions(batch, { notify: false });
  assert.equal(domainCalls[0].action, 'batch_post_transactions');
  assert.equal(domainCalls[0].payload.transactions.length, 2);

  await platform.recordCommitteeDecision({
    applicationId: 'APP-99',
    decision: 'approved',
    comments: 'Board credit committee quorum met and verified.'
  }, { notify: false });

  assert.equal(domainCalls[1].action, 'committee_review_decision');
  assert.equal(domainCalls[1].payload.decision, 'approved');
});

test('Unauthorized users are blocked from executing advanced actions', async () => {
  const { platform } = setupPlatformEnvironment({
    capabilities: {
      cash_transfer: false,
      expense_settle: false,
      bank_manage: false,
      yield_accrue: false,
      batch_post: false,
      committee_approve: false
    }
  });

  await assert.rejects(
    () => platform.initiateCashTransfer({ amount: 1000 }),
    /The initiate_cash_transfer operation is not enabled for this user/
  );

  await assert.rejects(
    () => platform.settleExpense({ amount: 1000 }),
    /The settle_expense operation is not enabled for this user/
  );

  await assert.rejects(
    () => platform.manageBankAccount({ bankName: 'Test' }),
    /The manage_bank_account operation is not enabled for this user/
  );

  await assert.rejects(
    () => platform.accrueInvestmentYield({ amount: 1000 }),
    /The accrue_investment_yield operation is not enabled for this user/
  );

  await assert.rejects(
    () => platform.batchPostTransactions([]),
    /The batch_post_transactions operation is not enabled for this user/
  );

  await assert.rejects(
    () => platform.recordCommitteeDecision({ applicationId: '1' }),
    /The committee_review_decision operation is not enabled for this user/
  );
});
