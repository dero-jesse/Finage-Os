const SetupImport = {
  _normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  _value(row, names) {
    const entries = new Map(Object.entries(row).map(([key, value]) => [this._normalize(key), value]));
    for (const name of names) {
      const value = entries.get(this._normalize(name));
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  },

  _number(value, fallback = 0) {
    if (value === '' || value === null || value === undefined) return fallback;
    const number = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(number) ? number : NaN;
  },

  _date(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || new Date().toISOString().slice(0, 10)).slice(0, 10);
  },

  _timestamp(value) {
    if (value instanceof Date) return value.toISOString();
    return String(value || new Date().toISOString()).trim();
  },

  _rowsForSheet(name) {
    const key = this._normalize(name);
    if (['organization', 'organisation', 'org', 'profile'].includes(key)) return 'organization';
    if (['branches', 'branch', 'servicepoints'].includes(key)) return 'branches';
    if (['members', 'member', 'customers', 'clients'].includes(key)) return 'members';
    if (['loans', 'loan', 'loanaccounts'].includes(key)) return 'loans';
    if (['transactions', 'transaction', 'history'].includes(key)) return 'transactions';
    if (['chartofaccounts', 'glaccounts', 'accounts'].includes(key)) return 'chartOfAccounts';
    if (['openingbalances', 'glopeningbalances', 'glbalances'].includes(key)) return 'openingBalances';
    if (['depositaccounts', 'savingsaccounts', 'shareaccounts', 'fixeddepositaccounts'].includes(key)) return 'depositAccounts';
    if (['loanschedules', 'repaymentschedules', 'amortizationschedules'].includes(key)) return 'loanSchedules';
    if (['loanrepayments', 'repaymenthistory', 'repayments'].includes(key)) return 'loanRepayments';
    if (['audithistory', 'legacyaudit', 'audittrail'].includes(key)) return 'auditHistory';
    if (['bankaccounts', 'cashaccounts'].includes(key)) return 'bankAccounts';
    if (['externalfacilities', 'dfifacilities', 'fundingfacilities'].includes(key)) return 'externalFacilities';
    if (['investments', 'placements', 'treasuryinvestments'].includes(key)) return 'investments';
    if (['operatingexpenses', 'expenses'].includes(key)) return 'operatingExpenses';
    if (['tellertills', 'tills', 'cashpositions'].includes(key)) return 'tellerTills';
    if (['collateral', 'loansecurity'].includes(key)) return 'collateral';
    return null;
  },

  _parseRows(kind, rows, sourceName, result) {
    if (kind === 'organization') {
      const row = rows[0] || {};
      const fields = {
        name: ['name', 'legalname', 'organizationname', 'organisationname'],
        type: ['type', 'institutiontype'],
        regNumber: ['regnumber', 'registrationnumber', 'registrationno'],
        country: ['country', 'countrycode'],
        baseCurrency: ['basecurrency', 'currency'],
        financialYear: ['financialyear', 'fiscalyear'],
        regulatoryBody: ['regulatorybody', 'regulator'],
        minLiquidityRatio: ['minliquidityratio', 'liquidityratio']
      };
      Object.entries(fields).forEach(([field, aliases]) => {
        const value = this._value(row, aliases);
        if (value !== '') {
          if (field === 'minLiquidityRatio') {
            const ratio = this._number(value);
            if (Number.isNaN(ratio)) result.errors.push(`${sourceName}, row 2: minimum liquidity ratio must be a number`);
            else result.organization[field] = ratio;
          } else {
            result.organization[field] = String(value).trim();
          }
        }
      });
      return;
    }

    if (kind === 'chartOfAccounts') {
      rows.forEach((row, index) => {
        result.migrationRecords.push({
          id: `${this._normalize(sourceName)}-${kind}-${this._normalize(this._value(row, ['code', 'glcode', 'accountcode']) || index + 2)}`,
          recordType: kind,
          sourceFile: sourceName,
          sourceRow: index + 2,
          payload: row
        });
        const code = String(this._value(row, ['code', 'glcode', 'accountcode']) || '').trim();
        const name = String(this._value(row, ['name', 'accountname', 'accounttitle']) || '').trim();
        const category = String(this._value(row, ['category', 'accountcategory', 'type']) || '').trim();
        const normal = String(this._value(row, ['normal', 'normalbalance']) || '').trim();
        if (!code || !name || !category || !['debit', 'credit'].includes(normal.toLowerCase())) {
          result.errors.push(`${sourceName}, row ${index + 2}: GL code, account name, category, and Debit/Credit normal balance are required`);
          return;
        }
        result.glAccounts.push({
          code,
          name,
          category,
          type: String(this._value(row, ['accounttype', 'subtype']) || category),
          normal: normal[0].toUpperCase() + normal.slice(1).toLowerCase(),
          isContra: String(this._value(row, ['iscontra', 'contra']) || '').toLowerCase() === 'true'
        });
      });
      return;
    }

    rows.forEach((row, index) => {
      const line = index + 2;
      const fail = message => result.errors.push(`${sourceName}, row ${line}: ${message}`);
      result.migrationRecords.push({
        id: `${this._normalize(sourceName)}-${kind}-${this._normalize(this._value(row, ['id', 'memberid', 'accountid', 'loanid', 'transactionid', 'reference']) || line)}`,
        recordType: kind,
        sourceFile: sourceName,
        sourceRow: line,
        payload: row
      });
      if (kind === 'branches') {
        const name = String(this._value(row, ['name', 'branchname', 'servicepoint']) || '').trim();
        const code = String(this._value(row, ['code', 'branchcode', 'servicepointcode']) || '').trim();
        if (!name || !code) return fail('branch name and code are required');
        const tellerCount = this._number(this._value(row, ['tellercount', 'tellers']), 0);
        const vaultLimit = this._number(this._value(row, ['vaultlimit']), 0);
        const tellerCashLimit = this._number(this._value(row, ['tellercashlimit', 'cashlimit']), 0);
        if ([tellerCount, vaultLimit, tellerCashLimit].some(Number.isNaN)) return fail('branch limits and teller count must be numbers');
        result.branches.push({
          id: String(this._value(row, ['id', 'branchid']) || `br-${this._normalize(code)}`),
          name,
          code,
          tellerCount,
          vaultLimit,
          tellerCashLimit,
          status: String(this._value(row, ['status']) || 'Active')
        });
      } else if (kind === 'members') {
        const name = String(this._value(row, ['name', 'fullname', 'membername', 'customername']) || '').trim();
        const nationalId = String(this._value(row, ['nationalid', 'nationalidentity', 'identitynumber']) || '').trim();
        const phone = String(this._value(row, ['phone', 'phonenumber', 'mobile']) || '').trim();
        if (!name || !nationalId || !phone) return fail('member name, national ID, and phone are required');
        const balanceValues = {
          relationshipScore: this._value(row, ['relationshipscore', 'relationshiprating']),
          savingsBalance: this._value(row, ['savingsbalance', 'demandbalance', 'savings']),
          fixedDepositBalance: this._value(row, ['fixeddepositbalance', 'fixeddeposits']),
          shareCapital: this._value(row, ['sharecapital', 'sharebalance'])
        };
        const values = {
          relationshipScore: balanceValues.relationshipScore === '' ? null : this._number(balanceValues.relationshipScore),
          savingsBalance: balanceValues.savingsBalance === '' ? null : this._number(balanceValues.savingsBalance),
          fixedDepositBalance: balanceValues.fixedDepositBalance === '' ? null : this._number(balanceValues.fixedDepositBalance),
          shareCapital: balanceValues.shareCapital === '' ? null : this._number(balanceValues.shareCapital)
        };
        if (Object.values(values).some(value => value !== null && Number.isNaN(value))) return fail('member balances and relationship score must be numbers');
        const memberId = String(this._value(row, ['id', 'memberid', 'customerid']) || `MEM-${this._normalize(nationalId)}`);
        result.members.push({
          id: memberId,
          name,
          nationalId,
          phone,
          email: String(this._value(row, ['email', 'emailaddress']) || ''),
          joinDate: this._date(this._value(row, ['joindate', 'membershipdate', 'datejoined'])),
          branchId: String(this._value(row, ['branchid', 'branchcode']) || ''),
          branchName: String(this._value(row, ['branchname']) || ''),
          kycStatus: String(this._value(row, ['kycstatus', 'kyc']) || 'Pending'),
          occupation: String(this._value(row, ['occupation']) || ''),
          employer: String(this._value(row, ['employer']) || ''),
          riskSegment: String(this._value(row, ['risksegment']) || 'Standard Risk'),
          ...values,
          activeLoans: [],
          guarantorCommitments: []
        });
      } else if (kind === 'loans') {
        const memberId = String(this._value(row, ['memberid', 'customerid']) || '').trim();
        const loanId = String(this._value(row, ['loanid', 'id', 'accountnumber']) || '').trim();
        const outstandingBalance = this._number(this._value(row, ['outstandingbalance', 'balance']), NaN);
        const principal = this._number(this._value(row, ['principal', 'originalprincipal', 'loanamount']), NaN);
        if (!memberId || !loanId || Number.isNaN(outstandingBalance) || Number.isNaN(principal)) return fail('member ID, loan ID, principal, and outstanding balance are required');
        result.loans.push({
          memberId,
          loanId,
          product: String(this._value(row, ['product', 'loanproduct']) || 'Imported Loan'),
          principal,
          outstandingBalance,
          monthlyInstallment: this._number(this._value(row, ['monthlyinstallment', 'installment']), 0),
          interestRate: this._number(this._value(row, ['interestrate', 'rate']), 0),
          nextDueDate: this._date(this._value(row, ['nextduedate', 'duedate'])),
          daysInArrears: this._number(this._value(row, ['daysinarrears', 'arrearsdays']), 0),
          npaClassification: String(this._value(row, ['npaclassification', 'classification']) || 'Normal (Performing)'),
          status: String(this._value(row, ['status', 'loanstatus']) || 'Active'),
          disbursedAt: this._timestamp(this._value(row, ['disbursedat', 'disburseddate'])),
          repaymentMethod: String(this._value(row, ['repaymentmethod', 'interestmethod']) || 'reducing').toLowerCase()
        });
      } else if (kind === 'transactions') {
        const type = String(this._value(row, ['type', 'transactiontype']) || '').trim();
        const amount = this._number(this._value(row, ['amount', 'transactionamount']), NaN);
        if (!type || Number.isNaN(amount)) return fail('transaction type and numeric amount are required');
        result.transactions.push({
          id: String(this._value(row, ['id', 'transactionid', 'reference']) || `IMPORT-${crypto.randomUUID()}`),
          date: this._timestamp(this._value(row, ['date', 'timestamp', 'transactiondate'])),
          type,
          status: String(this._value(row, ['status']) || 'Completed'),
          channel: String(this._value(row, ['channel', 'deliverychannel']) || 'Imported'),
          memberId: String(this._value(row, ['memberid', 'customerid']) || '') || null,
          memberName: String(this._value(row, ['membername', 'customername', 'client']) || '') || null,
          amount,
          details: String(this._value(row, ['details', 'description', 'narrative']) || type),
          glDebit: String(this._value(row, ['gldebit', 'debitgl', 'debitcode']) || '') || null,
          glCredit: String(this._value(row, ['glcredit', 'creditgl', 'creditcode']) || '') || null,
          branchId: String(this._value(row, ['branchid']) || '') || null
        });
      } else if (kind === 'openingBalances') {
        const code = String(this._value(row, ['code', 'glcode', 'accountcode']) || '').trim();
        const balance = this._number(this._value(row, ['balance', 'openingbalance']), NaN);
        if (!code || Number.isNaN(balance)) return fail('GL code and numeric opening balance are required');
        result.openingBalances.push({ code, balance });
      }
    });
  },

  async parseFile(file, csvType = 'branches') {
    if (!window.XLSX) throw new Error('Spreadsheet support did not load. Refresh the page and try again.');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const result = { organization: {}, branches: [], members: [], loans: [], transactions: [], glAccounts: [], openingBalances: [], migrationRecords: [], sourceFiles: [file.name], errors: [], sheets: [] };
    let recognized = 0;

    workbook.SheetNames.forEach(sheetName => {
      const kind = file.name.toLowerCase().endsWith('.csv') ? csvType : this._rowsForSheet(sheetName);
      if (!kind) return;
      const sheet = workbook.Sheets[sheetName];
      const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!matrix.length) return;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
      recognized++;
      result.sheets.push(kind);
      if (rows.length) this._parseRows(kind, rows, file.name, result);
    });

    if (!recognized) throw new Error('No supported worksheet found. Use the Finage migration template sheet names.');
    const sourceKeys = new Set();
    result.migrationRecords.forEach(record => {
      if (sourceKeys.has(record.id)) result.errors.push(`${record.sourceFile}, row ${record.sourceRow}: duplicate source ID ${record.id}`);
      sourceKeys.add(record.id);
    });
    return result;
  },

  downloadTemplate() {
    if (!window.XLSX) throw new Error('Spreadsheet support did not load.');
    const sheets = {
      Organization: ['Name', 'Type', 'RegNumber', 'Country', 'BaseCurrency', 'FinancialYear', 'RegulatoryBody', 'MinLiquidityRatio'],
      Branches: ['ID', 'Name', 'Code', 'TellerCount', 'VaultLimit', 'TellerCashLimit', 'Status'],
      'Chart of Accounts': ['Code', 'Name', 'Category', 'AccountType', 'Normal', 'IsContra'],
      'GL Opening Balances': ['Code', 'Balance'],
      Members: ['ID', 'Name', 'NationalID', 'Phone', 'Email', 'JoinDate', 'BranchID', 'BranchName', 'KYCStatus', 'Occupation', 'Employer', 'RiskSegment', 'RelationshipScore', 'SavingsBalance', 'FixedDepositBalance', 'ShareCapital'],
      'Deposit Accounts': ['ID', 'MemberID', 'AccountNumber', 'Product', 'AccountType', 'Balance', 'Status', 'OpenedAt', 'MaturityDate', 'InterestRate'],
      Loans: ['MemberID', 'LoanID', 'AccountNumber', 'Product', 'Principal', 'OutstandingBalance', 'Status', 'DisbursedAt', 'MaturityDate', 'MonthlyInstallment', 'InterestRate', 'DaysInArrears', 'NPAClassification'],
      'Loan Schedules': ['ID', 'LoanID', 'DueDate', 'PrincipalDue', 'InterestDue', 'FeesDue', 'PaidAmount', 'Status'],
      'Loan Repayments': ['ID', 'LoanID', 'MemberID', 'Date', 'Amount', 'PrincipalAmount', 'InterestAmount', 'Fees', 'Penalty', 'Reference', 'Channel'],
      Transactions: ['ID', 'Date', 'Type', 'Status', 'Channel', 'MemberID', 'MemberName', 'Amount', 'Details', 'GLDebit', 'GLCredit', 'BranchID', 'PostedBy', 'Reference'],
      'Audit History': ['ID', 'Timestamp', 'UserID', 'UserName', 'Action', 'Module', 'EntityID', 'Description', 'IPAddress'],
      'Bank Accounts': ['ID', 'Institution', 'AccountName', 'AccountNumber', 'Currency', 'Balance', 'Status'],
      'External Facilities': ['ID', 'Lender', 'FacilityType', 'TotalCommitment', 'DrawnAmount', 'InterestRate', 'NextRepaymentDate', 'NextRepaymentAmount'],
      Investments: ['ID', 'Instrument', 'Issuer', 'Principal', 'YieldRate', 'MaturityDate', 'LiquidityClass'],
      'Operating Expenses': ['ID', 'Category', 'MonthlyAmount', 'DueDayOfMonth'],
      'Teller Tills': ['BranchID', 'TellerID', 'UserID', 'TellerName', 'Balance', 'Status'],
      Collateral: ['ID', 'LoanID', 'MemberID', 'CollateralType', 'Description', 'Valuation', 'ValuationDate', 'Status']
    };
    const workbook = window.XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, headers]) => {
      const worksheet = window.XLSX.utils.aoa_to_sheet([headers]);
      window.XLSX.utils.book_append_sheet(workbook, worksheet, name);
    });
    window.XLSX.writeFile(workbook, 'Finage_Organization_Setup_Template.xlsx');
  },

  merge(target, incoming) {
    Object.assign(target.organization, incoming.organization);
    ['branches', 'members', 'loans', 'transactions', 'glAccounts', 'openingBalances', 'migrationRecords', 'sourceFiles', 'errors', 'sheets'].forEach(key => {
      target[key].push(...incoming[key]);
    });
  },

  attachLoans(importData, existingMembers = []) {
    const members = new Map(importData.members.map(member => [member.id, member]));
    const loans = new Map();
    importData.loans.forEach(loan => {
      let member = members.get(loan.memberId);
      if (!member) {
        const existing = existingMembers.find(item => item.id === loan.memberId);
        if (existing) {
          member = {
            id: existing.id,
            name: existing.name,
            nationalId: existing.nationalId,
            phone: existing.phone,
            email: existing.email || '',
            joinDate: existing.joinDate,
            branchId: existing.branchId,
            branchName: existing.branchName,
            kycStatus: existing.kycStatus || 'Pending',
            occupation: existing.occupation || '',
            employer: existing.employer || '',
            riskSegment: existing.riskSegment || 'Standard Risk',
            relationshipScore: existing.relationshipScore,
            savingsBalance: existing.savingsBalance,
            fixedDepositBalance: existing.fixedDepositBalance,
            shareCapital: existing.shareCapital,
            activeLoans: Array.isArray(existing.activeLoans) ? [...existing.activeLoans] : [],
            guarantorCommitments: Array.isArray(existing.guarantorCommitments) ? [...existing.guarantorCommitments] : []
          };
          importData.members.push(member);
          members.set(member.id, member);
        }
      }
      if (!member) {
        importData.errors.push(`Loan ${loan.loanId}: member ${loan.memberId} was not found in this organization.`);
        return;
      }
      const attachedLoan = { ...loan, repaymentSchedule: [], paymentHistory: [], penaltyAssessments: [] };
      member.activeLoans.push(attachedLoan);
      loans.set(loan.loanId, attachedLoan);
    });

    const referencedLoanIds = new Set(importData.migrationRecords
      .filter(record => record.recordType === 'loanSchedules' || record.recordType === 'loanRepayments')
      .map(record => String(this._value(record.payload, ['loanid', 'loanaccountid']) || '').trim()));
    existingMembers.forEach(existing => {
      const relevantLoans = (existing.activeLoans || []).filter(loan => referencedLoanIds.has(loan.loanId || loan.id));
      if (!relevantLoans.length || members.has(existing.id)) return;
      const member = { ...existing, activeLoans: (existing.activeLoans || []).map(loan => ({ ...loan })) };
      importData.members.push(member);
      members.set(member.id, member);
    });
    importData.members.forEach(member => (member.activeLoans || []).forEach(loan => {
      const loanId = loan.loanId || loan.id;
      if (referencedLoanIds.has(loanId) && !loans.has(loanId)) loans.set(loanId, loan);
    }));

    importData.migrationRecords
      .filter(record => record.recordType === 'loanSchedules' || record.recordType === 'loanRepayments')
      .forEach(record => {
        const source = record.payload;
        const loanId = String(this._value(source, ['loanid', 'loanaccountid']) || '').trim();
        const loan = loans.get(loanId);
        if (!loan) return;

        if (record.recordType === 'loanSchedules') {
          const dueDate = this._date(this._value(source, ['duedate', 'scheduleddate', 'paymentdate']));
          const principalAmount = this._number(this._value(source, ['principaldue', 'principal', 'scheduledprincipal']), 0);
          const interestAmount = this._number(this._value(source, ['interestdue', 'interest', 'scheduledinterest']), 0);
          const feesDue = this._number(this._value(source, ['feesdue', 'fees', 'charges']), 0);
          const paidAmount = this._number(this._value(source, ['paidamount', 'amountpaid']), 0);
          if ([principalAmount, interestAmount, feesDue, paidAmount].some(Number.isNaN) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            importData.errors.push(`Loan schedule ${record.sourceFile}, row ${record.sourceRow}: due date and scheduled amounts must be valid.`);
            return;
          }
          const installmentAmount = principalAmount + interestAmount + feesDue;
          const sourceStatus = String(this._value(source, ['status', 'installmentstatus']) || '').toLowerCase();
          const outstandingAmount = Math.max(0, installmentAmount - paidAmount);
          loan.repaymentSchedule.push({
            id: String(this._value(source, ['id', 'scheduleid', 'installmentid']) || `${loanId}-INST-${loan.repaymentSchedule.length + 1}`),
            dueDate,
            principalAmount,
            interestAmount,
            feesDue,
            installmentAmount,
            paidAmount,
            outstandingAmount,
            status: sourceStatus === 'paid' || sourceStatus === 'settled' || outstandingAmount <= 0.005 ? 'Paid' : 'Due'
          });
        } else {
          const amount = this._number(this._value(source, ['amount', 'paymentamount', 'totalamount']), NaN);
          if (!Number.isFinite(amount) || amount <= 0) {
            importData.errors.push(`Loan repayment ${record.sourceFile}, row ${record.sourceRow}: payment amount must be greater than zero.`);
            return;
          }
          loan.paymentHistory.push({
            transactionId: String(this._value(source, ['id', 'reference', 'transactionid']) || record.id),
            amount,
            postedAt: this._timestamp(this._value(source, ['date', 'paymentdate', 'transactiondate'])),
            channel: String(this._value(source, ['channel', 'paymentchannel']) || 'Imported')
          });
        }
      });

    loans.forEach(loan => {
      loan.repaymentSchedule.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
      if (loan.repaymentSchedule.length) {
        const hasSchedulePaidAmounts = loan.repaymentSchedule.some(item => item.paidAmount > 0 || item.status === 'Paid');
        if (!hasSchedulePaidAmounts && loan.paymentHistory.length) {
          let available = loan.paymentHistory.reduce((total, payment) => total + payment.amount, 0);
          loan.repaymentSchedule.forEach(installment => {
            installment.paidAmount = Math.min(installment.installmentAmount, available);
            installment.outstandingAmount = Math.max(0, installment.installmentAmount - installment.paidAmount);
            installment.status = installment.outstandingAmount <= 0.005 ? 'Paid' : 'Due';
            available = Math.max(0, available - installment.installmentAmount);
          });
        }
        loan.nextDueDate = loan.repaymentSchedule.find(item => item.status !== 'Paid')?.dueDate || null;
      }
    });
    return importData;
  },

  attachFullMigration(importData, existingMembers = []) {
    const importedMemberRows = new Map(importData.members.map(member => [member.id, member]));
    this.attachLoans(importData, existingMembers);
    const members = new Map(importData.members.map(member => [member.id, member]));
    const accountTotals = new Map();
    importData.migrationRecords
      .filter(record => record.recordType === 'depositAccounts')
      .forEach(record => {
        const row = record.payload;
        const memberId = String(this._value(row, ['memberid', 'customerid']) || '').trim();
        const accountId = String(this._value(row, ['id', 'accountid', 'accountnumber']) || '').trim();
        const balance = this._number(this._value(row, ['balance', 'currentbalance', 'ledgerbalance']), NaN);
        const accountType = String(this._value(row, ['accounttype', 'product', 'producttype']) || '').toLowerCase();
        if (!memberId || !accountId || Number.isNaN(balance)) {
          importData.errors.push(`Deposit account ${accountId || '(no ID)'}: member ID, account ID, and numeric balance are required.`);
          return;
        }
        let member = members.get(memberId);
        if (!member) {
          const existing = existingMembers.find(item => item.id === memberId);
          if (existing) {
            member = {
              id: existing.id, name: existing.name, nationalId: existing.nationalId, phone: existing.phone,
              email: existing.email || '', joinDate: existing.joinDate, branchId: existing.branchId,
              branchName: existing.branchName, kycStatus: existing.kycStatus || 'Pending',
              occupation: existing.occupation || '', employer: existing.employer || '',
              riskSegment: existing.riskSegment || 'Standard Risk', relationshipScore: existing.relationshipScore,
              savingsBalance: existing.savingsBalance, fixedDepositBalance: existing.fixedDepositBalance,
              shareCapital: existing.shareCapital, activeLoans: [...(existing.activeLoans || [])],
              guarantorCommitments: [...(existing.guarantorCommitments || [])]
            };
            importData.members.push(member);
            members.set(memberId, member);
          }
        }
        if (!member) {
          importData.errors.push(`Deposit account ${accountId}: member ${memberId} was not found in the imported or existing member register.`);
          return;
        }
        const field = /share|capital/.test(accountType)
          ? 'shareCapital'
          : /fixed|term|deposit/.test(accountType) && !/saving/.test(accountType)
            ? 'fixedDepositBalance'
            : 'savingsBalance';
        const totals = accountTotals.get(memberId) || { savingsBalance: 0, fixedDepositBalance: 0, shareCapital: 0 };
        totals[field] += balance;
        accountTotals.set(memberId, totals);
      });

    accountTotals.forEach((totals, memberId) => {
      const member = members.get(memberId);
      const importedMember = importedMemberRows.get(memberId);
      if (importedMember) {
        Object.entries(totals).forEach(([field, accountBalance]) => {
          const memberBalance = importedMember[field];
          if (memberBalance !== null && memberBalance !== undefined && Math.abs(memberBalance - accountBalance) > 0.01) {
            importData.errors.push(`Member ${memberId}: ${field} total ${memberBalance} does not match deposit-account total ${accountBalance}.`);
          }
        });
      }
      Object.assign(member, totals);
    });

    const memberIds = new Set([...importData.members, ...existingMembers].map(member => member.id));
    const loanIds = new Set([
      ...importData.loans.map(loan => loan.loanId),
      ...existingMembers.flatMap(member => (member.activeLoans || []).map(loan => loan.loanId || loan.id))
    ]);
    importData.migrationRecords
      .filter(record => ['loanSchedules', 'loanRepayments', 'collateral'].includes(record.recordType))
      .forEach(record => {
        const memberId = String(this._value(record.payload, ['memberid', 'customerid']) || '').trim();
        const loanId = String(this._value(record.payload, ['loanid', 'loanaccountid']) || '').trim();
        if (!loanId) {
          importData.errors.push(`${record.recordType} row ${record.sourceRow}: loan ID is required.`);
          return;
        }
        if (memberId && !memberIds.has(memberId) && !existingMembers.some(member => member.id === memberId)) {
          importData.errors.push(`${record.recordType} row ${record.sourceRow}: member ${memberId} was not found.`);
        }
        if (loanId && !loanIds.has(loanId)) {
          importData.errors.push(`${record.recordType} row ${record.sourceRow}: loan ${loanId} was not found.`);
        }
      });
    return importData;
  },

  validateOrganizationLinks(importData, branches, existingMembers = []) {
    const branchIds = new Set(branches.map(branch => String(branch.id)));
    const branchCodes = new Set(branches.map(branch => String(branch.code).toLowerCase()));
    const branchNames = new Set(branches.map(branch => String(branch.name).toLowerCase()));
    const branchByReference = new Map();
    branches.forEach(branch => {
      branchByReference.set(String(branch.id).toLowerCase(), branch);
      branchByReference.set(String(branch.code).toLowerCase(), branch);
      branchByReference.set(String(branch.name).toLowerCase(), branch);
    });
    const memberIds = new Set([...importData.members, ...existingMembers].map(member => String(member.id)));
    importData.transactions.forEach(transaction => {
      if (transaction.memberId && !memberIds.has(String(transaction.memberId))) {
        importData.errors.push(`Transaction ${transaction.id}: member ${transaction.memberId} was not found.`);
      }
      if (transaction.branchId && !branchIds.has(String(transaction.branchId)) && !branchCodes.has(String(transaction.branchId).toLowerCase()) && !branchNames.has(String(transaction.branchId).toLowerCase())) {
        importData.errors.push(`Transaction ${transaction.id}: branch ${transaction.branchId} was not found.`);
      } else if (transaction.branchId) {
        transaction.branchId = branchByReference.get(String(transaction.branchId).toLowerCase()).id;
      }
    });
    importData.migrationRecords.filter(record => record.recordType === 'tellerTills').forEach(record => {
      const branch = String(this._value(record.payload, ['branchid', 'branchcode', 'branchname']) || '').trim();
      if (branch && !branchIds.has(branch) && !branchCodes.has(branch.toLowerCase()) && !branchNames.has(branch.toLowerCase())) {
        importData.errors.push(`Teller till row ${record.sourceRow}: branch ${branch} was not found.`);
      }
    });
    return importData;
  },

  getMigrationControls(importData, chartAccounts = []) {
    const records = importData.migrationRecords || [];
    const countByType = records.reduce((counts, record) => {
      counts[record.recordType] = (counts[record.recordType] || 0) + 1;
      return counts;
    }, {});
    const sum = (recordType, aliases) => records
      .filter(record => record.recordType === recordType)
      .reduce((total, record) => total + (this._number(this._value(record.payload, aliases), 0) || 0), 0);
    const glNormalByCode = new Map([...chartAccounts, ...(importData.glAccounts || [])]
      .map(account => [String(account.code), String(account.normal || '').toLowerCase()]));
    let openingGlDebits = 0;
    let openingGlCredits = 0;
    const openingGlUnknownCodes = [];
    importData.openingBalances.forEach(row => {
      const normal = glNormalByCode.get(String(row.code));
      if (normal === 'debit') openingGlDebits += row.balance;
      else if (normal === 'credit') openingGlCredits += row.balance;
      else openingGlUnknownCodes.push(row.code);
    });
    return {
      sourceRows: records.length,
      countByType,
      depositAccountBalances: sum('depositAccounts', ['balance', 'currentbalance', 'ledgerbalance']),
      loanOutstandingBalances: importData.loans.reduce((total, loan) => total + (loan.outstandingBalance || 0), 0),
      transactionAmount: importData.transactions.reduce((total, transaction) => total + (transaction.amount || 0), 0),
      openingGlBalances: importData.openingBalances.reduce((total, row) => total + (row.balance || 0), 0),
      openingGlDebits,
      openingGlCredits,
      openingGlVariance: openingGlDebits - openingGlCredits,
      openingGlUnknownCodes
    };
  }
};
