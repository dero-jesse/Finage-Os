/**
 * Finage OS - Layer 5: Scenario & Liquidity Stress-Testing Engine
 */

const StressTestEngine = {
  runSimulation(state, customParams = null) {
    const params = customParams || state.stressTesting;
    const balances = CashEngine.getAggregateBalances(state);
    const totalDeposits = state.depositLiabilities.totalDeposits;
    const statutoryMinRatio = state.institution.regulatoryMinLiquidityRatio || 15.0;
    const statutoryCashFloor = totalDeposits * (statutoryMinRatio / 100);

    // Monthly baseline parameters
    const baseMonthlyRepayments = 1850000;
    const baseMonthlyDeposits = 2400000;
    const baseMonthlyWithdrawals = 1950000;
    const baseMonthlyOpEx = state.operatingExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);

    // Apply Shocks
    const withdrawalMultiplier = 1 + (params.withdrawalSpikePct / 100);
    const repaymentMultiplier = 1 - (params.repaymentDropPct / 100);

    const stressedMonthlyWithdrawals = baseMonthlyWithdrawals * withdrawalMultiplier;
    const stressedMonthlyRepayments = baseMonthlyRepayments * repaymentMultiplier;
    const stressedMonthlyInflows = stressedMonthlyRepayments + baseMonthlyDeposits; // conservative: deposits don't grow
    const stressedMonthlyOutflows = stressedMonthlyWithdrawals + baseMonthlyOpEx;

    const stressedMonthlyNetCash = stressedMonthlyInflows - stressedMonthlyOutflows;

    // Simulate 90-day trajectory in 5-day intervals
    const trajectory = [];
    let stressedCash = balances.totalGrossLiquidAssets;
    let baseCash = balances.totalGrossLiquidAssets;
    let insolvencyDay = null;
    let regulatoryBreachDay = null;

    const baseDailyNet = (baseMonthlyRepayments + baseMonthlyDeposits - baseMonthlyWithdrawals - baseMonthlyOpEx) / 30;
    const stressedDailyNet = stressedMonthlyNetCash / 30;

    for (let day = 1; day <= 90; day++) {
      baseCash += baseDailyNet;
      stressedCash += stressedDailyNet;

      // Delayed DFI Drawdown effect
      if (day === 18 && params.dfiDrawdownDelayDays === 0) {
        stressedCash += 1000000; // on-time
      } else if (day === (18 + params.dfiDrawdownDelayDays)) {
        stressedCash += 1000000; // delayed
      }

      if (day === 18) {
        baseCash += 1000000;
      }

      // Check breach thresholds
      if (stressedCash < statutoryCashFloor && regulatoryBreachDay === null) {
        regulatoryBreachDay = day;
      }
      if (stressedCash <= 0 && insolvencyDay === null) {
        insolvencyDay = day;
      }

      if (day % 5 === 0 || day === 1 || day === 90) {
        trajectory.push({
          day,
          label: `Day ${day}`,
          baseCash: Math.max(0, baseCash),
          stressedCash: stressedCash,
          statutoryFloor: statutoryCashFloor
        });
      }
    }

    // Stressed Liquidity Ratio after 30 days
    const stressedCashDay30 = trajectory.find(t => t.day === 30)?.stressedCash || balances.totalGrossLiquidAssets;
    const stressedLiquidityRatio30d = (stressedCashDay30 / totalDeposits) * 100;

    // Calculate Cash Runway in Days under stressed burn rate
    let runwayDays = 999;
    if (stressedDailyNet < 0) {
      runwayDays = Math.max(0, Math.floor(balances.totalGrossLiquidAssets / Math.abs(stressedDailyNet)));
    }

    return {
      params,
      trajectory,
      initialCash: balances.totalGrossLiquidAssets,
      stressedCashDay30,
      stressedLiquidityRatio30d,
      regulatoryBreachDay,
      insolvencyDay,
      runwayDays,
      monthlyBurnDelta: stressedMonthlyNetCash - (baseMonthlyRepayments + baseMonthlyDeposits - baseMonthlyWithdrawals - baseMonthlyOpEx),
      recommendations: this.generateRecommendations(stressedLiquidityRatio30d, regulatoryBreachDay, runwayDays)
    };
  },

  generateRecommendations(stressedRatio, breachDay, runwayDays) {
    const recs = [];
    if (stressedRatio < 15.0 || breachDay !== null) {
      recs.push({
        priority: 'URGENT',
        text: `Freeze discretionary SME and Agri loan disbursements immediately to protect the 15% statutory floor.`
      });
      recs.push({
        priority: 'HIGH',
        text: `Initiate early liquidation of $1.5M 91-Day Treasury Bills with Central Bank discount window.`
      });
      recs.push({
        priority: 'MEDIUM',
        text: `Trigger standby emergency liquidity line with syndicated commercial lenders.`
      });
    } else {
      recs.push({
        priority: 'NORMAL',
        text: `Liquidity buffer remains resilient under tested shock parameters. Maintain standard pacing rules.`
      });
      recs.push({
        priority: 'PREVENTATIVE',
        text: `Monitor high-value depositor withdrawal requests exceeding $50,000.`
      });
    }
    return recs;
  }
};

window.StressTestEngine = StressTestEngine;
