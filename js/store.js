/**
 * Finage OS v3 - Centralized Institutional State Store
 * Orbit-R-grade Core Banking, RIM, Real-Time GL, Embedded Workflow & User RBAC / SoD Handlers
 */

class FinageStore {
  constructor() {
    this.storageKey = 'finage_os_v3_state';
    this.listeners = [];
    this.state = this.loadInitialState();
  }

  loadInitialState() {
    return this.getDefaultState();
  }

    setBaseCurrency(curr) {
    this.state.institution.baseCurrency = curr;
    if (window.Formatter) Formatter.setCurrency(curr);
    this.save();
    this.notify();
  }

  getDefaultState() {
    return {
      institution: {
        name: 'Finage Apex Microfinance Bank & SACCO Ltd',
        type: 'Deposit-Taking SACCO / Microfinance Bank (SASRA / Central Bank Tier-1)',
        regulatoryMinLiquidityRatio: 15.0,
        internalWarningBufferRatio: 20.0,
        baseCurrency: 'UGX',
        financialYear: '2026'
      },
      hasPassedLanding: false,
      isAuthenticated: false,
      currentRole: null, 
      currentUserId: null, 
      selectedBranchId: null,
      selectedMemberId: null,
      forecastHorizon: 'monthly',

      // --- Centralized Role Dictionary (RBAC) ---
      roles: [
        { id: 'ROLE-ADMIN', name: 'System Administrator', category: 'board', permissions: ['READ_ALL_MODULES', 'WRITE_ALL_MODULES', 'MANAGE_USERS', 'REPORTS_ACCESS', 'POLICY_THRESHOLD_CONFIG', 'BOARD_ESCALATION_APPROVE', 'GOVERNANCE_OVERVIEW'] },
        { id: 'ROLE-BRANCH-MGR', name: 'Branch Manager / FOSA Supervisor', category: 'front-office', permissions: ['VAULT_RECONCILE', 'APPROVE_BRANCH_LOAN_TIER1', 'TELLER_LIMIT_OVERRIDE', 'AUDIT_TELLER_ACTIVITY', 'REPORTS_ACCESS'] },
        { id: 'ROLE-FRONT-OFFICE', name: 'FOSA Desk Officer', category: 'front-office', permissions: ['VIEW_MEMBER_BALANCE', 'AUDIT_TELLER_ACTIVITY', 'APPROVE_BRANCH_LOAN_TIER1', 'TELLER_LIMIT_OVERRIDE', 'REPORTS_ACCESS'] },
        { id: 'ROLE-TELLER', name: 'Teller Desk Officer', category: 'teller', permissions: ['POST_COUNTER_TX', 'VIEW_MEMBER_BALANCE', 'MANAGE_ASSIGNED_TILL'] },
        { id: 'ROLE-CREDIT-MAKER', name: 'Credit Origination Officer (Maker)', category: 'credit', permissions: ['ORIGINATE_LOAN_APP', 'KYC_RISK_SCORING', 'VIEW_PAR_METRICS'] },
        { id: 'ROLE-CREDIT-CHECKER', name: 'Head of Credit & Checker', category: 'credit', permissions: ['APPROVE_CREDIT_FACILITY', 'PACING_RELEASE_AUTHORIZE', 'OVERRIDE_NPA_PROVISION'] },
        { id: 'ROLE-TREASURY', name: 'Treasury & Liquidity Officer', category: 'treasury', permissions: ['EXECUTE_DFI_DRAWDOWN', 'RECONCILE_BANKS', 'PLACE_TBILLS', 'MODIFY_GL_JOURNAL', 'RUN_PARALLEL_EOD', 'REPORTS_ACCESS'] },
        { id: 'ROLE-AUDITOR', name: 'Risk Lead & Internal Auditor', category: 'board', permissions: ['VIEW_AUDIT_LOGS', 'EXPORT_SASRA_RETURNS', 'MONITOR_AML_CFT', 'READ_ALL_MODULES', 'REPORTS_ACCESS'] },
        { id: 'ROLE-BOARD-CHAIR', name: 'Board Chairman & ALCO Lead', category: 'board', permissions: ['GOVERNANCE_OVERVIEW', 'BOARD_ESCALATION_APPROVE', 'POLICY_THRESHOLD_CONFIG', 'REPORTS_ACCESS'] },
        { id: 'ROLE-MEMBER', name: 'Customer / SACCO Member', category: 'member', permissions: ['VIEW_OWN_BALANCE', 'VIEW_OWN_LOANS'] }
      ],

      // --- Institutional Users & Access Control Directory (RBAC) ---
      users: [
        {
          id: 'USR-000',
          name: 'Platform Superuser',
          email: 'superuser@finage.io',
          roles: ['ROLE-ADMIN'],
          branchId: 'br-01',
          branchName: 'Head Office',
          singleApprovalLimit: 10000000,
          dailyApprovalLimit: 50000000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-09-01T08:00:00'
        },
        {
          id: 'USR-101',
          name: 'Faith Mwangi',
          email: 'faith.mwangi@finage.co.ke',
          roles: ['ROLE-BRANCH-MGR'],
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          singleApprovalLimit: 50000,
          dailyApprovalLimit: 150000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T14:15:00'
        },
        {
          id: 'USR-102',
          name: 'David Ochieng',
          email: 'david.ochieng@finage.co.ke',
          roles: ['ROLE-TELLER'],
          tellerId: 'T-102',
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          singleApprovalLimit: 5000,
          dailyApprovalLimit: 25000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T14:48:00'
        },
        {
          id: 'USR-201',
          name: 'Kevin Mutua',
          email: 'kevin.mutua@finage.co.ke',
          roles: ['ROLE-CREDIT-MAKER'],
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          singleApprovalLimit: 0,
          dailyApprovalLimit: 0,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T10:10:00'
        },
        {
          id: 'USR-202',
          name: 'Brian Komen',
          email: 'brian.komen@finage.co.ke',
          roles: ['ROLE-CREDIT-CHECKER'],
          branchId: 'br-05',
          branchName: 'Eldoret North Rift',
          singleApprovalLimit: 250000,
          dailyApprovalLimit: 750000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T09:30:00'
        },
        {
          id: 'USR-301',
          name: 'Caroline Wanjala',
          email: 'caroline.wanjala@finage.co.ke',
          roles: ['ROLE-TREASURY'],
          branchId: 'br-01',
          branchName: 'Head Office Treasury',
          singleApprovalLimit: 1000000,
          dailyApprovalLimit: 3000000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T15:10:00'
        },
        {
          id: 'USR-401',
          name: 'Johnstone Kazungu',
          email: 'j.kazungu@finage.co.ke',
          roles: ['ROLE-AUDITOR'],
          branchId: 'br-02',
          branchName: 'Compliance & Audit HQ',
          singleApprovalLimit: 0,
          dailyApprovalLimit: 0,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T11:00:00'
        },
        {
          id: 'USR-501',
          name: 'Dr. Evans Kiprotich',
          email: 'e.kiprotich@finage.co.ke',
          roles: ['ROLE-BOARD-CHAIR'],
          branchId: 'br-01',
          branchName: 'Board of Directors',
          singleApprovalLimit: 5000000,
          dailyApprovalLimit: 10000000,
          status: 'Active',
          mfaEnabled: true,
          lastLogin: '2026-08-28T08:00:00'
        },
        // Note: ROLE-MEMBER users (customers) are stored in the members[] register,
        // not in the staff users[] directory. USR-901 removed from staff roster.
      ],
      
      // --- LAYER 0: Core Banking Members / Customer Register ---
      members: [
        {
          id: 'MEM-1001',
          name: 'Sarah Wanjiku Kamau',
          nationalId: '28491023',
          phone: '+254 722 890123',
          email: 'sarah.kamau@barakafarms.co.ke',
          joinDate: '2021-03-15',
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          kycStatus: 'Verified (Biometric & Photo)',
          occupation: 'Commercial Agri-Business Director',
          employer: 'Baraka Green Agri-Enterprises Ltd',
          riskSegment: 'Low Risk - Tier 1 VIP',
          relationshipScore: 94,
          savingsBalance: 48500,
          fixedDepositBalance: 120000,
          shareCapital: 35000,
          activeLoans: [
            {
              loanId: 'LN-5501',
              product: 'Agri Asset Expansion Loan',
              principal: 150000,
              outstandingBalance: 68500,
              monthlyInstallment: 9400,
              interestRate: 14.5,
              nextDueDate: '2026-09-05',
              daysInArrears: 0,
              npaClassification: 'Normal (Performing)'
            }
          ],
          guarantorCommitments: [
            { guaranteedMember: 'MEM-1004 (Joseph Mwangi)', guaranteedAmount: 25000, status: 'Active' }
          ]
        },
        {
          id: 'MEM-1002',
          name: 'David Omondi Otieno',
          nationalId: '31298471',
          phone: '+254 733 452901',
          email: 'david.otieno@savannahtrans.com',
          joinDate: '2022-06-10',
          branchId: 'br-02',
          branchName: 'Mombasa Coastal',
          kycStatus: 'Verified',
          occupation: 'Fleet Logistics Operator',
          employer: 'Savannah Logistics Transporters Ltd',
          riskSegment: 'Moderate Risk - Commercial SME',
          relationshipScore: 82,
          savingsBalance: 28400,
          fixedDepositBalance: 50000,
          shareCapital: 20000,
          activeLoans: [
            {
              loanId: 'LN-5502',
              product: 'Commercial SME Working Capital',
              principal: 200000,
              outstandingBalance: 142000,
              monthlyInstallment: 14200,
              interestRate: 16.0,
              nextDueDate: '2026-09-12',
              daysInArrears: 12,
              npaClassification: 'Watch (1-30 Days)'
            }
          ],
          guarantorCommitments: []
        },
        {
          id: 'MEM-1003',
          name: 'Dr. Amina Abdi Noor',
          nationalId: '24918230',
          phone: '+254 710 998822',
          email: 'amina.noor@apexhealth.org',
          joinDate: '2020-01-20',
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          kycStatus: 'Verified',
          occupation: 'Medical Director / Pharmacist',
          employer: 'Apex Health Pharmaceuticals',
          riskSegment: 'Low Risk - Tier 1 VIP',
          relationshipScore: 96,
          savingsBalance: 92000,
          fixedDepositBalance: 250000,
          shareCapital: 60000,
          activeLoans: [],
          guarantorCommitments: [
            { guaranteedMember: 'MEM-1001 (Sarah Wanjiku)', guaranteedAmount: 50000, status: 'Active' }
          ]
        },
        {
          id: 'MEM-1004',
          name: 'Joseph Mwangi Kinyua',
          nationalId: '29817456',
          phone: '+254 721 340912',
          email: 'j.mwangi@nakuruagri.com',
          joinDate: '2023-04-18',
          branchId: 'br-04',
          branchName: 'Nakuru Agri Hub',
          kycStatus: 'Verified',
          occupation: 'Dairy Farm Manager',
          employer: 'Rift Valley Fresh Dairies',
          riskSegment: 'High Risk - Watchlist',
          relationshipScore: 68,
          savingsBalance: 12500,
          fixedDepositBalance: 0,
          shareCapital: 15000,
          activeLoans: [
            {
              loanId: 'LN-5504',
              product: 'Agri Supply Chain Line',
              principal: 120000,
              outstandingBalance: 98000,
              monthlyInstallment: 8800,
              interestRate: 15.5,
              nextDueDate: '2026-08-10',
              daysInArrears: 48,
              npaClassification: 'Substandard (31-90 Days)'
            }
          ],
          guarantorCommitments: []
        },
        {
          id: 'MEM-2001',
          name: 'Jane Wairimu',
          nationalId: '32091823',
          phone: '+254 700 112233',
          email: 'jane.wairimu@example.com',
          joinDate: '2024-01-10',
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          kycStatus: 'Verified',
          occupation: 'Retail Shop Owner',
          employer: 'Self-Employed',
          riskSegment: 'Moderate Risk',
          relationshipScore: 75,
          savingsBalance: 5400,
          fixedDepositBalance: 0,
          shareCapital: 2000,
          activeLoans: [
            {
              loanId: 'LN-6001',
              product: 'Business Expansion Loan',
              principal: 50000,
              outstandingBalance: 32000,
              monthlyInstallment: 5500,
              interestRate: 15.0,
              nextDueDate: '2026-09-20',
              daysInArrears: 0,
              npaClassification: 'Normal (Performing)'
            }
          ],
          guarantorCommitments: []
        },
        {
          id: 'MEM-2002',
          name: 'Peter Njuguna',
          nationalId: '27189044',
          phone: '+254 722 554433',
          email: 'peter.njuguna@example.com',
          joinDate: '2023-11-05',
          branchId: 'br-01',
          branchName: 'Nairobi Central',
          kycStatus: 'Verified',
          occupation: 'High School Teacher',
          employer: 'Ministry of Education',
          riskSegment: 'Low Risk',
          relationshipScore: 88,
          savingsBalance: 15500,
          fixedDepositBalance: 10000,
          shareCapital: 5000,
          activeLoans: [],
          guarantorCommitments: []
        }
      ],

      // --- LAYER 0: Real-Time General Ledger (GL) Chart of Accounts (COA) ---
      generalLedger: [
        { code: '1010', name: 'Branch Vault & Till Cash', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 1236600 },
        { code: '1020', name: 'Commercial Bank Clearing Accounts', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 4270000 },
        { code: '1030', name: 'Central Bank Statutory Reserve (CRR)', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 1200000 },
        { code: '1040', name: 'Digital Channel & M-Pesa Float Pool', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 680000 },
        { code: '1050', name: 'Short-Term Placements & T-Bills', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 2500000 },
        { code: '1200', name: 'Gross Performing Loan Portfolio', category: 'Assets', type: 'Asset', normal: 'Debit', balance: 35800000 },
        { code: '1250', name: 'Allowance for Loan Impairment / Loan Loss Reserve', category: 'Assets', type: 'Asset', normal: 'Credit', isContra: true, balance: 898222 },

        { code: '2010', name: 'Member Demand & Savings Deposits', category: 'Liabilities', type: 'Liability', normal: 'Credit', balance: 11400000 },
        { code: '2020', name: 'Member Fixed Term Deposits', category: 'Liabilities', type: 'Liability', normal: 'Credit', balance: 8550000 },
        { code: '2030', name: 'Contractual SACCO Savings', category: 'Liabilities', type: 'Liability', normal: 'Credit', balance: 8550000 },
        { code: '2200', name: 'External DFI Borrowing Facilities (IFC/FMO)', category: 'Liabilities', type: 'Liability', normal: 'Credit', balance: 6500000 },

        { code: '3010', name: 'Member Share Capital (Equity)', category: 'Equity', type: 'Equity', normal: 'Credit', balance: 4200000 },
        { code: '3020', name: 'Statutory Reserve Fund', category: 'Equity', type: 'Equity', normal: 'Credit', balance: 2880800 },
        { code: '3030', name: 'Retained Earnings / General Reserves', category: 'Equity', type: 'Equity', normal: 'Credit', balance: 2393300 },

        { code: '4010', name: 'Interest Income on Loans', category: 'Income', type: 'Income', normal: 'Credit', balance: 3450000 },
        { code: '4020', name: 'Investment Placement Yields', category: 'Income', type: 'Income', normal: 'Credit', balance: 285000 },
        { code: '4030', name: 'Fees & Commission Income', category: 'Income', type: 'Income', normal: 'Credit', balance: 142500 },

        { code: '5010', name: 'Staff Salaries & Employee Benefits', category: 'Expenses', type: 'Expense', normal: 'Debit', balance: 1920000 },
        { code: '5020', name: 'Branch Operating & Tech Licensing Costs', category: 'Expenses', type: 'Expense', normal: 'Debit', balance: 745000 },
        { code: '5030', name: 'Loan Loss Provision Expense', category: 'Expenses', type: 'Expense', normal: 'Debit', balance: 898222 },
        { code: '5040', name: 'Interest Expense on Member Deposits', category: 'Expenses', type: 'Expense', normal: 'Debit', balance: 0 }
      ],

      // General Ledger Journal entries
      ledger: [],

      // --- Layer 7 / 0: Trial Balance Exception Log & Balance Validation Control ---
      trialBalanceExceptions: [
        {
          id: 'TB-BOOT-01',
          timestamp: new Date().toISOString(),
          triggerSource: 'SYSTEM_BOOTSTRAP_VALIDATION',
          totalDebits: 49249822,
          totalCredits: 49249822,
          debitCreditVariance: 0,
          netAssets: 44788378,
          totalLiabilities: 35000000,
          totalEquity: 9474100,
          netOperatingIncome: 314278,
          equationVariance: 0,
          status: 'BALANCED',
          severity: 'NORMAL',
          message: 'Initial ledger verified: Total Debits (49,249,822) = Total Credits (49,249,822) · Accounting Equation A = L + E + (I - X) verified.'
        }
      ],

      smsAlerts: [],

      channels: [
        { id: 'ch-fosa', name: 'FOSA Branch Network', type: 'Physical Till/Vault', liveBalance: 1236600, dailyTurnover: 840000, status: 'Active', latencyMs: 12 },
        { id: 'ch-mpesa', name: 'M-Pesa B2C/C2B Aggregator', type: 'Mobile Money Float', liveBalance: 680000, dailyTurnover: 1450000, status: 'Active', latencyMs: 240 },
        { id: 'ch-agency', name: 'National SACCO Agency Pool', type: 'Agent Float Network', liveBalance: 450000, dailyTurnover: 320000, status: 'Active', latencyMs: 450 },
        { id: 'ch-atm', name: 'Interswitch ATM / POS Network', type: 'ATM Dispenser Cash', liveBalance: 310000, dailyTurnover: 190000, status: 'Active', latencyMs: 90 },
        { id: 'ch-web', name: 'Internet & Corporate Portal', type: 'Digital Gateway', liveBalance: 0, dailyTurnover: 980000, status: 'Active', latencyMs: 15 }
      ],

      workflowTasks: [
        {
          id: 'WF-701',
          type: 'Loan Disbursement Release',
          entityId: 'DISB-8901',
          title: 'Agri Asset Finance - Baraka Green Agri-Cooperative',
          amount: 180000,
          makerUserId: 'USR-201',
          requestedBy: 'Kevin Mutua (Credit Officer)',
          currentStep: 'Treasury Liquidity Pacing Gate',
          approverRole: 'Finance/Treasury',
          makerCheckerStatus: 'Pending Final Checker Release',
          liquidityImpactCheck: 'PASSED (Headroom UGX 2.14M > UGX 180k)',
          priority: 'High',
          createdAt: '2026-08-28T10:15:00',
          history: [
            { step: 'Credit Committee Approval', user: 'Faith Mwangi (Branch Mgr)', action: 'Approved', timestamp: '2026-08-27T16:40:00' },
            { step: 'Risk Compliance Verification', user: 'Brian Komen (Risk Lead)', action: 'Cleared', timestamp: '2026-08-28T09:30:00' }
          ]
        },
        {
          id: 'WF-702',
          type: 'High-Value Withdrawal Override',
          entityId: 'WTH-4091',
          title: 'Member Cash Withdrawal - Apex Health Pharmaceuticals',
          amount: 75000,
          makerUserId: 'USR-102',
          requestedBy: 'David Ochieng (Teller T-102)',
          currentStep: 'Branch Manager Authorization',
          approverRole: 'Branch/Teller',
          makerCheckerStatus: 'Pending Manager Signature',
          liquidityImpactCheck: 'PASSED (Till Limit Override)',
          priority: 'Urgent',
          createdAt: '2026-08-28T14:20:00',
          history: [
            { step: 'Teller Verification', user: 'David Ochieng', action: 'Initiated', timestamp: '2026-08-28T14:20:00' }
          ]
        },
        {
          id: 'WF-703',
          type: 'New Loan Application',
          entityId: 'APP-9901',
          title: 'Solar SACCO Green Expansion - Eldo Clean Energy',
          amount: 150000,
          makerUserId: 'USR-901',
          requestedBy: 'Teller Desk Portal',
          currentStep: 'Guarantor Digital Confirmation',
          approverRole: 'Credit/Loans',
          makerCheckerStatus: 'Awaiting Guarantor 2 Sign-off',
          liquidityImpactCheck: 'Pending Pacing Scoring',
          priority: 'Medium',
          createdAt: '2026-08-28T13:00:00',
          history: [
            { step: 'Online Application Submitted', user: 'MEM-1003 (Amina Noor)', action: 'Submitted', timestamp: '2026-08-28T13:00:00' },
            { step: 'Guarantor 1 Approved', user: 'MEM-1001 (Sarah Kamau)', action: 'Digitally Signed', timestamp: '2026-08-28T13:45:00' }
          ]
        }
      ],

      npaSummary: {
        normal: { amount: 33079200, percentage: 92.4, provisionRate: 1.0, requiredProvision: 330792 },
        watch: { amount: 1503600, percentage: 4.2, provisionRate: 5.0, requiredProvision: 75180 },
        substandard: { amount: 751800, percentage: 2.1, provisionRate: 25.0, requiredProvision: 187950 },
        doubtful: { amount: 322200, percentage: 0.9, provisionRate: 50.0, requiredProvision: 161100 },
        loss: { amount: 143200, percentage: 0.4, provisionRate: 100.0, requiredProvision: 143200 },
        totalGrossBook: 35800000,
        totalRequiredProvisions: 898222,
        netLoanPortfolio: 34901778,
        onlineNpaRatio: 3.4
      },

      auditTrail: [
        {
          id: 'AUD-8801',
          timestamp: '2026-08-28T14:48:12',
          userId: 'USR-102',
          userName: 'David Ochieng',
          action: 'POST_MEMBER_DEPOSIT',
          module: 'Core Banking (Layer 0)',
          entityId: 'TX-902 / MEM-1001',
          description: 'Credited UGX 12,000 to Sarah Kamau (Savings A/C 4902). Instant GL posted.',
          ipAddress: '192.168.10.45',
          glImpact: 'Dr 1010 Cash UGX 12k / Cr 2010 Deposits UGX 12k'
        },
        {
          id: 'AUD-8802',
          timestamp: '2026-08-28T14:15:30',
          userId: 'USR-101',
          userName: 'Faith Mwangi',
          action: 'EOD_VAULT_RECONCILE',
          module: 'Branch FOSA (Layer 2)',
          entityId: 'br-01',
          description: 'Nairobi Central Vault physical cash count verified at UGX 285,000.',
          ipAddress: '192.168.10.10',
          glImpact: 'None (Balance Verified)'
        },
        {
          id: 'AUD-8803',
          timestamp: '2026-08-28T13:10:05',
          userId: 'USR-301',
          userName: 'Caroline Wanjala',
          action: 'INTER_ACCOUNT_SWEEP',
          module: 'Treasury (Layer 3)',
          entityId: 'TX-904',
          description: 'Transferred UGX 150,000 branch excess cash from Nairobi Central to Stanbic Clearing Acc.',
          ipAddress: '192.168.1.100',
          glImpact: 'Dr 1020 Stanbic UGX 150k / Cr 1010 Branch Vault UGX 150k'
        }
      ],

      branches: [
        {
          id: 'br-01',
          name: 'Nairobi Central Branch',
          code: 'NBC-01',
          tellerCount: 4,
          vaultLimit: 500000,
          cashInVault: 285000,
          tellerCashLimit: 30000, // Max per-transaction cash authority for tellers; set by Branch Manager
          tillBalances: [
            { tellerId: 'T-101', tellerName: 'Senior Counter Float', balance: 34500, status: 'Reconciled' },
            { tellerId: 'T-102', userId: 'USR-102', tellerName: 'David Ochieng', balance: 41200, status: 'Reconciled' },
            { tellerId: 'T-103', tellerName: 'Mercy Chebet', balance: 29800, status: 'Reconciled' },
            { tellerId: 'T-104', tellerName: 'Kevin Mutua', balance: 38000, status: 'Reconciled' }
          ],
          lastReconciledAt: '2026-08-28T14:15:00',
          reconciliationDiscrepancy: 0
        },
        {
          id: 'br-02',
          name: 'Mombasa Coastal Hub',
          code: 'MBA-02',
          tellerCount: 3,
          vaultLimit: 400000,
          cashInVault: 195000,
          tellerCashLimit: 25000,
          tillBalances: [
            { tellerId: 'T-201', tellerName: 'Ali Hassan', balance: 28400, status: 'Reconciled' },
            { tellerId: 'T-202', tellerName: 'Fatma Bakari', balance: 31500, status: 'Reconciled' },
            { tellerId: 'T-203', tellerName: 'Johnstone Kazungu', balance: 22100, status: 'Reconciled' }
          ],
          lastReconciledAt: '2026-08-28T13:45:00',
          reconciliationDiscrepancy: 0
        },
        {
          id: 'br-03',
          name: 'Kisumu Western Regional',
          code: 'KSM-03',
          tellerCount: 3,
          vaultLimit: 350000,
          cashInVault: 160000,
          tellerCashLimit: 20000,
          tillBalances: [
            { tellerId: 'T-301', tellerName: 'Beryl Anyango', balance: 26000, status: 'Reconciled' },
            { tellerId: 'T-302', tellerName: 'George Otieno', balance: 24500, status: 'Reconciled' },
            { tellerId: 'T-303', tellerName: 'Lilian Achieng', balance: 19000, status: 'Reconciled' }
          ],
          lastReconciledAt: '2026-08-28T12:30:00',
          reconciliationDiscrepancy: 0
        },
        {
          id: 'br-04',
          name: 'Nakuru Agri Hub',
          code: 'NKR-04',
          tellerCount: 2,
          vaultLimit: 300000,
          cashInVault: 145000,
          tellerCashLimit: 20000,
          tillBalances: [
            { tellerId: 'T-401', tellerName: 'Samuel Kiprop', balance: 31000, status: 'Reconciled' },
            { tellerId: 'T-402', tellerName: 'Grace Wambui', balance: 27500, status: 'Reconciled' }
          ],
          lastReconciledAt: '2026-08-28T14:00:00',
          reconciliationDiscrepancy: 0
        },
        {
          id: 'br-05',
          name: 'Eldoret North Rift',
          code: 'ELD-05',
          tellerCount: 2,
          vaultLimit: 250000,
          cashInVault: 110000,
          tellerCashLimit: 15000,
          tillBalances: [
            { tellerId: 'T-501', tellerName: 'Brian Komen', balance: 22000, status: 'Reconciled' },
            { tellerId: 'T-502', tellerName: 'Gladys Cherono', balance: 25500, status: 'Reconciled' }
          ],
          lastReconciledAt: '2026-08-28T11:45:00',
          reconciliationDiscrepancy: 0
        }
      ],

      bankAccounts: [
        {
          id: 'bnk-01',
          institution: 'Stanbic Bank Kenya',
          accountName: 'Main Operational Clearing Acc',
          accountNumber: '010048892100',
          currency: 'USD',
          balance: 2450000,
          unreconciledItems: 0,
          lastStatementDate: '2026-08-28',
          status: 'Active'
        },
        {
          id: 'bnk-02',
          institution: 'KCB Bank Group',
          accountName: 'Disbursement & Collections Acc',
          accountNumber: '112093847291',
          currency: 'USD',
          balance: 1820000,
          unreconciledItems: 0,
          lastStatementDate: '2026-08-28',
          status: 'Active'
        },
        {
          id: 'bnk-03',
          institution: 'Central Bank / Statutory Reserve',
          accountName: 'Cash Reserve Requirement (CRR)',
          accountNumber: 'CBK-RES-0098',
          currency: 'USD',
          balance: 1200000,
          unreconciledItems: 0,
          lastStatementDate: '2026-08-28',
          status: 'Restricted'
        },
        {
          id: 'bnk-04',
          institution: 'Safaricom M-Pesa Super-Float',
          accountName: 'Digital Channel Liquidity Float',
          accountNumber: 'PAYBILL-899120',
          currency: 'USD',
          balance: 680000,
          unreconciledItems: 0,
          lastStatementDate: '2026-08-28',
          status: 'Active'
        }
      ],

      shortTermInvestments: [
        {
          id: 'inv-01',
          instrument: '91-Day Treasury Bill',
          issuer: 'Central Bank / National Treasury',
          principal: 1500000,
          yieldRate: 11.2,
          maturityDate: '2026-09-30',
          daysToMaturity: 33,
          liquidityClass: 'High (Immediate Discountable)'
        },
        {
          id: 'inv-02',
          instrument: '182-Day Commercial Paper',
          issuer: 'Tier-1 Commercial Bank Placement',
          principal: 1000000,
          yieldRate: 12.8,
          maturityDate: '2026-11-15',
          daysToMaturity: 79,
          liquidityClass: 'Medium'
        }
      ],

      depositLiabilities: {
        totalDeposits: 28500000,
        demandDeposits: 11400000,
        contractualSavings: 8550000,
        fixedTermDeposits: 8550000,
        shareCapital: 4200000
      },

      maturityBuckets: [
        { bucket: '1 - 7 Days', assets: 2850000, liabilities: 2100000 },
        { bucket: '8 - 30 Days', assets: 3600000, liabilities: 2900000 },
        { bucket: '31 - 90 Days', assets: 4900000, liabilities: 4200000 },
        { bucket: '91 - 180 Days', assets: 6200000, liabilities: 5800000 },
        { bucket: '181 - 365 Days', assets: 8400000, liabilities: 7900000 },
        { bucket: '> 1 Year', assets: 14200000, liabilities: 12100000 }
      ],

      externalFacilities: [
        {
          id: 'dfi-01',
          lender: 'International Finance Corp (IFC)',
          facilityType: 'Senior SME Credit Line',
          totalCommitment: 5000000,
          drawnAmount: 3500000,
          availableToDraw: 1500000,
          interestRate: 6.5,
          nextRepaymentDate: '2026-10-15',
          nextRepaymentAmount: 285000,
          nextExpectedDrawdownDate: '2026-09-15',
          nextExpectedDrawdownAmount: 1000000
        },
        {
          id: 'dfi-02',
          lender: 'FMO Dutch Development Bank',
          facilityType: 'Subordinated Tier-2 Facility',
          totalCommitment: 3000000,
          drawnAmount: 3000000,
          availableToDraw: 0,
          interestRate: 7.2,
          nextRepaymentDate: '2026-12-01',
          nextRepaymentAmount: 190000,
          nextExpectedDrawdownDate: null,
          nextExpectedDrawdownAmount: 0
        }
      ],

      operatingExpenses: [
        { id: 'opx-01', category: 'Staff Payroll & Benefits', monthlyAmount: 320000, dueDayOfMonth: 25 },
        { id: 'opx-02', category: 'Branch Office Rent & Rates', monthlyAmount: 85000, dueDayOfMonth: 1 },
        { id: 'opx-03', category: 'Core Banking & IT Infrastructure', monthlyAmount: 45000, dueDayOfMonth: 10 },
        { id: 'opx-04', category: 'Branch Security & CIT Cash Transport', monthlyAmount: 35000, dueDayOfMonth: 15 },
        { id: 'opx-05', category: 'Statutory Taxes & Regulatory Levies', monthlyAmount: 55000, dueDayOfMonth: 20 }
      ],

      portfolioQuality: {
        totalGrossLoanPortfolio: 35800000,
        activeBorrowers: 14280,
        currentPerformingPct: 92.4,
        par30Pct: 4.2,
        par60Pct: 2.1,
        par90Pct: 1.3,
        historicalRepaymentEfficiency: 95.8,
        branchBreakdown: [
          { branchName: 'Nairobi Central', portfolio: 14200000, par30: 3.1, par90: 0.9, repaymentRate: 97.2 },
          { branchName: 'Mombasa Coastal', portfolio: 8500000, par30: 4.6, par90: 1.4, repaymentRate: 95.1 },
          { branchName: 'Kisumu Western', portfolio: 5400000, par30: 5.8, par90: 2.2, repaymentRate: 93.4 },
          { branchName: 'Nakuru Agri Hub', portfolio: 4600000, par30: 3.9, par90: 1.1, repaymentRate: 96.5 },
          { branchName: 'Eldoret North Rift', portfolio: 3100000, par30: 4.8, par90: 1.6, repaymentRate: 94.8 }
        ]
      },

      disbursementQueue: [
        {
          id: 'DISB-8901',
          clientName: 'Baraka Green Agri-Cooperative',
          memberId: 'MEM-1001',
          branch: 'Nakuru Agri Hub',
          product: 'Agri Asset Finance',
          amount: 180000,
          appliedDate: '2026-08-20',
          creditScore: 820,
          expectedYield: 18.5,
          urgency: 'High',
          status: 'Approved - Pending Pacing',
          staggeredBatch: 'Batch 1'
        },
        {
          id: 'DISB-8902',
          clientName: 'Savannah Logistics Transporters',
          memberId: 'MEM-1002',
          branch: 'Mombasa Coastal Hub',
          product: 'Commercial SME Working Capital',
          amount: 250000,
          appliedDate: '2026-08-22',
          creditScore: 790,
          expectedYield: 19.0,
          urgency: 'High',
          status: 'Approved - Pending Pacing',
          staggeredBatch: 'Batch 1'
        },
        {
          id: 'DISB-8903',
          clientName: 'Apex Health Pharmaceuticals',
          memberId: 'MEM-1003',
          branch: 'Nairobi Central Branch',
          product: 'Micro-Enterprise Growth Loan',
          amount: 120000,
          appliedDate: '2026-08-25',
          creditScore: 845,
          expectedYield: 21.0,
          urgency: 'Medium',
          status: 'Approved - Pending Pacing',
          staggeredBatch: 'Batch 2'
        },
        {
          id: 'DISB-8904',
          clientName: 'Rift Valley Fresh Dairies',
          memberId: 'MEM-1004',
          branch: 'Eldoret North Rift',
          product: 'Agri Supply Chain Line',
          amount: 210000,
          appliedDate: '2026-08-26',
          creditScore: 765,
          expectedYield: 17.5,
          urgency: 'Medium',
          status: 'Approved - Pending Pacing',
          staggeredBatch: 'Batch 2'
        },
        {
          id: 'DISB-8905',
          clientName: 'Eldo Clean Energy Solar SACCO',
          memberId: 'MEM-1003',
          branch: 'Eldoret North Rift',
          product: 'Green Energy Financing',
          amount: 150000,
          appliedDate: '2026-08-27',
          creditScore: 810,
          expectedYield: 16.0,
          urgency: 'Low',
          status: 'Under Credit Review',
          staggeredBatch: 'Batch 3'
        },
        {
          id: 'DISB-8906',
          clientName: 'Victoria Fish Traders Association',
          memberId: 'MEM-1002',
          branch: 'Kisumu Western Regional',
          product: 'Micro Group Guarantee Loan',
          amount: 95000,
          appliedDate: '2026-08-27',
          creditScore: 780,
          expectedYield: 22.5,
          urgency: 'Medium',
          status: 'Approved - Pending Pacing',
          staggeredBatch: 'Batch 2'
        }
      ],

      loanProducts: [
        { id: 'PROD-AGRI', name: 'Agri Asset Finance', annualInterestRate: 18.5, rateConfigured: false, repaymentMethod: 'reducing', penaltyGraceDays: 0, penaltyFixedFee: 0, penaltyDailyRate: 0 },
        { id: 'PROD-SME', name: 'Commercial SME Working Capital', annualInterestRate: 19.0, rateConfigured: false, repaymentMethod: 'reducing', penaltyGraceDays: 0, penaltyFixedFee: 0, penaltyDailyRate: 0 },
        { id: 'PROD-MICRO', name: 'Micro-Enterprise Growth Loan', annualInterestRate: 21.0, rateConfigured: false, repaymentMethod: 'flat', penaltyGraceDays: 0, penaltyFixedFee: 0, penaltyDailyRate: 0 },
        { id: 'PROD-GREEN', name: 'Green Solar SACCO Expansion', annualInterestRate: 16.0, rateConfigured: false, repaymentMethod: 'reducing', penaltyGraceDays: 0, penaltyFixedFee: 0, penaltyDailyRate: 0 },
        { id: 'PROD-AUTO', name: 'Asset Finance Vehicle Line', annualInterestRate: 17.5, rateConfigured: false, repaymentMethod: 'reducing', penaltyGraceDays: 0, penaltyFixedFee: 0, penaltyDailyRate: 0 }
      ],
      loanPenaltyPolicyVersion: 1,

      stressTesting: {
        withdrawalSpikePct: 15.0,
        repaymentDropPct: 10.0,
        dfiDrawdownDelayDays: 30,
        interestRateHikeBps: 150
      },

      alerts: [
        {
          id: 'ALT-101',
          level: 'Warning',
          title: 'Watchlist Loan In Arrears (Joseph Mwangi)',
          message: 'LN-5504 has reached 48 days in arrears (UGX 98,000 balance). Automatic Substandard NPA provision active.',
          timestamp: '2026-08-28T12:35:00',
          tier: 'Credit',
          acknowledged: false
        },
        {
          id: 'ALT-102',
          level: 'Info',
          title: 'IFC DFI Facility Amortization Due in 48 Days',
          message: 'Quarterly principal repayment of UGX 285,000 scheduled for Stanbic Bank clearing account.',
          timestamp: '2026-08-28T09:00:00',
          tier: 'Finance',
          acknowledged: true
        },
        {
          id: 'ALT-103',
          level: 'Safe',
          title: 'SASRA / Central Bank Liquidity Ratio Fully Compliant',
          message: 'Aggregate Liquid Ratio at 25.8% (Statutory floor: 15.0%).',
          timestamp: '2026-08-28T08:00:00',
          tier: 'Board',
          acknowledged: true
        }
      ],

      recentTransactions: [
        { id: 'TX-901', type: 'Loan Repayment', client: 'M-Pesa Bulk Inflow (Paybill 899120)', amount: 48500, time: '14:52', status: 'Completed', channel: 'M-Pesa' },
        { id: 'TX-902', type: 'Member Deposit', client: 'Sarah Kamau (Savings A/C 4902)', amount: 12000, time: '14:48', status: 'Completed', channel: 'Branch FOSA' },
        { id: 'TX-903', type: 'Share Capital', client: 'Eldoret Farmers Union', amount: 25000, time: '14:30', status: 'Completed', channel: 'Agency Banking' },
        { id: 'TX-904', type: 'Branch Cash Transfer', client: 'Nairobi Central -> Stanbic Bank', amount: 150000, time: '13:10', status: 'Completed', channel: 'Treasury' },
        { id: 'TX-905', type: 'Loan Disbursement', client: 'Wanjiku Wholesale Ltd', amount: 80000, time: '11:20', status: 'Completed', channel: 'Bank Transfer' }
      ]
    };
  }

  save(...dirtyKeys) {
    return this._rejectLocalOperationalWrite(true);
  }

  saveLocal() {
    return this._rejectLocalOperationalWrite(true);
  }

  prepareTenantState(schemaName) {
    const localDataKeys = [
      'roles', 'users', 'branches', 'members', 'generalLedger', 'transactions',
      'recentTransactions', 'auditTrail', 'loanProducts', 'loanPenaltyPolicyVersion',
      'ledger', 'trialBalanceExceptions', 'smsAlerts', 'channels', 'workflowTasks',
      'bankAccounts', 'shortTermInvestments', 'depositLiabilities', 'maturityBuckets',
      'externalFacilities', 'operatingExpenses', 'portfolioQuality', 'disbursementQueue',
      'stressTesting', 'alerts', 'npaSummary'
    ];
    const cleanState = this.getCleanState();
    localDataKeys.forEach(key => {
      this.state[key] = JSON.parse(JSON.stringify(cleanState[key]));
    });
    this.state.selectedMemberId = null;
    this.state.institution.schemaName = schemaName;
  }

  _rejectLocalOperationalWrite(notify = false) {
    if (notify) this.notify();
    return false;
  }

  // Operational records must never be persisted in browser storage.
  saveQuiet(...dirtyKeys) {
    return this._rejectLocalOperationalWrite();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try {
        cb(this.state);
      } catch (e) {
        console.error('Error in store listener callback:', e);
      }
    });
  }

  // --- Active User & Role Management ---
  getCurrentUser() {
    return this.state.users.find(u => u.id === this.state.currentUserId) || this.state.users[0];
  }

  getCurrentTellerTill(customState) {
    const s = customState || this.state;
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;

    const branch = s.branches.find(b => b.id === (currentUser.branchId || s.selectedBranchId)) || s.branches[0];
    if (!branch || !branch.tillBalances) return null;

    let till = branch.tillBalances.find(t => 
      (t.userId && t.userId === currentUser.id) ||
      (currentUser.tellerId && t.tellerId === currentUser.tellerId) ||
      (t.tellerName && t.tellerName.toLowerCase().trim() === currentUser.name.toLowerCase().trim())
    );

    return till ? { ...till, branchId: branch.id, branchName: branch.name } : null;
  }

  setCurrentUser(userId) {
    const user = this.state.users.find(u => u.id === userId);
    if (!user) return false;

    this.state.currentUserId = userId;
    const firstRoleId = user.roles && user.roles.length > 0 ? user.roles[0] : null;
    const roleObj = this.state.roles.find(r => r.id === firstRoleId);
    this.state.currentRole = roleObj ? roleObj.category : null;
    this.state.selectedBranchId = user.branchId;
    return true;
  }

  addUser(userData) {
    throw new Error('Tenant user provisioning must use the authenticated server-side invitation service.');
  }

  async updateUserRoles(userId, newRoles, options = {}) {
    return window.Platform.executeDomainAction('update_user_roles', { userId, roles: newRoles }, options);
  }

  async updateUserStatus(userId, newStatus, options = {}) {
    return window.Platform.executeDomainAction('update_user_status', { userId, status: newStatus }, options);
  }

  setRole(role) {
    this.state.currentRole = role;
    this.save();
  }

  setForecastHorizon(horizon) {
    this.state.forecastHorizon = horizon;
    this.save();
  }

  setSelectedBranch(branchId) {
    this.state.selectedBranchId = branchId;
    this.save();
  }

  setSelectedMember(memberId) {
    this.state.selectedMemberId = memberId;
    this.save();
  }

  validateTransactionRequest({ type, memberId, loanId, amount, channel = 'Branch FOSA', glDebitCode, glCreditCode, description, legs }) {
    if (!type) {
      return { valid: false, error: 'Transaction type is required.' };
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return { valid: false, error: 'Transaction amount must be greater than zero.' };
    }

    // Verify legs if multi-leg, else check 2-leg codes
    if (legs && Array.isArray(legs) && legs.length >= 2) {
      const legVal = typeof CoreBankingEngine !== 'undefined' ? CoreBankingEngine.validatePostingLegs(legs) : { valid: true };
      if (!legVal.valid) {
        return { valid: false, error: legVal.error };
      }
    } else if (!glDebitCode || !glCreditCode) {
      return { valid: false, error: 'Incomplete transaction payload: GL Debit and Credit accounts are required.' };
    }

    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.status !== 'Active') {
      return { valid: false, error: 'Active user session required.' };
    }

    // Contextual RBAC permission validation
    if (typeof UserManagementEngine !== 'undefined') {
      const isCounterChannel = (channel || '').includes('Branch FOSA') || (channel || '').includes('FOSA Counter') || type.startsWith('Teller ');
      const isTreasuryTx = (channel || '').includes('Treasury') || type.includes('DFI') || type.includes('Sweep') || type.includes('Placement') || type.includes('T-Bill');
      const isDisbursement = type.includes('Disbursement');
      const isMobileTx = (channel || '').includes('M-Pesa') || (channel || '').includes('Mobile');
      const isEOD = type.includes('EOD') || type.includes('Accrual');
      const isBatch = (channel || '').includes('Batch') || (channel || '').includes('Ingestion') || (channel || '').includes('MIS');

      const roles = UserManagementEngine.getUserRoles(this.state, currentUser.id);
      const perms = roles.flatMap(r => r.permissions || []);

      let hasPermission = false;
      if (perms.includes('READ_ALL_MODULES') || (currentUser.roles && currentUser.roles.includes('ROLE-ADMIN'))) {
        hasPermission = true;
      } else if (isBatch) {
        hasPermission = perms.some(p => ['POST_COUNTER_TX', 'MODIFY_GL_JOURNAL', 'APPROVE_CREDIT_FACILITY', 'EXECUTE_DFI_DRAWDOWN', 'ORIGINATE_LOAN_APP'].includes(p));
      } else if (isCounterChannel) {
        hasPermission = perms.includes('POST_COUNTER_TX');
      } else if (isTreasuryTx) {
        hasPermission = perms.includes('MODIFY_GL_JOURNAL') || perms.includes('EXECUTE_DFI_DRAWDOWN') || perms.includes('PLACE_TBILLS');
      } else if (isDisbursement) {
        hasPermission = perms.includes('APPROVE_CREDIT_FACILITY') || perms.includes('PACING_RELEASE_AUTHORIZE') || perms.includes('APPROVE_BRANCH_LOAN_TIER1');
      } else if (isMobileTx) {
        hasPermission = perms.includes('MPESA_MOBILE_DEPOSIT') || perms.includes('POST_COUNTER_TX');
      } else if (isEOD) {
        hasPermission = perms.includes('RUN_PARALLEL_EOD') || perms.includes('MODIFY_GL_JOURNAL');
      } else {
        hasPermission = perms.some(p => ['POST_COUNTER_TX', 'MODIFY_GL_JOURNAL', 'EXECUTE_DFI_DRAWDOWN', 'APPROVE_CREDIT_FACILITY'].includes(p));
      }

      if (!hasPermission) {
        return { valid: false, error: `Operator ${currentUser.name} lacks authority to post ${type} transactions.` };
      }
    }

    if (memberId) {
      const member = this.state.members.find(m => m.id === memberId);
      if (!member) {
        return { valid: false, error: 'Selected member not found.' };
      }

      if (type.includes('Withdrawal') && member.savingsBalance < parsedAmount) {
        return { valid: false, error: `Insufficient member savings balance of ${Formatter.money(member.savingsBalance)}.` };
      }

      if ((type.includes('Loan Payment') || type.includes('Repayment')) && loanId) {
        const loan = member.activeLoans?.find(l => l.loanId === loanId || l.id === loanId);
        if (!loan) {
          return { valid: false, error: 'Selected loan account is not found for the member.' };
        }
        if (loan.outstandingBalance < parsedAmount) {
          return { valid: false, error: `Repayment exceeds outstanding balance of ${Formatter.money(loan.outstandingBalance)}.` };
        }
      }
    }

    if ((channel || '').includes('Branch FOSA') || (channel || '').includes('FOSA Counter') || type.startsWith('Teller ')) {
      const branch = this.state.branches.find(b => b.id === (currentUser.branchId || this.state.selectedBranchId)) || this.state.branches[0];
      if (!branch) {
        return { valid: false, error: 'No valid branch context found for teller posting.' };
      }

      const assignedTill = branch.tillBalances?.find(t => 
        (t.userId && t.userId === currentUser.id) ||
        (currentUser.tellerId && t.tellerId === currentUser.tellerId) ||
        (t.tellerName && t.tellerName.toLowerCase().trim() === currentUser.name.toLowerCase().trim())
      );

      const roles = typeof UserManagementEngine !== 'undefined' ? UserManagementEngine.getUserRoles(this.state, currentUser.id) : [];
      const perms = roles.flatMap(r => r.permissions || []);
      const isAdmin = perms.includes('READ_ALL_MODULES') || (currentUser.roles && currentUser.roles.includes('ROLE-ADMIN'));

      if (!assignedTill && !isAdmin) {
        return { valid: false, error: `Operator ${currentUser.name} is not assigned to an active till drawer at ${branch.name}. Only assigned tellers may post counter cash.` };
      }

      // Check physical till float for cash withdrawals
      if (assignedTill && type.includes('Withdrawal') && assignedTill.balance < parsedAmount) {
        return { valid: false, error: `Till Cash Shortfall: Drawer ${assignedTill.tellerId} only holds ${Formatter.money(assignedTill.balance)} float.` };
      }

      // Check single approval limit for teller
      if (currentUser.singleApprovalLimit > 0 && parsedAmount > currentUser.singleApprovalLimit && !isAdmin) {
        return { valid: false, error: `Amount ${Formatter.money(parsedAmount)} exceeds teller single transaction limit of ${Formatter.money(currentUser.singleApprovalLimit)}. Supervisor override required.` };
      }
    }

    return { valid: true, currentUser };
  }

  // --- Real-time Double-Entry Posting Action ---
  postTransaction({ type, memberId, loanId, amount, channel = 'Branch FOSA', glDebitCode, glCreditCode, description, legs, bankAccountId }) {
    if (!window.Platform?.hasOperationalAccess() ||
        typeof window.Platform?.postFinancialTransaction !== 'function') {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Financial posting is disabled: no authorized online atomic posting service is deployed.', 'danger');
      }
      this._rejectLocalOperationalWrite();
      return false;
    }
    const parsedAmount = Number(amount);
    const validation = this.validateTransactionRequest({
      type,
      memberId,
      loanId,
      amount: parsedAmount,
      channel,
      glDebitCode,
      glCreditCode,
      description,
      legs
    });

    if (!validation.valid) {
      console.warn('[Transaction Validation Failed]', validation.error);
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`Post Rejected: ${validation.error}`, 'danger');
      }
      return false;
    }

    const currentUser = validation.currentUser;

    // Determine posting legs
    let postingLegs = legs;
    if (!postingLegs || !Array.isArray(postingLegs)) {
      postingLegs = [
        { glCode: glDebitCode || '1010', type: 'Debit', amount: parsedAmount },
        { glCode: glCreditCode || '2010', type: 'Credit', amount: parsedAmount }
      ];
    }

    // Execute via CoreBankingEngine Double-Entry Posting Engine
    let postResult;
    if (typeof CoreBankingEngine !== 'undefined') {
      postResult = CoreBankingEngine.executePosting(this.state, {
        type,
        description: description || `${type} of ${Formatter.money(parsedAmount)} via ${channel}`,
        legs: postingLegs,
        channel,
        memberId,
        loanId,
        user: currentUser
      });

      if (!postResult.success) {
        console.error('[Double-Entry Rejection]', postResult.error);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Post Rejected: ${postResult.error}`, 'danger');
        }
        return false;
      }
    } else {
      return false;
    }

    const txId = postResult.txId;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Synchronize Member Sub-Ledger Account if applicable
    if (memberId) {
      const member = this.state.members.find(m => m.id === memberId);
      if (member) {
        if (type.includes('Fixed Term')) {
          member.savingsBalance = Math.max(0, member.savingsBalance - parsedAmount);
          member.fixedDepositBalance = (member.fixedDepositBalance || 0) + parsedAmount;
        } else if (type.includes('Deposit') || type.includes('Dividend')) {
          member.savingsBalance += parsedAmount;
        } else if (type.includes('Withdrawal') || type.includes('Fee') || type.includes('Service Charge')) {
          member.savingsBalance = Math.max(0, member.savingsBalance - parsedAmount);
        } else if (type.includes('Share Capital')) {
          member.shareCapital += parsedAmount;
        } else if (type.includes('Repayment') || type.includes('Payment')) {
          const loan = loanId ? member.activeLoans?.find(l => l.loanId === loanId || l.id === loanId) : member.activeLoans?.[0];
          if (loan) {
            loan.outstandingBalance = Math.max(0, loan.outstandingBalance - parsedAmount);
            loan.paymentHistory ||= [];
            loan.paymentHistory.push({
              transactionId: txId,
              amount: parsedAmount,
              postedAt: new Date().toISOString(),
              channel: channel || ''
            });
            this.applyLoanPaymentsToSchedule(loan);
          }
        } else if (type.includes('Disbursement')) {
          if (!member.activeLoans) member.activeLoans = [];
          const existingLoan = member.activeLoans.find(l => l.loanId === loanId || l.id === loanId);
          if (!existingLoan) {
            member.activeLoans.push({
              loanId: loanId || `LN-${Date.now().toString().slice(-4)}`,
              product: description || 'Member Credit Facility',
              principal: parsedAmount,
              outstandingBalance: parsedAmount,
              monthlyInstallment: Math.round((parsedAmount * 1.14) / 12),
              interestRate: 14.0,
              npaClassification: 'Normal (Performing)',
              daysInArrears: 0,
              nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            });
          }
        }
      }
    }

    // Synchronize Cash Vault, Float & Bank Balances directly from Double-Entry Legs
    postingLegs.forEach(leg => {
      const legAmt = Number(leg.amount) || 0;
      // GL 1010: Physical Branch Vault & Till Cash
      if (leg.glCode === '1010') {
        const branch = this.state.branches.find(b => b.id === (currentUser.branchId || this.state.selectedBranchId)) || this.state.branches[0];
        if (branch) {
          const delta = (leg.type === 'Debit' ? legAmt : -legAmt);
          const isCounter = (channel || '').includes('Branch FOSA') || (channel || '').includes('Counter') || type.startsWith('Teller ');
          if (isCounter && branch.tillBalances) {
            const assignedTill = branch.tillBalances.find(t => 
              (t.userId && t.userId === currentUser.id) ||
              (currentUser.tellerId && t.tellerId === currentUser.tellerId) ||
              (t.tellerName && t.tellerName.toLowerCase().trim() === currentUser.name.toLowerCase().trim())
            );
            if (assignedTill) {
              assignedTill.balance = Math.max(0, assignedTill.balance + delta);
              assignedTill.status = 'Intraday Active';
            } else {
              branch.cashInVault += delta;
            }
          } else {
            branch.cashInVault += delta;
          }
        }
      }
      // GL 1040: Digital Channel & M-Pesa Float Pool
      if (leg.glCode === '1040') {
        const mpesaChannel = this.state.channels.find(c => c.id === 'ch-mpesa');
        if (mpesaChannel) {
          mpesaChannel.liveBalance += (leg.type === 'Debit' ? legAmt : -legAmt);
          mpesaChannel.dailyTurnover = (mpesaChannel.dailyTurnover || 0) + legAmt;
        }
      }
      // GL 1020: Commercial Bank Clearing Accounts
      if (leg.glCode === '1020') {
        const bank = this.state.bankAccounts?.find(account => account.id === bankAccountId) || this.state.bankAccounts?.[0];
        if (bank) {
          bank.balance += (leg.type === 'Debit' ? legAmt : -legAmt);
        }
      }
    });

    // Add to transaction stream
    this.state.recentTransactions.unshift({
      id: txId,
      type,
      client: memberId ? `${this.state.members.find(m => m.id === memberId)?.name || memberId}` : (description || type),
      amount: parsedAmount,
      time: timeStr,
      status: 'Completed',
      channel
    });

    // Add to system audit trail
    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.name} (${currentUser.role || 'Operator'})`,
      action: type.toUpperCase().replace(/\s+/g, '_'),
      module: 'Core Banking Engine (Layer 0)',
      entityId: txId,
      description: `${description || type} of ${Formatter.money(parsedAmount)} via ${channel}`,
      ipAddress: '192.168.10.45',
      glImpact: postResult.glImpact
    });

    // Use saveQuiet: persist state without triggering full re-render.
    this.saveQuiet();
    return txId;
  }

  // --- External Funding & DFI Drawdowns ---
  recordDFIDrawdown({ facilityId, amount, destinationBankId, notes }) {
    const facility = this.state.externalFacilities.find(f => f.id === facilityId);
    const bank = this.state.bankAccounts.find(b => b.id === destinationBankId) || this.state.bankAccounts[0];
    const currentUser = this.getCurrentUser();
    const parsedAmount = Number(amount);
    if (!facility || !bank || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > facility.availableToDraw) return false;

    // Post to GL through Double-Entry Engine: Dr 1020 Commercial Bank / Cr 2200 External DFI Borrowing
    const postResult = this.postTransaction({
      type: 'DFI Facility Drawdown',
      amount: parsedAmount,
      channel: 'Treasury Wire',
      glDebitCode: '1020',
      glCreditCode: '2200',
      bankAccountId: bank.id,
      description: `Drawdown of ${Formatter.money(amount)} from ${facility.lender} into ${bank.institution}. ${notes || ''}`
    });

    if (!postResult) return false;
    facility.drawnAmount += parsedAmount;
    facility.availableToDraw = Math.max(0, facility.availableToDraw - parsedAmount);
    this.saveQuiet();
    return true;
  }

  addExternalFacility(facilityData) {
    const newFacility = {
      id: `dfi-${Date.now().toString().slice(-3)}`,
      lender: facilityData.lender,
      facilityType: facilityData.facilityType,
      totalCommitment: Number(facilityData.commitment),
      drawnAmount: 0,
      availableToDraw: Number(facilityData.commitment),
      interestRate: Number(facilityData.interestRate),
      nextRepaymentDate: facilityData.firstRepaymentDate,
      nextRepaymentAmount: Number(facilityData.repaymentAmount),
      nextExpectedDrawdownDate: facilityData.expectedDrawdownDate || null,
      nextExpectedDrawdownAmount: Number(facilityData.expectedDrawdownAmount) || 0
    };

    this.state.externalFacilities.push(newFacility);

    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: this.state.currentUserId,
      userName: this.getCurrentUser().name,
      action: 'NEW_DFI_FACILITY_REGISTERED',
      module: 'External Funding (Layer 2)',
      entityId: newFacility.id,
      description: `Registered new facility from ${newFacility.lender} (${Formatter.money(newFacility.totalCommitment)})`,
      ipAddress: '192.168.1.100',
      glImpact: 'Facility registered (Off-Balance Sheet until drawn)'
    });

    this.save();
    return newFacility.id;
  }

  async addMember(memberData) {
    if (!window.Platform?.createMember) {
      throw new Error('No authorized online member creation service is available.');
    }
    const result = await window.Platform.createMember(memberData);
    return Object.assign(result.member, { refreshError: result.refreshError });
  }

  addLoanApplication(formData) {
    const member = this.state.members.find(m => m.id === formData.memberId);
    if (!member) throw new Error('Select a valid member before submitting a loan application.');
    if (!(Number(formData.amount) > 0)) throw new Error('Requested principal must be greater than zero.');
    if (!(Number(formData.term) > 0)) throw new Error('Loan term must be greater than zero.');
    const disbId = `LNAPP-${Date.now().toString(36).toUpperCase()}`;
    const currentUser = this.getCurrentUser();
    const product = (this.state.loanProducts || []).find(item => item.id === formData.productId) ||
      (this.state.loanProducts || []).find(item => item.name === formData.product);
    if (!product) throw new Error('Select a valid loan product.');
    if (product.rateConfigured === false) {
      throw new Error('An authorized credit checker must confirm this product rate before an application can be submitted.');
    }

    const newLoan = {
      id: disbId,
      clientName: member ? member.name : formData.clientName,
      memberId: formData.memberId,
      branch: formData.branch || 'Nairobi Central Branch',
      product: formData.product,
      productId: product.id,
      amount: Number(formData.amount),
      purpose: String(formData.purpose || '').trim(),
      termMonths: Number(formData.term),
      guarantorMemberId: formData.guarantorMemberId || null,
      appliedDate: new Date().toISOString().split('T')[0],
      creditScore: Number(formData.creditScore) || 800,
      expectedYield: Number(product.annualInterestRate) || 0,
      annualInterestRate: Number(product.annualInterestRate) || 0,
      repaymentMethod: product.repaymentMethod || 'reducing',
      penaltyPolicy: {
        graceDays: Number(product.penaltyGraceDays) || 0,
        fixedFee: Number(product.penaltyFixedFee) || 0,
        dailyRate: Number(product.penaltyDailyRate) || 0,
        version: Number(this.state.loanPenaltyPolicyVersion) || 1
      },
      urgency: formData.urgency || 'Medium',
      status: 'Application Submitted',
      staggeredBatch: null
    };

    this.state.disbursementQueue.unshift(newLoan);

    // Create Maker-Checker workflow task
    newLoan.workflowTaskId = WorkflowEngine.createTask({
      type: 'Loan Application Review',
      entityId: disbId,
      title: `${formData.product} - ${newLoan.clientName}`,
      amount: Number(formData.amount),
      requestedBy: `${currentUser.name} (${currentUser.role})`,
      makerUserId: currentUser.id,
      approverRole: 'Credit/Loans',
      priority: formData.urgency || 'Medium'
    });

    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'LOAN_APPLICATION_SUBMITTED',
      module: 'Credit & Loans',
      entityId: disbId,
      description: `Submitted ${formData.product} application for ${newLoan.clientName}: ${Formatter.money(newLoan.amount)} over ${newLoan.termMonths} months.`,
      ipAddress: '192.168.10.15',
      glImpact: 'Pending Disbursement Approval'
    });

    this.save();
    return disbId;
  }

  addOperatingExpense(opExData) {
    const newOpEx = {
      id: `opx-${Date.now().toString().slice(-3)}`,
      category: opExData.category,
      monthlyAmount: Number(opExData.amount),
      dueDayOfMonth: Number(opExData.dueDay) || 15
    };

    this.state.operatingExpenses.push(newOpEx);

    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: this.state.currentUserId,
      userName: this.getCurrentUser().name,
      action: 'OPEX_SCHEDULE_ADDED',
      module: 'Forecasting & OpEx (Layer 3)',
      entityId: newOpEx.id,
      description: `Added OpEx line: ${newOpEx.category} (${Formatter.money(newOpEx.monthlyAmount)}/mo)`,
      ipAddress: '192.168.1.20',
      glImpact: 'Included in forecast projections'
    });

    this.save();
    return newOpEx.id;
  }

  ingestBatchTransactions(txList) {
    let count = 0;
    txList.forEach(item => {
      const res = this.postTransaction({
        type: item.type || 'Member Deposit',
        memberId: item.memberId || null,
        loanId: item.loanId || null,
        amount: Number(item.amount),
        channel: item.channel || 'Batch Core MIS Ingestion',
        glDebitCode: item.debitGL || '1010',
        glCreditCode: item.creditGL || '2010',
        description: item.description || `Batch import item #${count + 1}`
      });
      if (res) count++;
    });

    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: this.state.currentUserId,
      userName: this.getCurrentUser().name,
      action: 'BULK_CSV_INGESTION_COMPLETED',
      module: 'Data Ingestion Layer (Layer 0/2)',
      entityId: `BATCH-${Date.now().toString().slice(-4)}`,
      description: `Ingested and posted ${count} batch transactions to GL with zero-batch delay`,
      ipAddress: '127.0.0.1',
      glImpact: `Atomic update of ${count} records`
    });

    this.save();
    return count;
  }

  // --- Maker-Checker Approval with Segregation of Duties (SoD) Enforcement ---
  approveWorkflowTask(taskId, approverRole) {
    const task = this.state.workflowTasks.find(t => t.id === taskId);
    const currentUser = this.getCurrentUser();
    if (!task) return { success: false, error: 'Task not found' };
    if (task.type === 'Loan Application Review') {
      const permissions = UserManagementEngine.getUserRoles(this.state, currentUser?.id).flatMap(role => role.permissions || []);
      if (!currentUser?.roles?.includes('ROLE-ADMIN') && !permissions.includes('APPROVE_CREDIT_FACILITY')) {
        return { success: false, error: 'Credit checker permission is required to approve loan applications.' };
      }
    }

    // Segregation of Duties (SoD) Dual-Control Check
    if (task.makerUserId && task.makerUserId === currentUser.id) {
      return {
        success: false,
        error: 'Segregation of Duties Violation: You cannot approve a workflow task you initiated. A distinct Checker is required.'
      };
    }

    // Limit Check
    if (currentUser.singleApprovalLimit > 0 && task.amount > currentUser.singleApprovalLimit) {
      return {
        success: false,
        error: `Threshold Exceeded: Task amount (${Formatter.money(task.amount)}) exceeds your single approval limit of ${Formatter.money(currentUser.singleApprovalLimit)}. Route to higher authority.`
      };
    }

    task.makerCheckerStatus = 'Approved & Released';
    task.history.push({
      step: 'Final Checker Release',
      user: `${currentUser.name} (${currentUser.role})`,
      action: 'Approved',
      timestamp: new Date().toISOString()
    });

    if (task.type === 'Loan Application Review') {
      this.updateDisbursementStatus(task.entityId, 'Approved - Pending Pacing');
    } else if (task.type === 'Loan Disbursement Release') {
      this.updateDisbursementStatus(task.entityId, 'Disbursed');
    }

    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.name} (${currentUser.role})`,
      action: 'WORKFLOW_TASK_APPROVED',
      module: 'Workflow Engine (Layer 1)',
      entityId: taskId,
      description: `Task ${taskId} (${task.title}) approved for release by ${currentUser.name}`,
      ipAddress: '192.168.1.50',
      glImpact: 'Triggered settlement'
    });

    this.save();
    return { success: true };
  }

  submitBranchReconciliation(branchId, vaultCount, tellerEntries, notes) {
    const branch = this.state.branches.find(b => b.id === branchId);
    const currentUser = this.getCurrentUser();
    if (!branch) return false;

    branch.cashInVault = Number(vaultCount);
    if (tellerEntries && Array.isArray(tellerEntries)) {
      branch.tillBalances = tellerEntries;
    }
    branch.lastReconciledAt = new Date().toISOString();
    
    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'VAULT_RECONCILIATION_SUBMITTED',
      module: 'Branch FOSA (Layer 0/2)',
      entityId: branchId,
      description: `${branch.name} vault physically reconciled to ${Formatter.money(Number(vaultCount))}`,
      ipAddress: '192.168.10.1',
      glImpact: 'Audit verified'
    });

    this.save();
    return true;
  }

  updateDisbursementStatus(loanId, newStatus, batch = null) {
    const item = this.state.disbursementQueue.find(d => d.id === loanId);
    if (!item) return false;
    const previousStatus = item.status;
    if (newStatus === 'Disbursed') {
      const user = this.getCurrentUser();
      const permissions = UserManagementEngine.getUserRoles(this.state, user?.id).flatMap(role => role.permissions || []);
      const canRelease = user?.roles?.includes('ROLE-ADMIN') ||
        permissions.some(permission => ['APPROVE_CREDIT_FACILITY', 'PACING_RELEASE_AUTHORIZE'].includes(permission));
      if (!canRelease) {
        App.showToast('You are not authorized to release a loan.', 'danger');
        return false;
      }
      if (!String(item.status).startsWith('Approved')) {
        App.showToast('Only an approved application can be disbursed.', 'danger');
        return false;
      }
      if (item.workflowTaskId) {
        const task = this.state.workflowTasks.find(workflowTask => workflowTask.id === item.workflowTaskId);
        if (task?.makerCheckerStatus !== 'Approved & Released') {
          App.showToast('Complete maker-checker approval before disbursement.', 'danger');
          return false;
        }
      }
    }
    item.status = newStatus;
    if (batch) item.staggeredBatch = batch;

    if (newStatus === 'Disbursed') {
      if (this.state.bankAccounts && this.state.bankAccounts[1]) {
        this.state.bankAccounts[1].balance -= item.amount;
      }

      // Post through Double-Entry Posting Engine: Dr 1200 Gross Loans / Cr 1020 Commercial Bank Clearing
      const posted = this.postTransaction({
        type: 'Loan Disbursement',
        memberId: item.memberId || null,
        loanId: item.id,
        amount: item.amount,
        channel: 'KCB Bank Clearing',
        glDebitCode: '1200',
        glCreditCode: '1020',
        description: `Loan disbursement of ${Formatter.money(item.amount)} to ${item.clientName} (${item.product})`
      });
      if (!posted) {
        item.status = previousStatus;
        if (this.state.bankAccounts && this.state.bankAccounts[1]) {
          this.state.bankAccounts[1].balance += item.amount;
        }
        this.save();
        return false;
      }
      const member = this.state.members.find(record => record.id === item.memberId);
      const loan = member?.activeLoans?.find(record => record.loanId === item.id);
      if (loan) {
        const termMonths = Number(item.termMonths) || 12;
        const annualRate = Number(item.annualInterestRate ?? item.expectedYield) || 0;
        const monthlyRate = annualRate / 1200;
        const installment = item.repaymentMethod === 'flat'
          ? (item.amount * (1 + (annualRate / 100) * termMonths / 12)) / termMonths
          : (monthlyRate === 0
            ? item.amount / termMonths
            : item.amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)));
        const disbursedDate = new Date();
        const schedule = [];
        let balance = Number(item.amount);
        for (let month = 1; month <= termMonths; month += 1) {
          const dueDate = new Date(disbursedDate);
          dueDate.setMonth(dueDate.getMonth() + month);
          const interest = item.repaymentMethod === 'flat'
            ? Number(item.amount) * monthlyRate
            : balance * monthlyRate;
          const principal = month === termMonths
            ? balance
            : Math.min(balance, Math.max(0, installment - interest));
          schedule.push({
            id: `${item.id}-INST-${month}`,
            dueDate: dueDate.toISOString().slice(0, 10),
            installmentAmount: month === termMonths ? balance + interest : installment,
            principalAmount: principal,
            interestAmount: interest,
            status: 'Due'
          });
          balance = Math.max(0, balance - principal);
        }
        Object.assign(loan, {
          product: item.product,
          principal: Number(item.amount),
          outstandingBalance: Number(item.amount),
          termMonths,
          interestRate: annualRate,
          repaymentMethod: item.repaymentMethod || 'reducing',
          monthlyInstallment: installment,
          repaymentSchedule: schedule,
          nextDueDate: schedule[0]?.dueDate || null,
          penaltyPolicy: { ...(item.penaltyPolicy || {}) },
          penaltyAssessments: [],
          paymentHistory: [],
          disbursedAt: disbursedDate.toISOString()
        });
      }
      item.disbursedAt = new Date().toISOString();
    } else {
      this.save();
    }
    return true;
  }

  updateLoanProduct(productId, values) {
    const currentUser = this.getCurrentUser();
    const permissions = UserManagementEngine.getUserRoles(this.state, currentUser?.id).flatMap(role => role.permissions || []);
    if (!currentUser?.roles?.includes('ROLE-ADMIN') && !permissions.includes('APPROVE_CREDIT_FACILITY')) {
      throw new Error('Only an authorized credit checker can change loan product policies.');
    }
    const product = (this.state.loanProducts || []).find(item => item.id === productId);
    if (!product) throw new Error('Loan product not found.');
    const annualInterestRate = Number(values.annualInterestRate);
    const graceDays = Number(values.penaltyGraceDays);
    const fixedFee = Number(values.penaltyFixedFee);
    const dailyRate = Number(values.penaltyDailyRate);
    if (![annualInterestRate, graceDays, fixedFee, dailyRate].every(Number.isFinite) ||
        annualInterestRate < 0 || graceDays < 0 || fixedFee < 0 || dailyRate < 0) {
      throw new Error('Rates, grace days, and fees must be valid non-negative numbers.');
    }
    if (!['flat', 'reducing'].includes(values.repaymentMethod)) {
      throw new Error('Select a supported repayment method.');
    }

    const previous = { ...product };
    Object.assign(product, {
      annualInterestRate,
      rateConfigured: true,
      penaltyGraceDays: Math.floor(graceDays),
      penaltyFixedFee: fixedFee,
      penaltyDailyRate: dailyRate,
      repaymentMethod: values.repaymentMethod
    });
    this.state.loanPenaltyPolicyVersion = (Number(this.state.loanPenaltyPolicyVersion) || 1) + 1;
    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'LOAN_PRODUCT_POLICY_UPDATED',
      module: 'Credit Product Administration',
      entityId: product.id,
      description: `Updated ${product.name} rates and repayment policy. Prior annual rate ${previous.annualInterestRate}%; new annual rate ${product.annualInterestRate}%.`,
      ipAddress: 'Local application',
      glImpact: 'New applications only; existing accounts retain their saved terms'
    });
    this.save();
    return product;
  }

  addLoanProduct(values) {
    const currentUser = this.getCurrentUser();
    const permissions = UserManagementEngine.getUserRoles(this.state, currentUser?.id).flatMap(role => role.permissions || []);
    if (!currentUser?.roles?.includes('ROLE-ADMIN') && !permissions.includes('APPROVE_CREDIT_FACILITY')) {
      throw new Error('Only an authorized credit checker can add loan products.');
    }
    const name = String(values.name || '').trim();
    if (!name) throw new Error('Enter a loan product name.');
    if ((this.state.loanProducts || []).some(product => product.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A loan product with that name already exists.');
    }
    const annualInterestRate = Number(values.annualInterestRate);
    if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0) {
      throw new Error('Annual interest rate must be a valid non-negative number.');
    }
    if (!['flat', 'reducing'].includes(values.repaymentMethod)) {
      throw new Error('Select a supported repayment method.');
    }
    const product = {
      id: `PROD-${Date.now().toString(36).toUpperCase()}`,
      name,
      annualInterestRate,
      rateConfigured: true,
      repaymentMethod: values.repaymentMethod,
      penaltyGraceDays: Number(values.penaltyGraceDays) || 0,
      penaltyFixedFee: Number(values.penaltyFixedFee) || 0,
      penaltyDailyRate: Number(values.penaltyDailyRate) || 0
    };
    if (![product.penaltyGraceDays, product.penaltyFixedFee, product.penaltyDailyRate].every(Number.isFinite) ||
        product.penaltyGraceDays < 0 || product.penaltyFixedFee < 0 || product.penaltyDailyRate < 0) {
      throw new Error('Penalty settings must be valid non-negative numbers.');
    }
    product.penaltyGraceDays = Math.floor(product.penaltyGraceDays);
    this.state.loanProducts.push(product);
    this.state.loanPenaltyPolicyVersion = (Number(this.state.loanPenaltyPolicyVersion) || 1) + 1;
    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      action: 'LOAN_PRODUCT_CREATED',
      module: 'Credit Product Administration',
      entityId: product.id,
      description: `Created loan product ${product.name} with annual rate ${product.annualInterestRate}% and ${product.repaymentMethod} repayment method.`,
      ipAddress: 'Local application',
      glImpact: 'No posting'
    });
    this.save();
    return product;
  }

  recordLoanPenalty({ memberId, loanId, installmentId, amount, reason }) {
    const user = this.getCurrentUser();
    const permissions = UserManagementEngine.getUserRoles(this.state, user?.id).flatMap(role => role.permissions || []);
    if (!user?.roles?.includes('ROLE-ADMIN') && !permissions.includes('APPROVE_CREDIT_FACILITY')) {
      throw new Error('Only an authorized credit checker can record a loan penalty.');
    }
    const member = this.state.members.find(item => item.id === memberId);
    const loan = member?.activeLoans?.find(item => item.loanId === loanId || item.id === loanId);
    const parsedAmount = Number(amount);
    const notes = String(reason || '').trim();
    if (!loan) throw new Error('Loan account was not found.');
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error('Penalty must be greater than zero.');
    if (!notes) throw new Error('Enter the reason for this penalty.');
    if (!installmentId) throw new Error('A valid overdue instalment is required.');
    loan.penaltyAssessments ||= [];
    const today = new Date().toISOString().slice(0, 10);
    if (loan.penaltyAssessments.some(item =>
      item.installmentId === installmentId && item.assessedAt?.slice(0, 10) === today
    )) {
      throw new Error('A penalty adjustment has already been recorded for this instalment today.');
    }

    const assessment = {
      id: `PEN-${Date.now().toString(36).toUpperCase()}`,
      installmentId,
      amount: parsedAmount,
      reason: notes,
      assessedAt: new Date().toISOString(),
      assessedBy: user.name,
      status: 'Assessed - Unpaid'
    };
    loan.penaltyAssessments.push(assessment);
    this.state.auditTrail.unshift({
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp: assessment.assessedAt,
      userId: user.id,
      userName: user.name,
      action: 'LOAN_PENALTY_ASSESSED',
      module: 'Credit & Collections',
      entityId: loanId,
      description: `Recorded ${Formatter.money(parsedAmount)} penalty on ${loanId}. Reason: ${notes}`,
      ipAddress: 'Local application',
      glImpact: 'Not posted; penalty receivable accounting policy required'
    });
    this.save();
    return assessment;
  }

  applyLoanPaymentsToSchedule(loan) {
    const schedule = loan.repaymentSchedule || [];
    let available = (loan.paymentHistory || [])
      .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
    schedule.forEach(installment => {
      const amount = Number(installment.installmentAmount) || 0;
      installment.paidAmount = Math.min(amount, available);
      installment.outstandingAmount = Math.max(0, amount - installment.paidAmount);
      installment.status = installment.outstandingAmount <= 0.005 ? 'Paid' : 'Due';
      available = Math.max(0, available - amount);
    });
    loan.nextDueDate = schedule.find(installment => installment.status !== 'Paid')?.dueDate || null;
  }

  async addLoanApplication(formData, options = {}) {
    return window.Platform.executeDomainAction('create_loan_application', {
      memberId: formData.memberId,
      productId: formData.productId,
      amount: Number(formData.amount),
      purpose: String(formData.purpose || '').trim(),
      termMonths: Number(formData.term ?? formData.termMonths),
      guarantorMemberId: formData.guarantorMemberId || null,
      urgency: formData.urgency || 'Medium'
    }, options);
  }

  async addLoanProduct(values, options = {}) {
    return window.Platform.executeDomainAction('create_loan_product', {
      name: values.name,
      annualInterestRate: Number(values.annualInterestRate),
      repaymentMethod: values.repaymentMethod,
      penaltyGraceDays: Number(values.penaltyGraceDays) || 0,
      penaltyFixedFee: Number(values.penaltyFixedFee) || 0,
      penaltyDailyRate: Number(values.penaltyDailyRate) || 0
    }, options);
  }

  async updateLoanProduct(productId, values, options = {}) {
    return window.Platform.executeDomainAction('update_loan_product', {
      productId,
      annualInterestRate: Number(values.annualInterestRate),
      repaymentMethod: values.repaymentMethod,
      penaltyGraceDays: Number(values.penaltyGraceDays) || 0,
      penaltyFixedFee: Number(values.penaltyFixedFee) || 0,
      penaltyDailyRate: Number(values.penaltyDailyRate) || 0
    }, options);
  }

  async recordLoanPenalty({ memberId, loanId, installmentId, amount, reason }, options = {}) {
    return window.Platform.executeDomainAction('assess_loan_penalty', {
      memberId, loanId, installmentId, amount: Number(amount), reason: String(reason || '').trim()
    }, options);
  }

  async updateDisbursementStatus(loanId, newStatus, batch = null, options = {}) {
    if (newStatus === 'Disbursed') {
      return window.Platform.executeDomainAction('disburse_loan_application', { applicationId: loanId }, options);
    }
    if (batch) {
      return window.Platform.executeDomainAction('set_loan_pacing', { applicationId: loanId, batch }, options);
    }
    throw new Error('Loan status changes require an authorized online workflow action.');
  }

  async approveWorkflowTask(taskId, approverRole, options = {}) {
    const task = this.state.workflowTasks.find(item => item.id === taskId);
    if (!task || task.type !== 'Loan Application Review') {
      throw new Error('This workflow type is not enabled for online approval.');
    }
    return window.Platform.executeDomainAction('review_loan_application', {
      applicationId: task.entityId, decision: 'Approve', reason: ''
    }, options);
  }

  async submitBranchReconciliation(branchId, vaultCount, tellerEntries, notes, options = {}) {
    if (tellerEntries) throw new Error('Bulk teller-float changes are not enabled; reconcile one authenticated operator till at a time.');
    return window.Platform.executeDomainAction('reconcile_vault', {
      branchId, cashInVault: Number(vaultCount), notes: notes || ''
    }, options);
  }

  async reconcileAssignedTill(balance, options = {}) {
    return window.Platform.executeDomainAction('reconcile_assigned_till', { balance: Number(balance) }, options);
  }

  async recordDFIDrawdown({ facilityId, amount, notes }, options = {}) {
    return window.Platform.executeDomainAction('draw_external_facility', {
      facilityId, amount: Number(amount), notes: notes || ''
    }, options);
  }

  async addExternalFacility(facilityData, options = {}) {
    return window.Platform.executeDomainAction('create_external_facility', facilityData, options);
  }

  async addOperatingExpense(opExData, options = {}) {
    return window.Platform.executeDomainAction('create_operating_expense', {
      category: opExData.category,
      monthlyAmount: Number(opExData.monthlyAmount ?? opExData.amount),
      dueDay: Number(opExData.dueDay) || 15
    }, options);
  }

  async ingestBatchTransactions() {
    throw new Error('Batch ingestion is not enabled; transactions must be individually server-authorized and idempotent.');
  }

  postTransaction() {
    return this._rejectLocalOperationalWrite();
  }

  getCleanState() {
    const base = this.getDefaultState();
    
    // Preserve the tenant's organizational structure and start operational data empty.
    
    // Clear operational lists
    base.members = [];
    base.workflowTasks = [];
    base.auditTrail = [];
    base.transactions = [];
    base.recentTransactions = [];
    base.ledger = [];
    base.trialBalanceExceptions = [];
    base.smsAlerts = [];
    base.disbursementQueue = [];
    base.shortTermInvestments = [];
    base.externalFacilities = [];
    base.operatingExpenses = [];
    base.bankAccounts = [];
    base.channels = [];
    base.alerts = [];
    
    // Zero out ledgers and accounts
    base.generalLedger = base.generalLedger.map(gl => ({ ...gl, balance: 0 }));
    base.branches = base.branches.map(b => ({
      ...b,
      cashInVault: 0,
      tillBalances: b.tillBalances.map(t => ({ ...t, balance: 0, status: 'Reconciled' })),
      reconciliationDiscrepancy: 0
    }));
    base.bankAccounts = base.bankAccounts.map(ba => ({ ...ba, balance: 0, unreconciledItems: 0 }));
    base.channels = base.channels.map(ch => ({ ...ch, liveBalance: 0, dailyTurnover: 0 }));
    base.externalFacilities = base.externalFacilities.map(ef => ({ ...ef, drawnAmount: 0, availableToDraw: ef.totalCommitment, nextRepaymentAmount: 0, nextExpectedDrawdownAmount: 0 }));
    base.maturityBuckets = base.maturityBuckets.map(mb => ({ ...mb, assets: 0, liabilities: 0 }));
    
    base.depositLiabilities = { totalDeposits: 0, demandDeposits: 0, contractualSavings: 0, fixedTermDeposits: 0, shareCapital: 0 };
    base.npaSummary = {
      normal: { amount: 0, percentage: 0, provisionRate: 1.0, requiredProvision: 0 },
      watch: { amount: 0, percentage: 0, provisionRate: 5.0, requiredProvision: 0 },
      substandard: { amount: 0, percentage: 0, provisionRate: 25.0, requiredProvision: 0 },
      doubtful: { amount: 0, percentage: 0, provisionRate: 50.0, requiredProvision: 0 },
      loss: { amount: 0, percentage: 0, provisionRate: 100.0, requiredProvision: 0 },
      totalGrossBook: 0, totalRequiredProvisions: 0, netLoanPortfolio: 0, onlineNpaRatio: 0
    };
    base.portfolioQuality = {
      totalGrossLoanPortfolio: 0, activeBorrowers: 0, currentPerformingPct: 0, par30Pct: 0, par60Pct: 0, par90Pct: 0, historicalRepaymentEfficiency: 0,
      branchBreakdown: []
    };
    
    return base;
  }

}

window.store = new FinageStore();
