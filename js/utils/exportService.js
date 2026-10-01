/**
 * Finage OS - Layer 6: Reporting & Export Service
 */

const ExportService = {
  /**
   * Triggers a download of a CSV formatted string
   */
  downloadCSV(filename, csvContent) {
    const organizationName = window.store?.state?.institution?.name || 'Organization';
    const lines = String(csvContent).replace(/\r\n/g, '\n').split('\n');
    const documentTitle = lines.shift() || 'Operational report';
    const body = lines.filter(line => !/^\s*(institution|reporting entity)\s*:/i.test(line)).join('\r\n');
    const escapedOrganization = `"${organizationName.replace(/"/g, '""')}"`;
    const stampedContent = `${documentTitle}\r\nOrganization: ${escapedOrganization}\r\n${body}`;
    const blob = new Blob([stampedContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Generates Daily Cash Position Report CSV
   */
  exportDailyCashPosition(state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const dateStr = new Date().toISOString().split('T')[0];

    let csv = `FINAGE OS - DAILY INSTITUTIONAL CASH POSITION STATEMENT\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `Statement Date: ${dateStr}\r\n`;
    csv += `Statutory Minimum Ratio: ${state.institution.regulatoryMinLiquidityRatio}%\r\n\r\n`;

    csv += `SECTION 1: LIQUID ASSETS BREAKDOWN\r\n`;
    csv += `Category,Instrument / Entity,Amount (USD)\r\n`;
    csv += `Branch Cash,Total Vault Reserves,${balances.totalVaultCash}\r\n`;
    csv += `Branch Cash,Total Teller Cash Tills,${balances.totalTillCash}\r\n`;
    
    state.bankAccounts.forEach(b => {
      csv += `Commercial Bank,${b.institution} (${b.accountName}),${b.balance}\r\n`;
    });

    state.shortTermInvestments.forEach(inv => {
      csv += `Short-term Placements,${inv.instrument} (${inv.issuer}),${inv.principal}\r\n`;
    });

    csv += `\r\nTOTAL GROSS LIQUID ASSETS,,${balances.totalGrossLiquidAssets}\r\n`;
    csv += `TOTAL DEPOSIT LIABILITIES,,${liquidity.totalDeposits}\r\n`;
    csv += `REGULATORY LIQUIDITY RATIO,,${liquidity.statutoryRatio.toFixed(2)}%\r\n`;
    csv += `COMPLIANCE STATUS,,${liquidity.complianceStatus}\r\n`;
    csv += `SURPLUS / (DEFICIT) BUFFER,,${liquidity.surplusDeficitAmount}\r\n`;

    this.downloadCSV(`Finage_Daily_Cash_Position_${dateStr}.csv`, csv);
  },

  /**
   * Generates Multi-Horizon Cash Flow Forecast CSV
   */
  exportCashFlowForecast(state, horizon = 'monthly') {
    const projections = ForecastEngine.generateProjections(state, horizon);
    const dateStr = new Date().toISOString().split('T')[0];

    let csv = `FINAGE OS - CASH FLOW PROJECTION SCHEDULE (${horizon.toUpperCase()})\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `Export Date: ${dateStr}\r\n\r\n`;

    csv += `Period,Expected Repayments,Expected Deposits,DFI Drawdowns,Total Inflows,Disbursements,Withdrawals,Operating OpEx,Total Outflows,Net Cash Flow,Closing Usable Cash\r\n`;

    projections.forEach(p => {
      csv += `"${p.period}",${Math.round(p.expectedRepayment)},${Math.round(p.expectedDeposit)},${Math.round(p.dfiDrawdown)},${Math.round(p.totalInflows)},${Math.round(p.pendingDisb)},${Math.round(p.expectedWithdrawal)},${Math.round(p.dailyOpEx)},${Math.round(p.totalOutflows)},${Math.round(p.netCashFlow)},${Math.round(p.closingCash)}\r\n`;
    });

    this.downloadCSV(`Finage_Cash_Flow_Forecast_${horizon}_${dateStr}.csv`, csv);
  },

  /**
   * Generates Regulatory Liquidity Compliance Return
   */
  exportRegulatoryCompliance(state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const ladder = CashEngine.getMaturityLadderAnalysis(state);
    const dateStr = new Date().toISOString().split('T')[0];

    let csv = `CENTRAL BANK / PRUDENTIAL REGULATORY LIQUIDITY RETURN (SCHEDULE L-1)\r\n`;
    csv += `Reporting Entity: ${state.institution.name}\r\n`;
    csv += `License Category: ${state.institution.type}\r\n`;
    csv += `Return Period Ending: ${dateStr}\r\n\r\n`;

    csv += `PART A: LIQUIDITY RATIO COMPUTATION\r\n`;
    csv += `Item,Description,Value (USD)\r\n`;
    csv += `1.0,Total Liquid Assets,${balances.totalGrossLiquidAssets}\r\n`;
    csv += `2.0,Total Deposit Liabilities,${liquidity.totalDeposits}\r\n`;
    csv += `3.0,Statutory Minimum Required Ratio,${liquidity.minStatutoryFloor}%\r\n`;
    csv += `4.0,Actual Maintained Ratio,${liquidity.statutoryRatio.toFixed(2)}%\r\n`;
    csv += `5.0,Statutory Net Excess / (Deficit),${liquidity.surplusDeficitAmount}\r\n`;
    csv += `6.0,Prudential Compliance Determination,${liquidity.complianceStatus.toUpperCase()}\r\n\r\n`;

    csv += `PART B: MATURITY MISMATCH & GAP PROFILE\r\n`;
    csv += `Time Horizon,Maturing Assets,Maturing Liabilities,Net Gap (USD),Cumulative Gap (USD),Coverage %\r\n`;
    ladder.forEach(row => {
      csv += `"${row.bucket}",${row.assets},${row.liabilities},${row.netGap},${row.cumulativeGap},${row.mismatchRatio.toFixed(1)}%\r\n`;
    });

    this.downloadCSV(`Regulatory_Liquidity_Return_${dateStr}.csv`, csv);
  },

  /**
   * Generates General Ledger Trial Balance Statement CSV
   */
  exportTrialBalance(state) {
    const tb = CoreBankingEngine.getTrialBalance(state);
    const dateStr = new Date().toISOString().split('T')[0];
    let csv = `FINAGE OS - GENERAL LEDGER TRIAL BALANCE STATEMENT\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `Statement Date: ${dateStr}\r\n`;
    csv += `Trial Balance Integrity: ${tb.isBalanced ? 'STRICTLY BALANCED (Debits = Credits)' : 'BREAK DETECTED'}\r\n`;
    csv += `Variance: ${tb.variance}\r\n\r\n`;

    csv += `GL Code,Account Title,Category,Type,Normal,Debit (${Formatter.currencySymbol}),Credit (${Formatter.currencySymbol})\r\n`;
    tb.glDetails.forEach(g => {
      csv += `"${g.code}","${g.name}","${g.category}","${g.type || g.category}","${g.normal}",${g.debitVal},${g.creditVal}\r\n`;
    });

    csv += `\r\nTOTALS,,,,,"${tb.totalDebits}","${tb.totalCredits}"\r\n`;
    csv += `NET VARIANCE,,,,,"${tb.variance}"\r\n`;

    this.downloadCSV(`Finage_Trial_Balance_${dateStr}.csv`, csv);
  },

  /**
   * Generates Financial Balance Sheet Statement CSV
   */
  exportBalanceSheet(state) {
    const bs = CoreBankingEngine.getBalanceSheet(state);
    const dateStr = new Date().toISOString().split('T')[0];
    let csv = `FINAGE OS - INSTITUTIONAL STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `As of Date: ${dateStr}\r\n`;
    csv += `Accounting Equation Status: ${bs.isBalanced ? 'BALANCED: Assets = Liabilities + Equity + (Income - Expense)' : 'OUT OF BALANCE'}\r\n\r\n`;

    csv += `SECTION 1: ASSETS\r\n`;
    csv += `Code,Account Title,Balance (${Formatter.currencySymbol})\r\n`;
    bs.assets.forEach(a => {
      csv += `"${a.code}","${a.name}",${a.balance}\r\n`;
    });
    csv += `TOTAL NET ASSETS,,${bs.netAssets}\r\n\r\n`;

    csv += `SECTION 2: LIABILITIES\r\n`;
    csv += `Code,Account Title,Balance (${Formatter.currencySymbol})\r\n`;
    bs.liabilities.forEach(l => {
      csv += `"${l.code}","${l.name}",${l.balance}\r\n`;
    });
    csv += `TOTAL LIABILITIES,,${bs.totalLiabilities}\r\n\r\n`;

    csv += `SECTION 3: EQUITY & SURPLUS\r\n`;
    csv += `Code,Account Title,Balance (${Formatter.currencySymbol})\r\n`;
    bs.equity.forEach(e => {
      csv += `"${e.code}","${e.name}",${e.balance}\r\n`;
    });
    csv += `Current Period Net Surplus / (Deficit),,${bs.netOperatingIncome}\r\n`;
    csv += `TOTAL EQUITY & SURPLUS,,${bs.totalEquity + bs.netOperatingIncome}\r\n\r\n`;

    csv += `TOTAL LIABILITIES & EQUITY,,${bs.totalLiabilitiesAndEquity}\r\n`;
    csv += `EQUATION VARIANCE (Net Assets - Liabilities & Equity),,${bs.equationVariance}\r\n`;

    this.downloadCSV(`Finage_Balance_Sheet_${dateStr}.csv`, csv);
  }
};

window.ExportService = ExportService;
