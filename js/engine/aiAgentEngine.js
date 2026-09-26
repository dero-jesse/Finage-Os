/**
 * Finage OS v3 - AI Assistant Engine
 * Provides natural language responses based on the current application state.
 */

const AiAgentEngine = {
  processQuery(state, query) {
    const q = query.toLowerCase();

    // Greeting
    if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
      const user = store.getCurrentUser();
      const name = user ? user.name.split(' ')[0] : 'there';
      return `Hello ${name}! I'm the Finage OS AI assistant. How can I help you today?`;
    }

    // Liquidity & Cash
    if (q.includes('liquidity') || q.includes('cash') || q.includes('liquid assets')) {
      const balances = CashEngine.getAggregateBalances(state);
      const liquidity = CashEngine.calculateLiquidityRatios(state);
      return `Our total gross liquid assets are **${Formatter.money(balances.totalGrossLiquidAssets)}**. The statutory liquidity ratio stands at **${liquidity.statutoryRatio.toFixed(1)}%**, which is ${liquidity.statusClass === 'badge-emerald' ? 'fully compliant' : 'below requirements'}.`;
    }

    // Portfolio Quality & NPA
    if (q.includes('portfolio') || q.includes('npa') || q.includes('arrears') || q.includes('loans')) {
      const pq = state.portfolioQuality;
      const npa = state.npaSummary;
      return `The gross loan portfolio is **${Formatter.money(pq.totalGrossLoanPortfolio)}** with ${pq.activeBorrowers} active borrowers. Our PAR>30 is at **${pq.par30Pct}%**, and the overall NPA ratio is **${npa.onlineNpaRatio}%**.`;
    }

    // Active Alerts
    if (q.includes('alert') || q.includes('warning') || q.includes('issue')) {
      const alerts = state.alerts.filter(a => !a.acknowledged);
      if (alerts.length === 0) {
        return "You have no unacknowledged alerts. The system is operating normally.";
      }
      return `You have ${alerts.length} unacknowledged alert(s): <br><br>` + 
        alerts.map(a => `• **${a.title}**: ${a.message}`).join('<br>');
    }

    // Branch Operations
    if (q.includes('branch') || q.includes('vault') || q.includes('fosa')) {
      const branchId = state.selectedBranchId;
      if (!branchId) return "Please select a branch first.";
      const branch = state.branches.find(b => b.id === branchId);
      if (!branch) return "Branch not found.";
      
      const totalTillCash = branch.tillBalances.reduce((sum, t) => sum + t.balance, 0);
      return `**${branch.name}** currently holds **${Formatter.money(branch.cashInVault)}** in the vault. The ${branch.tellerCount} active tills hold a combined **${Formatter.money(totalTillCash)}**. The reconciliation status is ${branch.reconciliationDiscrepancy === 0 ? 'balanced' : 'unbalanced'}.`;
    }
    
    // Help & Capabilities
    if (q.includes('help') || q.includes('what can you do') || q.includes('features')) {
      return `I can help you with: <br>
      • **Liquidity** (e.g., "What is our current liquidity ratio?")<br>
      • **Portfolio Quality** (e.g., "Show me the NPA ratio")<br>
      • **Branch Vaults** (e.g., "How much cash is in the vault?")<br>
      • **Alerts** (e.g., "Do I have any active alerts?")<br><br>
      Just ask!`;
    }

    // Fallback
    return "I'm not quite sure how to answer that based on the current data. Try asking about **liquidity**, **portfolio quality**, **alerts**, or **branch cash**.";
  }
};

window.AiAgentEngine = AiAgentEngine;
