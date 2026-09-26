/**
 * Finage OS - Layer 2: Cash Position & Liquidity Ratio Engine
 */

const CashEngine = {
  /**
   * Real-time Cash Balance Aggregator:
   * Pulled DIRECTLY from validated GL balances so it can never drift from the books.
   * GL 1010: Branch Vault & Till Cash
   * GL 1020: Commercial Bank Clearing Accounts
   * GL 1030: Central Bank Statutory Reserve (CRR) [Restricted]
   * GL 1040: Digital Channel & M-Pesa Float Pool
   * GL 1050: Short-Term Placements & T-Bills
   */
  getAggregateBalances(state) {
    const gl = state.generalLedger || [];
    const getGL = (code) => {
      const acc = gl.find(g => g.code === code);
      return acc ? Number(acc.balance) || 0 : 0;
    };

    const totalBranchCash = getGL('1010');
    const totalBankBalances = getGL('1020');
    const restrictedReserveCash = getGL('1030');
    const totalChannelFloat = getGL('1040');
    const totalInvestments = getGL('1050');

    // Total Gross Liquid Assets
    const totalGrossLiquidAssets = totalBranchCash + totalBankBalances + restrictedReserveCash + totalChannelFloat + totalInvestments;
    // Net Usable Liquid Cash (Excluding statutory restricted reserves 1030)
    const netUsableLiquidCash = totalGrossLiquidAssets - restrictedReserveCash;

    // Vault and Till sub-breakdowns (for branch views)
    let totalVaultCash = 0;
    let totalTillCash = 0;
    (state.branches || []).forEach(branch => {
      totalVaultCash += branch.cashInVault || 0;
      if (branch.tillBalances && Array.isArray(branch.tillBalances)) {
        branch.tillBalances.forEach(till => {
          totalTillCash += till.balance || 0;
        });
      }
    });

    return {
      totalVaultCash,
      totalTillCash,
      totalBranchCash,
      branchVaultCash: totalBranchCash,
      totalBankBalances,
      unrestrictedBankCash: totalBankBalances,
      restrictedReserveCash,
      totalChannelFloat,
      totalInvestments,
      totalGrossLiquidAssets,
      netUsableLiquidCash
    };
  },

  /**
   * Computes statutory and prudential liquidity ratios:
   * Statutory Ratio = (Gross Liquid Assets / Total Deposit Liabilities) * 100
   * Deposit liabilities are pulled directly from GL 2010 (Demand) + GL 2020 (Fixed) + GL 2030 (Contractual).
   */
  calculateLiquidityRatios(state) {
    const balances = this.getAggregateBalances(state);
    
    // Pull deposit liabilities directly from validated GL liabilities (2010, 2020, 2030)
    const gl = state.generalLedger || [];
    const getGL = (code) => {
      const acc = gl.find(g => g.code === code);
      return acc ? Number(acc.balance) || 0 : 0;
    };

    const demandDeposits = getGL('2010');
    const fixedTermDeposits = getGL('2020');
    const contractualSavings = getGL('2030');
    const totalDeposits = (demandDeposits + fixedTermDeposits + contractualSavings) || state.depositLiabilities?.totalDeposits || 1;

    const minStatutoryFloor = state.institution.regulatoryMinLiquidityRatio || 15.0;
    const targetWarningBuffer = state.institution.internalWarningBufferRatio || 20.0;

    const statutoryRatio = (balances.totalGrossLiquidAssets / totalDeposits) * 100;
    const netUsableRatio = (balances.netUsableLiquidCash / totalDeposits) * 100;

    let complianceStatus = 'Compliant'; // 'Compliant' | 'Warning' | 'Breach'
    let statusClass = 'safe';

    if (statutoryRatio < minStatutoryFloor) {
      complianceStatus = 'Regulatory Breach';
      statusClass = 'danger';
    } else if (statutoryRatio < targetWarningBuffer) {
      complianceStatus = 'Buffer Warning';
      statusClass = 'warning';
    }

    const surplusDeficitAmount = balances.totalGrossLiquidAssets - (totalDeposits * (minStatutoryFloor / 100));

    return {
      statutoryRatio,
      netUsableRatio,
      minStatutoryFloor,
      targetWarningBuffer,
      complianceStatus,
      statusClass,
      surplusDeficitAmount,
      totalDeposits,
      demandDeposits,
      fixedTermDeposits,
      contractualSavings
    };
  },

  /**
   * Computes Asset/Liability Maturity Ladder Gaps
   */
  getMaturityLadderAnalysis(state) {
    let cumulativeGap = 0;
    const analysis = state.maturityBuckets.map(item => {
      const netGap = item.assets - item.liabilities;
      cumulativeGap += netGap;
      const mismatchRatio = item.liabilities > 0 ? (item.assets / item.liabilities) * 100 : 100;
      
      return {
        bucket: item.bucket,
        assets: item.assets,
        liabilities: item.liabilities,
        netGap,
        cumulativeGap,
        mismatchRatio,
        isPositive: netGap >= 0
      };
    });

    return analysis;
  }
};

window.CashEngine = CashEngine;
