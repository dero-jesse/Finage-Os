/**
 * Finage OS - Layer 3: Multi-Horizon Forecasting Engine
 */

const ForecastEngine = {
  // Seasonality Multipliers (e.g. Month 1..12: Harvest months, festive months)
  seasonalMultipliers: [
    { month: 'Jan', depositFactor: 0.92, repaymentFactor: 0.94, withdrawalFactor: 1.15 }, // School fees shock
    { month: 'Feb', depositFactor: 0.98, repaymentFactor: 0.97, withdrawalFactor: 1.00 },
    { month: 'Mar', depositFactor: 1.05, repaymentFactor: 1.02, withdrawalFactor: 0.95 },
    { month: 'Apr', depositFactor: 1.08, repaymentFactor: 1.04, withdrawalFactor: 0.98 },
    { month: 'May', depositFactor: 1.02, repaymentFactor: 1.01, withdrawalFactor: 1.02 },
    { month: 'Jun', depositFactor: 1.10, repaymentFactor: 1.05, withdrawalFactor: 0.96 },
    { month: 'Jul', depositFactor: 1.15, repaymentFactor: 1.08, withdrawalFactor: 0.92 }, // Coffee/Tea harvest
    { month: 'Aug', depositFactor: 1.18, repaymentFactor: 1.10, withdrawalFactor: 0.90 }, // Current active month
    { month: 'Sep', depositFactor: 1.12, repaymentFactor: 1.06, withdrawalFactor: 0.98 },
    { month: 'Oct', depositFactor: 1.04, repaymentFactor: 1.01, withdrawalFactor: 1.05 },
    { month: 'Nov', depositFactor: 1.02, repaymentFactor: 0.99, withdrawalFactor: 1.08 },
    { month: 'Dec', depositFactor: 0.95, repaymentFactor: 0.92, withdrawalFactor: 1.25 }  // Holiday withdrawals
  ],

  /**
   * Generates projection time-series based on horizon: 'daily' | 'weekly' | 'monthly'
   */
  generateProjections(state, horizon = 'monthly') {
    const balances = CashEngine.getAggregateBalances(state);
    const collectionEfficiency = (state.portfolioQuality.historicalRepaymentEfficiency || 95.8) / 100;
    
    // Monthly Base Variables
    const monthlyContractualRepayments = 1850000;
    const monthlyBaseDeposits = 2400000;
    const monthlyBaseWithdrawals = 1950000;
    const monthlyTotalOpEx = state.operatingExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0); // ~540k
    
    let periods = [];
    let runningCash = balances.totalGrossLiquidAssets;

    if (horizon === 'daily') {
      // 30 Days Forecast
      for (let day = 1; day <= 30; day++) {
        const dateObj = new Date(2026, 7, 28 + day); // Aug 28 + day
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Weekend modifier
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        const volMod = isWeekend ? 0.25 : 1.0;

        // Daily Inflows
        const expectedRepayment = (monthlyContractualRepayments / 26) * collectionEfficiency * volMod;
        const expectedDeposit = (monthlyBaseDeposits / 26) * volMod;
        const dfiDrawdown = day === 18 ? 1000000 : 0; // IFC Drawdown scheduled
        const totalInflows = expectedRepayment + expectedDeposit + dfiDrawdown;

        // Daily Outflows
        const pendingDisb = (day === 2 ? 430000 : (day === 5 ? 330000 : 0)); // Staggered queue
        const expectedWithdrawal = (monthlyBaseWithdrawals / 26) * volMod;
        const dailyOpEx = (monthlyTotalOpEx / 26) * (day % 10 === 0 ? 3.0 : 0.5);
        const debtService = day === 20 ? 0 : 0;
        const totalOutflows = pendingDisb + expectedWithdrawal + dailyOpEx + debtService;

        const netCashFlow = totalInflows - totalOutflows;
        runningCash += netCashFlow;

        periods.push({
          period: label,
          expectedRepayment,
          expectedDeposit,
          dfiDrawdown,
          totalInflows,
          pendingDisb,
          expectedWithdrawal,
          dailyOpEx,
          totalOutflows,
          netCashFlow,
          closingCash: runningCash
        });
      }
    } else if (horizon === 'weekly') {
      // 12 Weeks Forecast
      for (let wk = 1; wk <= 12; wk++) {
        const label = `Week ${wk}`;
        const weeklyRepayment = (monthlyContractualRepayments / 4) * collectionEfficiency;
        const weeklyDeposit = (monthlyBaseDeposits / 4) * (1 + (wk % 4 === 0 ? 0.08 : -0.02));
        const dfiDrawdown = wk === 3 ? 1000000 : 0;
        const totalInflows = weeklyRepayment + weeklyDeposit + dfiDrawdown;

        const weeklyDisb = wk === 1 ? 430000 : (wk === 2 ? 330000 : 150000);
        const weeklyWithdrawal = (monthlyBaseWithdrawals / 4);
        const weeklyOpEx = monthlyTotalOpEx / 4;
        const debtService = wk === 7 ? 285000 : 0; // IFC Amortization in Oct
        const totalOutflows = weeklyDisb + weeklyWithdrawal + weeklyOpEx + debtService;

        const netCashFlow = totalInflows - totalOutflows;
        runningCash += netCashFlow;

        periods.push({
          period: label,
          expectedRepayment: weeklyRepayment,
          expectedDeposit: weeklyDeposit,
          dfiDrawdown,
          totalInflows,
          pendingDisb: weeklyDisb,
          expectedWithdrawal: weeklyWithdrawal,
          dailyOpEx: weeklyOpEx,
          totalOutflows,
          netCashFlow,
          closingCash: runningCash
        });
      }
    } else {
      // 12 Months Forecast (Monthly with seasonality adjustments)
      const months = ['Sep 26', 'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27', 'Feb 27', 'Mar 27', 'Apr 27', 'May 27', 'Jun 27', 'Jul 27', 'Aug 27'];
      months.forEach((mLabel, idx) => {
        const sIndex = (8 + idx) % 12;
        const season = this.seasonalMultipliers[sIndex];

        const repayments = monthlyContractualRepayments * collectionEfficiency * season.repaymentFactor;
        const deposits = monthlyBaseDeposits * season.depositFactor;
        const dfiDrawdown = idx === 0 ? 1000000 : (idx === 6 ? 500000 : 0);
        const totalInflows = repayments + deposits + dfiDrawdown;

        const disb = idx === 0 ? 760000 : (monthlyContractualRepayments * 0.85);
        const withdrawals = monthlyBaseWithdrawals * season.withdrawalFactor;
        const opEx = monthlyTotalOpEx * (idx === 3 || idx === 11 ? 1.25 : 1.0); // End of year bonuses
        const debtService = (idx === 1 ? 285000 : 0) + (idx === 3 ? 190000 : 0) + (idx === 7 ? 285000 : 0);
        const totalOutflows = disb + withdrawals + opEx + debtService;

        const netCashFlow = totalInflows - totalOutflows;
        runningCash += netCashFlow;

        periods.push({
          period: mLabel,
          expectedRepayment: repayments,
          expectedDeposit: deposits,
          dfiDrawdown,
          totalInflows,
          pendingDisb: disb,
          expectedWithdrawal: withdrawals,
          dailyOpEx: opEx,
          totalOutflows,
          netCashFlow,
          closingCash: runningCash
        });
      });
    }

    return periods;
  }
};

window.ForecastEngine = ForecastEngine;
