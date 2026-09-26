/**
 * Finage OS v3 - Layer 5: Portfolio Quality Monitor & Provisioning Postings
 * Real-time NPA Tracking, Delinquency Alerts, and Closed-Loop General Ledger Provisioning Postings
 */

const PortfolioEngine = {
  getPortfolioMetrics(state) {
    const pq = state.portfolioQuality;
    const grossPortfolio = pq.totalGrossLoanPortfolio;
    const par30Amount = grossPortfolio * (pq.par30Pct / 100);
    const par60Amount = grossPortfolio * (pq.par60Pct / 100);
    const par90Amount = grossPortfolio * (pq.par90Pct / 100);
    const performingAmount = grossPortfolio * (pq.currentPerformingPct / 100);

    // Dynamic Forecast Reliability Factor (100% = full confidence, scales down if PAR > 5%)
    let forecastConfidenceScore = 100 - ((pq.par30Pct - 3.0) * 8);
    if (forecastConfidenceScore > 99) forecastConfidenceScore = 99;
    if (forecastConfidenceScore < 60) forecastConfidenceScore = 60;

    return {
      grossPortfolio,
      performingAmount,
      par30Amount,
      par60Amount,
      par90Amount,
      par30Pct: pq.par30Pct,
      par60Pct: pq.par60Pct,
      par90Pct: pq.par90Pct,
      repaymentRate: pq.historicalRepaymentEfficiency,
      forecastConfidenceScore: Math.round(forecastConfidenceScore),
      branchBreakdown: pq.branchBreakdown
    };
  },

  /**
   * Generates automated risk alerts based on branch delinquency
   */
  getDelinquencyAlerts(state) {
    const alerts = [];
    (state.portfolioQuality.branchBreakdown || []).forEach(b => {
      if (b.par30 > 5.0) {
        alerts.push({
          branch: b.branchName,
          severity: 'Critical',
          metric: `PAR30 at ${b.par30}%`,
          action: 'Tighten disbursement limits & dispatch recovery squad'
        });
      } else if (b.par30 > 4.0) {
        alerts.push({
          branch: b.branchName,
          severity: 'Elevated',
          metric: `PAR30 at ${b.par30}%`,
          action: 'Monitor repayment collection pipeline'
        });
      }
    });
    return alerts;
  },

  /**
   * PROVISIONING POSTINGS (Layer 5 -> Layer 0 Closed Loop):
   * NPA-triggered loan loss provisions post automatically through the Double-Entry Posting Engine:
   * Dr 5030 Loan Loss Provision Expense / Cr 1250 Allowance for Loan Impairment (Loan Loss Reserve)
   * Risk metrics no longer sit disconnected from the actual books!
   */
  postLoanLossProvision(state, { amount, notes, user }) {
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return { success: false, error: 'Provision amount must be greater than zero.' };
    }

    const legs = [
      { glCode: '5030', type: 'Debit', amount: parsedAmount },
      { glCode: '1250', type: 'Credit', amount: parsedAmount }
    ];

    const postResult = CoreBankingEngine.executePosting(state, {
      type: 'Loan Loss Provision',
      description: notes || `Mandatory SASRA/CBK NPA loan loss impairment provision of ${Formatter.money(parsedAmount)}`,
      legs,
      channel: 'Credit Risk Engine (Layer 5)',
      user
    });

    if (!postResult.success) {
      return postResult;
    }

    // Update NPA summary required provisions to reflect newly posted reserves
    if (state.npaSummary) {
      state.npaSummary.totalRequiredProvisions = (state.generalLedger.find(g => g.code === '1250')?.balance || 0);
      state.npaSummary.netLoanPortfolio = (state.generalLedger.find(g => g.code === '1200')?.balance || 0) - state.npaSummary.totalRequiredProvisions;
    }

    state.auditTrail.unshift({
      id: `AUD-PRV-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || 'risk_checker',
      userName: user?.name || 'Head of Credit & Risk',
      action: 'NPA_PROVISION_GL_POSTED',
      module: 'Portfolio Quality (Layer 5)',
      entityId: postResult.txId,
      description: `Posted loan loss provision of ${Formatter.money(parsedAmount)} directly into GL: Dr 5030 Provision Expense / Cr 1250 Loan Loss Reserve.`,
      ipAddress: '192.168.10.12',
      glImpact: postResult.glImpact
    });

    store.save();
    return postResult;
  }
};

window.PortfolioEngine = PortfolioEngine;
