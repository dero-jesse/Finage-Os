/**
 * Finage OS v3 - Layer 0.5: Relationship Information Management (RIM) Engine
 * Orbit-R paradigm: Central 360° Relationship-centric customer model feeding forecasting & portfolio quality
 */

const RIMEngine = {
  isStaffProfile(member) {
    return /^STF-/i.test(member?.nationalId || '') || /staff operator|institutional staff/i.test(member?.kycStatus || '');
  },

  /**
   * Generates a 360-degree relationship dossier for a member
   */
  getMemberProfile(state, memberId) {
    if (!state || !memberId) return null;
    const member = (state.members || []).find(m => m.id === memberId && !this.isStaffProfile(m));
    if (!member) return null;

    const totalAssets = member.savingsBalance + member.fixedDepositBalance + member.shareCapital;
    const totalLiabilities = member.activeLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);
    const netWorthInInstitution = totalAssets - totalLiabilities;

    // Guaranteed obligations
    const totalGuaranteed = member.guarantorCommitments.reduce((sum, g) => sum + g.guaranteedAmount, 0);

    // Dynamic relationship tier
    let tier = 'Standard Member';
    if (member.relationshipScore >= 90) tier = 'Tier-1 Institutional VIP';
    else if (member.relationshipScore >= 75) tier = 'Prime Commercial Tier';
    else if (member.relationshipScore < 70) tier = 'Watchlist Monitored Tier';

    // Relationship-level Cash Flow Pattern Factor (Feeds Layer 4)
    // VIP members have lower withdrawal volatility and higher repayment reliability
    const inflowReliabilityMultiplier = member.relationshipScore >= 90 ? 1.05 : (member.relationshipScore >= 75 ? 1.00 : 0.85);
    const withdrawalShockSensitivity = member.relationshipScore < 70 ? 'High' : (member.relationshipScore >= 90 ? 'Low' : 'Medium');

    return {
      ...member,
      totalAssets,
      totalLiabilities,
      netWorthInInstitution,
      totalGuaranteed,
      tier,
      inflowReliabilityMultiplier,
      withdrawalShockSensitivity
    };
  },

  /**
   * Generates relationship segmentation matrix across all members
   */
  getSegmentationSummary(state) {
    const segments = {
      vipCount: 0,
      vipTotalDeposits: 0,
      commercialCount: 0,
      commercialTotalDeposits: 0,
      watchlistCount: 0,
      watchlistTotalDeposits: 0
    };

    state.members.forEach(m => {
      const dep = m.savingsBalance + m.fixedDepositBalance;
      if (m.relationshipScore >= 90) {
        segments.vipCount++;
        segments.vipTotalDeposits += dep;
      } else if (m.relationshipScore >= 75) {
        segments.commercialCount++;
        segments.commercialTotalDeposits += dep;
      } else {
        segments.watchlistCount++;
        segments.watchlistTotalDeposits += dep;
      }
    });

    return segments;
  }
};

window.RIMEngine = RIMEngine;
