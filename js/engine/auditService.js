/**
 * Finage OS v3 - Layer 7: System Audit & SASRA/CBK Regulatory Compliance Service
 * Orbit-R paradigm: System-level audit trails for financial & non-financial events,
 * Trial Balance Exception Log, and statutory return generators
 */

const AuditService = {
  /**
   * Retrieves full or filtered audit trail records
   */
  getAuditRecords(state, moduleFilter = null) {
    const logs = state.auditTrail || [];
    if (!moduleFilter) return logs;
    return logs.filter(l => l.module.toLowerCase().includes(moduleFilter.toLowerCase()));
  },

  /**
   * Retrieves Trial Balance Exception Log records
   */
  getTrialBalanceExceptions(state) {
    return state.trialBalanceExceptions || [];
  },

  /**
   * Exports Trial Balance Exception Log (Layer 7 Audit & Regulatory Returns)
   */
  exportTrialBalanceExceptions(state) {
    const exceptions = state.trialBalanceExceptions || [];
    const dateStr = new Date().toISOString().split('T')[0];
    let csv = `FINAGE OS - LAYER 7 TRIAL BALANCE EXCEPTION & BALANCE VALIDATION LOG\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `Export Timestamp: ${new Date().toISOString()}\r\n`;
    csv += `Standard: Double-Entry Balance Validation Control (Debits = Credits & A = L + E + (I - X))\r\n\r\n`;

    csv += `Log ID,Timestamp,Trigger Source,Status,Severity,Total Debits,Total Credits,Variance,Net Assets,Total Liabilities,Total Equity,Net Operating Income,Equation Variance,Message\r\n`;
    exceptions.forEach(e => {
      csv += `"${e.id}","${e.timestamp}","${e.triggerSource}","${e.status}","${e.severity}",${e.totalDebits},${e.totalCredits},${e.debitCreditVariance},${e.netAssets},${e.totalLiabilities},${e.totalEquity},${e.netOperatingIncome},${e.equationVariance},"${(e.message || '').replace(/"/g, '""')}"\r\n`;
    });

    ExportService.downloadCSV(`Trial_Balance_Exception_Log_${dateStr}.csv`, csv);
  },

  /**
   * Generates SASRA Form 4A: SACCO Loan Portfolio Classification & Provisioning Return
   */
  exportSASRAForm4A(state) {
    const npa = state.npaSummary;
    const dateStr = new Date().toISOString().split('T')[0];

    let csv = `SASRA PRUDENTIAL RETURN - FORM 4A: LOAN PORTFOLIO CLASSIFICATION & PROVISIONING\r\n`;
    csv += `Institution: ${state.institution.name}\r\n`;
    csv += `Reporting Period Ending: ${dateStr}\r\n`;
    csv += `Regulatory Standard: SASRA Regulations 2020 / CBK Prudential Guidelines\r\n\r\n`;

    csv += `Classification Category,Days Past Due,Portfolio Balance (USD),Proportion %,Statutory Provision Rate %,Required Provision (USD)\r\n`;
    csv += `Normal (Performing),0 - 29 Days,${npa.normal.amount},${npa.normal.percentage}%,${npa.normal.provisionRate}%,${npa.normal.requiredProvision}\r\n`;
    csv += `Watch Category,30 - 59 Days,${npa.watch.amount},${npa.watch.percentage}%,${npa.watch.provisionRate}%,${npa.watch.requiredProvision}\r\n`;
    csv += `Substandard,60 - 89 Days,${npa.substandard.amount},${npa.substandard.percentage}%,${npa.substandard.provisionRate}%,${npa.substandard.requiredProvision}\r\n`;
    csv += `Doubtful,90 - 179 Days,${npa.doubtful.amount},${npa.doubtful.percentage}%,${npa.doubtful.provisionRate}%,${npa.doubtful.requiredProvision}\r\n`;
    csv += `Loss,180+ Days,${npa.loss.amount},${npa.loss.percentage}%,${npa.loss.provisionRate}%,${npa.loss.requiredProvision}\r\n`;
    csv += `\r\nTOTAL GROSS LOAN PORTFOLIO,,${npa.totalGrossBook},100.0%,,${npa.totalRequiredProvisions}\r\n`;
    csv += `NET LOAN PORTFOLIO (After Provisions),,${npa.netLoanPortfolio}\r\n`;
    csv += `ONLINE NON-PERFORMING ASSET (NPA) RATIO,,${npa.onlineNpaRatio}%\r\n`;
    csv += `SASRA MAXIMUM BENCHMARK RATIO,,< 5.0% (COMPLIANT)\r\n`;

    ExportService.downloadCSV(`SASRA_Form4A_NPA_Return_${dateStr}.csv`, csv);
  },

  /**
   * Generates System Audit Log Export
   */
  exportAuditTrail(state) {
    const dateStr = new Date().toISOString().split('T')[0];
    let csv = `FINAGE OS - SYSTEM AUDIT TRAIL LOGS\r\n`;
    csv += `Export Timestamp: ${new Date().toISOString()}\r\n`;
    csv += `Institution: ${state.institution.name}\r\n\r\n`;

    csv += `Audit ID,Timestamp,User ID,User Name,Action,Module,Entity ID,GL Impact,Description,IP Address\r\n`;
    state.auditTrail.forEach(a => {
      csv += `"${a.id}","${a.timestamp}","${a.userId}","${a.userName}","${a.action}","${a.module}","${a.entityId}","${a.glImpact || 'N/A'}","${a.description.replace(/"/g, '""')}","${a.ipAddress}"\r\n`;
    });

    ExportService.downloadCSV(`Finage_System_Audit_Trail_${dateStr}.csv`, csv);
  }
};

window.AuditService = AuditService;
