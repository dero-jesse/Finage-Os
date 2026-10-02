/**
 * Finage OS v3 - Layer 0: Core Banking Foundation & Double-Entry Posting Engine
 * Enforces the fundamental accounting equation: Assets = Liabilities + Equity + (Income - Expense)
 * Zero-batch posting, strict debits == credits validation, real-time balance validation control
 */

const CoreBankingEngine = {
  // --- Standard SACCO / MFI Chart of Accounts (COA) Definition ---
  CHART_OF_ACCOUNTS_DEF: [
    { code: '1010', name: 'Branch Vault & Till Cash', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Physical cash held across branch vaults and teller tills' },
    { code: '1020', name: 'Commercial Bank Clearing Accounts', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Operational clearing balances held at partner commercial banks' },
    { code: '1030', name: 'Central Bank Statutory Reserve (CRR)', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Mandatory statutory reserve deposits held at the Central Bank' },
    { code: '1040', name: 'Digital Channel & M-Pesa Float Pool', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Mobile money aggregator and digital channel settlement float' },
    { code: '1050', name: 'Short-Term Placements & T-Bills', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Treasury bills, commercial paper, and short-term liquidity placements' },
    { code: '1200', name: 'Gross Performing Loan Portfolio', category: 'Assets', type: 'Asset', normal: 'Debit', description: 'Principal loan balances receivable from members' },
    { code: '1250', name: 'Allowance for Loan Impairment / Loan Loss Reserve', category: 'Assets', type: 'Asset', normal: 'Credit', isContra: true, description: 'Contra-asset reserve for non-performing asset (NPA) provisions' },

    { code: '2010', name: 'Member Demand & Savings Deposits', category: 'Liabilities', type: 'Liability', normal: 'Credit', description: 'FOSA withdrawable member savings and current accounts' },
    { code: '2020', name: 'Member Fixed Term Deposits', category: 'Liabilities', type: 'Liability', normal: 'Credit', description: 'Term deposit liabilities with fixed contractual maturities' },
    { code: '2030', name: 'Contractual SACCO Savings', category: 'Liabilities', type: 'Liability', normal: 'Credit', description: 'Non-withdrawable monthly member contractual savings deposits' },
    { code: '2200', name: 'External DFI Borrowing Facilities (IFC/FMO)', category: 'Liabilities', type: 'Liability', normal: 'Credit', description: 'Senior debt facilities from development finance institutions' },

    { code: '3010', name: 'Member Share Capital (Equity)', category: 'Equity', type: 'Equity', normal: 'Credit', description: 'Permanent member equity share contributions' },
    { code: '3020', name: 'Statutory Reserve Fund', category: 'Equity', type: 'Equity', normal: 'Credit', description: 'Mandatory statutory institutional reserve (SASRA/CBK compliance)' },
    { code: '3030', name: 'Retained Earnings / General Reserves', category: 'Equity', type: 'Equity', normal: 'Credit', description: 'Accumulated operational surplus and unallocated equity reserves' },

    { code: '4010', name: 'Interest Income on Loans', category: 'Income', type: 'Income', normal: 'Credit', description: 'Earned interest yield on member credit facilities' },
    { code: '4020', name: 'Investment Placement Yields', category: 'Income', type: 'Income', normal: 'Credit', description: 'Coupon interest and treasury bill placement income' },
    { code: '4030', name: 'Fees & Commission Income', category: 'Income', type: 'Income', normal: 'Credit', description: 'Transaction processing, ledger fees, and appraisal commissions' },

    { code: '5010', name: 'Staff Salaries & Employee Benefits', category: 'Expenses', type: 'Expense', normal: 'Debit', description: 'Branch and head-office payroll, pensions, and medical cover' },
    { code: '5020', name: 'Branch Operating & Tech Licensing Costs', category: 'Expenses', type: 'Expense', normal: 'Debit', description: 'Core banking software, branch rent, security, and utility expenses' },
    { code: '5030', name: 'Loan Loss Provision Expense', category: 'Expenses', type: 'Expense', normal: 'Debit', description: 'Operating expense charge recognized for loan impairment provisions' },
    { code: '5040', name: 'Interest Expense on Member Deposits', category: 'Expenses', type: 'Expense', normal: 'Debit', description: 'Interest paid on fixed deposits and contractual savings' }
  ],

  /**
   * Predefined debit/credit double-entry rules for all standard SACCO/MFI transaction types
   */
  POSTING_RULES: {
    'Member Deposit': {
      label: 'Member Deposit (Cash / Till)',
      defaultDebit: '1010',
      defaultCredit: '2010',
      requiresMember: true,
      description: 'Deposit credited to member savings against vault/till cash'
    },
    'Member Deposit (Mobile / M-Pesa)': {
      label: 'Member Deposit via M-Pesa Float',
      defaultDebit: '1040',
      defaultCredit: '2010',
      requiresMember: true,
      description: 'Digital C2B mobile money deposit into member savings'
    },
    'Member Withdrawal': {
      label: 'Member Cash Withdrawal',
      defaultDebit: '2010',
      defaultCredit: '1010',
      requiresMember: true,
      description: 'Debit member savings, credit vault/till cash'
    },
    'Loan Disbursement': {
      label: 'Loan Disbursement Release',
      defaultDebit: '1200',
      defaultCredit: '1020',
      requiresMember: true,
      description: 'Establish loan receivable and credit commercial bank clearing'
    },
    'Loan Repayment': {
      label: 'Loan Repayment (Principal & Interest)',
      defaultDebit: '1010',
      defaultCredit: '1200',
      requiresMember: true,
      description: 'Debit cash collected, credit loan asset balance'
    },
    'Share Capital Purchase': {
      label: 'Member Share Capital Subscription',
      defaultDebit: '1010',
      defaultCredit: '3010',
      requiresMember: true,
      description: 'Debit cash, credit permanent member equity share capital'
    },
    'Fixed Term Placement': {
      label: 'Fixed Term Deposit Placement',
      defaultDebit: '2010',
      defaultCredit: '2020',
      requiresMember: true,
      description: 'Transfer demand savings into high-yield fixed term deposit'
    },
    'Dividend Distribution': {
      label: 'Annual Dividend Distribution',
      defaultDebit: '3030',
      defaultCredit: '2010',
      requiresMember: true,
      description: 'Appropriation from retained earnings credited to member savings'
    },
    'Loan Loss Provision': {
      label: 'NPA Loan Loss Provisioning Charge',
      defaultDebit: '5030',
      defaultCredit: '1250',
      requiresMember: false,
      description: 'Debit provision expense (P&L), credit allowance reserve (Contra-Asset)'
    },
    'Fee & Service Charge': {
      label: 'Account Maintenance & Processing Fee',
      defaultDebit: '2010',
      defaultCredit: '4030',
      requiresMember: true,
      description: 'Deduct fee from member savings, credit non-interest fee income'
    },
    'Inter-Account Transfer / Sweep': {
      label: 'Treasury Branch Vault Sweep',
      defaultDebit: '1020',
      defaultCredit: '1010',
      requiresMember: false,
      description: 'Transfer physical branch excess cash into bank clearing account'
    },
    'DFI Facility Drawdown': {
      label: 'DFI External Debt Drawdown',
      defaultDebit: '1020',
      defaultCredit: '2200',
      requiresMember: false,
      description: 'Receive borrowings into bank clearing account, credit DFI liability'
    },
    'EOD Interest Accrual': {
      label: 'Parallel EOD Loan Interest Accrual',
      defaultDebit: '1200',
      defaultCredit: '4010',
      requiresMember: false,
      description: 'Debit loan portfolio receivable, credit earned interest income'
    }
  },

  /**
   * Validates that a posting has >= 2 legs and total debits exactly equal total credits.
   * Rejects any unbalanced post before it can touch the General Ledger.
   */
  validatePostingLegs(legs) {
    if (!Array.isArray(legs) || legs.length < 2) {
      return {
        valid: false,
        error: 'Double-entry rule violation: A valid posting must contain at least 2 legs (>= 1 Debit and >= 1 Credit).'
      };
    }

    let sumDebits = 0;
    let sumCredits = 0;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const amount = Number(leg.amount);
      if (isNaN(amount) || amount <= 0) {
        return {
          valid: false,
          error: `Invalid posting amount for leg ${i + 1} (${leg.glCode || 'Unknown GL'}): Amount must be greater than zero.`
        };
      }
      if (!leg.glCode) {
        return {
          valid: false,
          error: `Missing GL account code for leg ${i + 1}.`
        };
      }
      if (leg.type === 'Debit') {
        sumDebits += amount;
      } else if (leg.type === 'Credit') {
        sumCredits += amount;
      } else {
        return {
          valid: false,
          error: `Invalid leg entry type "${leg.type}". Must be "Debit" or "Credit".`
        };
      }
    }

    const variance = Math.abs(sumDebits - sumCredits);
    // Allow max variance of $0.001 for floating point rounding
    if (variance > 0.001) {
      return {
        valid: false,
        error: `Unbalanced transaction rejected: Total Debits (${sumDebits.toFixed(2)}) do not equal Total Credits (${sumCredits.toFixed(2)}). Variance: ${variance.toFixed(2)}.`
      };
    }

    return {
      valid: true,
      sumDebits,
      sumCredits,
      variance: 0
    };
  },

  /**
   * Double-Entry Posting Engine:
   * Executes an atomic multi-leg balanced posting directly into the General Ledger.
   * Updates GL balances according to normal account conventions, then immediately validates the ledger.
   */
  executePosting(state, { type, description, legs, channel = 'Branch FOSA', memberId = null, loanId = null, user = null }) {
    // 1. Strict validation of double-entry equation
    const validation = this.validatePostingLegs(legs);
    if (!validation.valid) {
      console.error('[Double-Entry Posting Engine Rejected]', validation.error);
      return {
        success: false,
        error: validation.error
      };
    }

    // 2. Resolve accounts and apply updates atomically
    const appliedUpdates = [];
    for (const leg of legs) {
      const glAcc = state.generalLedger.find(g => g.code === leg.glCode);
      if (!glAcc) {
        return {
          success: false,
          error: `GL account code ${leg.glCode} does not exist in Chart of Accounts.`
        };
      }
      if (!['Debit', 'Credit'].includes(glAcc.normal)) {
        return {
          success: false,
          error: `GL account ${leg.glCode} must have a Debit or Credit normal balance before it can be posted.`
        };
      }

      const amount = Number(leg.amount);
      const currentBalance = Number(glAcc.balance ?? 0);
      if (!Number.isFinite(currentBalance)) {
        return {
          success: false,
          error: `GL account ${leg.glCode} has an invalid current balance.`
        };
      }
      // For Debit normal accounts: Debit adds, Credit subtracts
      // For Credit normal accounts: Credit adds, Debit subtracts
      let delta = 0;
      if (glAcc.normal === 'Debit') {
        delta = leg.type === 'Debit' ? amount : -amount;
      } else {
        delta = leg.type === 'Credit' ? amount : -amount;
      }

      appliedUpdates.push({ glAcc, previousBalance: currentBalance, delta, leg });
    }

    // Apply all updates
    appliedUpdates.forEach(u => {
      u.glAcc.balance += u.delta;
    });

    const txId = `TX-${Date.now().toString().slice(-4)}`;
    const glImpactStr = legs.map(l => `${l.type === 'Debit' ? 'Dr' : 'Cr'} ${l.glCode} ${Number(l.amount).toLocaleString()}`).join(' / ');

    // Record into General Ledger Journal (Multi-Ledger Audit Trail)
    if (!state.ledger) state.ledger = [];
    state.ledger.unshift({
      id: txId,
      timestamp: new Date().toISOString(),
      type,
      description,
      channel,
      memberId: memberId || null,
      loanId: loanId || null,
      user: typeof user === 'object' ? user?.name || user?.id : (user || 'System'),
      legs: legs.map(l => ({ ...l })),
      glImpact: glImpactStr,
      amount: legs[0]?.amount || 0
    });

    // 4. Run Balance Validation Control on every post
    const balCheck = this.validateLedgerBalance(state, `POST_${type.toUpperCase().replace(/\s+/g, '_')}`);
    if (!balCheck.isBalanced) {
      appliedUpdates.forEach(update => {
        update.glAcc.balance = update.previousBalance;
      });
      const journalIndex = state.ledger.findIndex(entry => entry.id === txId);
      if (journalIndex >= 0) state.ledger.splice(journalIndex, 1);
      this.validateLedgerBalance(state, `ROLLBACK_${type.toUpperCase().replace(/\s+/g, '_')}`);
      return {
        success: false,
        error: `Posting rejected because it would leave the ledger unbalanced (debit/credit variance ${balCheck.variance.toFixed(2)}, equation variance ${balCheck.equationVariance.toFixed(2)}).`
      };
    }

    // 3. Multi-Channel SMS alert simulation; never alert for a rolled-back post.
    if (memberId) {
      const member = state.members.find(m => m.id === memberId);
      if (member && member.phone) {
        this.dispatchSMSAlert(state, {
          txId,
          phone: member.phone,
          memberName: member.name,
          type,
          amount: legs[0].amount,
          channel
        });
      }
    }

    return {
      success: true,
      txId,
      glImpact: glImpactStr,
      balanceValidation: balCheck
    };
  },

  /**
   * Helper to execute standard 2-legged transactions through the Posting Engine
   */
  executeTransaction(state, { type, memberId, loanId, amount, channel, debitGL, creditGL, description, legs }) {
    if (legs && Array.isArray(legs) && legs.length >= 2) {
      return store.postTransaction({
        type,
        memberId,
        loanId,
        amount,
        channel,
        legs,
        description
      });
    }

    // Standard 2-leg mapping
    return store.postTransaction({
      type,
      memberId,
      loanId,
      amount,
      channel,
      glDebitCode: debitGL,
      glCreditCode: creditGL,
      description
    });
  },

  /**
   * BALANCE VALIDATION CONTROL:
   * Automatic trial balance and accounting equation check run on every post or on demand.
   * Confirms:
   * 1. Total Debits == Total Credits across the entire General Ledger
   * 2. Assets = Liabilities + Equity + (Income - Expenses)
   * Flags breaks immediately into state.trialBalanceExceptions & Layer 7 Audit Trail.
   */
  validateLedgerBalance(state, triggerSource = 'AUTOMATIC_POST_CHECK') {
    let totalDebits = 0;
    let totalCredits = 0;

    let totalAssetsGross = 0;
    let contraAssetReserve = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    const glDetails = state.generalLedger.map(acc => {
      const isDebitNormal = acc.normal === 'Debit';
      const bal = Number(acc.balance) || 0;

      // In trial balance:
      // An account with Debit normal has debitVal = bal (if positive) or creditVal = -bal (if negative)
      // An account with Credit normal has creditVal = bal (if positive) or debitVal = -bal (if negative)
      let debitVal = 0;
      let creditVal = 0;

      if (isDebitNormal) {
        if (bal >= 0) {
          debitVal = bal;
        } else {
          creditVal = Math.abs(bal);
        }
      } else {
        if (bal >= 0) {
          creditVal = bal;
        } else {
          debitVal = Math.abs(bal);
        }
      }

      totalDebits += debitVal;
      totalCredits += creditVal;

      // Group by accounting category / type
      const cat = (acc.category || acc.type || '').toLowerCase();
      if (cat.includes('asset')) {
        if (acc.isContra || acc.code === '1250') {
          contraAssetReserve += bal;
        } else {
          totalAssetsGross += bal;
        }
      } else if (cat.includes('liabilit')) {
        totalLiabilities += bal;
      } else if (cat.includes('equity')) {
        totalEquity += bal;
      } else if (cat.includes('income') || cat.includes('revenue')) {
        totalIncome += bal;
      } else if (cat.includes('expense')) {
        totalExpenses += bal;
      }

      return {
        ...acc,
        debitVal,
        creditVal
      };
    });

    const netAssets = totalAssetsGross - contraAssetReserve;
    const netOperatingIncome = totalIncome - totalExpenses;
    const rightSideOfEquation = totalLiabilities + totalEquity + netOperatingIncome;

    const debitCreditVariance = Math.round((totalDebits - totalCredits) * 100) / 100;
    const equationVariance = Math.round((netAssets - rightSideOfEquation) * 100) / 100;

    const isDebitCreditBalanced = Math.abs(debitCreditVariance) < 1.0;
    const isEquationBalanced = Math.abs(equationVariance) < 1.0;
    const isBalanced = isDebitCreditBalanced && isEquationBalanced;

    const record = {
      id: `TB-CHK-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      triggerSource,
      totalDebits,
      totalCredits,
      debitCreditVariance,
      netAssets,
      totalLiabilities,
      totalEquity,
      netOperatingIncome,
      equationVariance,
      isBalanced,
      balanced: isBalanced,
      status: isBalanced ? 'BALANCED' : 'BREAK_DETECTED',
      severity: isBalanced ? 'NORMAL' : 'CRITICAL',
      message: isBalanced
        ? `Ledger strictly balanced: Total Debits (${totalDebits.toLocaleString()}) = Total Credits (${totalCredits.toLocaleString()}) · Accounting Equation A = L + E + (I - X) verified.`
        : `CRITICAL BREAK DETECTED: Variance of $${debitCreditVariance} found in Trial Balance!`
    };

    if (!state.trialBalanceExceptions) {
      state.trialBalanceExceptions = [];
    }
    state.trialBalanceExceptions.unshift(record);

    // Keep log capped at latest 50 entries
    if (state.trialBalanceExceptions.length > 50) {
      state.trialBalanceExceptions.pop();
    }

    // If an accounting break occurs, escalate immediately into Layer 7 Audit Trail
    if (!isBalanced) {
      state.auditTrail.unshift({
        id: `AUD-ERR-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        userId: 'layer0_balance_guard',
        userName: 'Balance Validation Guard (Layer 0)',
        action: 'TRIAL_BALANCE_BREAK_DETECTED',
        module: 'Audit & Compliance (Layer 7)',
        entityId: record.id,
        description: `ACCOUNTING BREAK: Total Debits (${totalDebits.toFixed(2)}) != Total Credits (${totalCredits.toFixed(2)}). Variance: ${debitCreditVariance}. Immediate reconciliation required.`,
        ipAddress: '127.0.0.1 (Kernel Core)',
        glImpact: `Variance: ${debitCreditVariance}`
      });
    }

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      variance: debitCreditVariance,
      netAssets,
      totalLiabilities,
      totalEquity,
      netOperatingIncome,
      equationVariance,
      glDetails,
      record
    };
  },

  /**
   * Retrieves full Trial Balance summary with debits, credits, and verification
   */
  getTrialBalance(state) {
    const val = this.validateLedgerBalance(state, 'TRIAL_BALANCE_QUERY');
    return {
      glDetails: val.glDetails,
      totalDebits: val.totalDebits,
      totalCredits: val.totalCredits,
      isBalanced: val.isBalanced,
      variance: val.variance,
      lastAuditRecord: val.record
    };
  },

  /**
   * Computes formal SACCO/MFI Balance Sheet
   */
  getBalanceSheet(state) {
    const val = this.validateLedgerBalance(state, 'BALANCE_SHEET_QUERY');
    const assetAccounts = state.generalLedger.filter(g => (g.category || g.type || '').toLowerCase().includes('asset'));
    const liabilityAccounts = state.generalLedger.filter(g => (g.category || g.type || '').toLowerCase().includes('liabilit'));
    const equityAccounts = state.generalLedger.filter(g => (g.category || g.type || '').toLowerCase().includes('equity'));

    return {
      assets: assetAccounts,
      liabilities: liabilityAccounts,
      equity: equityAccounts,
      totalAssetsGross: assetAccounts.filter(a => !a.isContra && a.code !== '1250').reduce((s, a) => s + (a.balance || 0), 0),
      loanLossReserve: assetAccounts.find(a => a.isContra || a.code === '1250')?.balance || 0,
      netAssets: val.netAssets,
      totalLiabilities: val.totalLiabilities,
      totalEquity: val.totalEquity,
      netOperatingIncome: val.netOperatingIncome,
      totalLiabilitiesAndEquity: val.totalLiabilities + val.totalEquity + val.netOperatingIncome,
      isBalanced: val.isBalanced,
      equationVariance: val.equationVariance
    };
  },

  /**
   * Computes Income Statement (P&L)
   */
  getIncomeStatement(state) {
    const incomeAccounts = state.generalLedger.filter(g => (g.category || g.type || '').toLowerCase().includes('income') || (g.category || '').toLowerCase().includes('revenue'));
    const expenseAccounts = state.generalLedger.filter(g => (g.category || g.type || '').toLowerCase().includes('expense'));

    const totalIncome = incomeAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalExpenses = expenseAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const netSurplus = totalIncome - totalExpenses;

    return {
      incomeAccounts,
      expenseAccounts,
      totalIncome,
      totalExpenses,
      netSurplus
    };
  },

  /**
   * Chart of Accounts helper: returns formatted account hierarchy
   */
  getChartOfAccounts(state) {
    return state.generalLedger.map(acc => {
      const def = this.CHART_OF_ACCOUNTS_DEF.find(d => d.code === acc.code);
      return {
        ...acc,
        type: acc.type || def?.type || acc.category,
        normal: acc.normal || def?.normal || 'Debit',
        description: acc.description || def?.description || ''
      };
    });
  },

  /**
   * Retrieves live multi-channel delivery network status
   */
  getChannelSummary(state) {
    const channels = state.channels || [];
    const totalChannelLiquidity = channels.reduce((sum, ch) => sum + (ch.liveBalance || 0), 0);
    const totalDailyTurnover = channels.reduce((sum, ch) => sum + (ch.dailyTurnover || 0), 0);
    const avgLatencyMs = channels.length > 0 ? Math.round(channels.reduce((sum, ch) => sum + (ch.latencyMs || 0), 0) / channels.length) : 0;

    return {
      channels,
      totalChannelLiquidity,
      totalDailyTurnover,
      avgLatencyMs
    };
  },

  /**
   * Non-blocking parallel End-of-Day (EOD) accrual:
   * Posts daily loan interest accrual and fee sweep strictly through the Double-Entry Engine.
   */
  runParallelEOD(state) {
    const interestAccrued = 18450; // daily interest on performing loans
    const feesCollected = 4200;

    // Post 1: Interest Accrual (Dr 1200 Gross Loans / Cr 4010 Interest Income)
    const eodInterestLegs = [
      { glCode: '1200', type: 'Debit', amount: interestAccrued },
      { glCode: '4010', type: 'Credit', amount: interestAccrued }
    ];

    const post1 = this.executePosting(state, {
      type: 'EOD Interest Accrual',
      description: `Daily performing loan interest accrual of $${interestAccrued.toLocaleString()}`,
      legs: eodInterestLegs,
      channel: 'Parallel EOD Engine'
    });

    // Post 2: Daily Automated Ledger Fee Sweep (Dr 1010 Cash / Cr 4030 Fee Income)
    const eodFeeLegs = [
      { glCode: '1010', type: 'Debit', amount: feesCollected },
      { glCode: '4030', type: 'Credit', amount: feesCollected }
    ];

    const post2 = this.executePosting(state, {
      type: 'Fee & Service Charge',
      description: `Daily automated ledger & channel fee collection of $${feesCollected.toLocaleString()}`,
      legs: eodFeeLegs,
      channel: 'Parallel EOD Engine'
    });

    state.auditTrail.unshift({
      id: `AUD-EOD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: 'system_daemon_eod',
      userName: 'Parallel EOD Engine (Non-Blocking)',
      action: 'EOD_DOUBLE_ENTRY_BATCH_COMPLETED',
      module: 'Core Banking Engine (Layer 0)',
      entityId: `EOD-${new Date().toISOString().slice(0, 10)}`,
      description: `Accrued $${interestAccrued.toLocaleString()} loan interest (Dr 1200 / Cr 4010) and $${feesCollected.toLocaleString()} fees (Dr 1010 / Cr 4030) without blocking counter availability.`,
      ipAddress: '127.0.0.1 (Internal Service)',
      glImpact: `Dr 1200 $${interestAccrued} / Cr 4010 $${interestAccrued} & Dr 1010 $${feesCollected} / Cr 4030 $${feesCollected}`
    });

    store.save();
    return { interestAccrued, feesCollected, post1, post2 };
  },

  /**
   * Multi-Channel SMS alert dispatcher
   */
  dispatchSMSAlert(state, { txId, phone, memberName, type, amount, channel }) {
    if (!state.smsAlerts) {
      state.smsAlerts = [];
    }
    const alert = {
      id: `SMS-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      txId,
      phone,
      recipient: memberName,
      message: `Finage Apex Alert: ${type} of ${Formatter ? Formatter.money(amount) : '$' + amount} processed successfully via ${channel}. Ref: ${txId}.`,
      status: 'Delivered'
    };
    state.smsAlerts.unshift(alert);
    if (state.smsAlerts.length > 30) state.smsAlerts.pop();
    return alert;
  }
};

window.CoreBankingEngine = CoreBankingEngine;
