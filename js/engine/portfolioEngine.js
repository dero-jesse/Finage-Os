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
  async postLoanLossProvision(state, { amount, notes, user }, options = {}) {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error('Provision amount must be greater than zero.');
    return window.Platform.executeDomainAction('post_portfolio_provision', {
      amount: parsedAmount,
      notes: notes || `Loan loss provision of ${Formatter.money(parsedAmount)}`
    }, options);
  }
};

window.PortfolioEngine = PortfolioEngine;
