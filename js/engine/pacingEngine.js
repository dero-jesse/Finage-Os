/**
 * Finage OS - Layer 5: Disbursement Pacing Rules Engine
 */

const PacingEngine = {
  /**
   * Analyzes current liquidity and determines safe disbursement capacity
   */
  getPacingAnalysis(state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const minStatutoryFloor = state.institution.regulatoryMinLiquidityRatio || 15.0;
    const targetWarningBuffer = state.institution.internalWarningBufferRatio || 20.0;
    const totalDeposits = state.depositLiabilities.totalDeposits || 1;

    // Minimum cash required to maintain the 20% target warning buffer
    const targetBufferCashRequired = totalDeposits * (targetWarningBuffer / 100);
    // Minimum cash required for 15% statutory floor
    const statutoryFloorCashRequired = totalDeposits * (minStatutoryFloor / 100);

    // Headroom available for disbursement without dropping below 20%
    const safeHeadroomTarget = Math.max(0, balances.totalGrossLiquidAssets - targetBufferCashRequired);
    // Headroom available before statutory regulatory breach (15%)
    const maxStatutoryHeadroom = Math.max(0, balances.totalGrossLiquidAssets - statutoryFloorCashRequired);

    const pendingQueue = state.disbursementQueue.filter(d => String(d.status).startsWith('Approved') && d.status !== 'Disbursed');
    const totalPendingAmount = pendingQueue.reduce((sum, d) => sum + d.amount, 0);

    // Score and rank pending loans
    const scoredLoans = pendingQueue.map(loan => {
      let urgencyScore = 15;
      if (loan.urgency === 'High') urgencyScore = 25;
      if (loan.urgency === 'Low') urgencyScore = 8;

      const creditScoreFactor = (loan.creditScore / 850) * 40;
      const yieldFactor = (loan.expectedYield / 25) * 35;
      const totalScore = creditScoreFactor + yieldFactor + urgencyScore;

      return {
        ...loan,
        score: Math.round(totalScore)
      };
    }).sort((a, b) => b.score - a.score);

    // Auto-allocate into batches based on safeHeadroomTarget
    let allocatedAmount = 0;
    const prioritizedQueue = scoredLoans.map(loan => {
      let recommendedBatch = 'Batch 3 (Deferred)';
      let isRecommendedImmediate = false;

      if (allocatedAmount + loan.amount <= safeHeadroomTarget) {
        recommendedBatch = 'Batch 1 (Immediate)';
        isRecommendedImmediate = true;
        allocatedAmount += loan.amount;
      } else if (allocatedAmount + loan.amount <= maxStatutoryHeadroom) {
        recommendedBatch = 'Batch 2 (Staggered T+3)';
        allocatedAmount += loan.amount;
      }

      return {
        ...loan,
        recommendedBatch,
        isRecommendedImmediate
      };
    });

    const immediateCapacityAllocated = allocatedAmount;
    const canDisburseAllImmediate = totalPendingAmount <= safeHeadroomTarget;

    return {
      totalGrossLiquidAssets: balances.totalGrossLiquidAssets,
      safeHeadroomTarget,
      maxStatutoryHeadroom,
      totalPendingAmount,
      pendingCount: pendingQueue.length,
      immediateCapacityAllocated,
      canDisburseAllImmediate,
      prioritizedQueue
    };
  }
};

window.PacingEngine = PacingEngine;
