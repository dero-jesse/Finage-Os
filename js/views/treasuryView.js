/**
 * Finage OS v3 - Layer 9: Finance & Treasury Management View
 * Real-time Chart of Accounts (COA), Double-Entry General Ledger, Balance Validation Control,
 * Accounting Equation Compliance (A = L + E + (I - X)), Multi-Channel Float Network & Maturity Ladder
 */

const TreasuryView = {
  activeCOAFilter: 'all', // 'all' | 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses'

  render(container, state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const ladder = CashEngine.getMaturityLadderAnalysis(state);
    const trialBalance = CoreBankingEngine.getTrialBalance(state);
    const balanceSheet = CoreBankingEngine.getBalanceSheet(state);
    const incomeStatement = CoreBankingEngine.getIncomeStatement(state);
    const channelSummary = CoreBankingEngine.getChannelSummary(state);
    const exceptions = (state.trialBalanceExceptions || []).slice(0, 8);

    const filteredAccounts = trialBalance.glDetails.filter(acc => {
      if (this.activeCOAFilter === 'all') return true;
      const cat = (acc.category || acc.type || '').toLowerCase();
      if (this.activeCOAFilter === 'assets') return cat.includes('asset');
      if (this.activeCOAFilter === 'liabilities') return cat.includes('liabilit');
      if (this.activeCOAFilter === 'equity') return cat.includes('equity');
      if (this.activeCOAFilter === 'income') return cat.includes('income') || cat.includes('revenue');
      if (this.activeCOAFilter === 'expenses') return cat.includes('expense');
      return true;
    });

    container.innerHTML = `
      <div class="workspace-module">
        <div class="workspace-toolbar">
          <div class="workspace-breadcrumb" data-label="Treasury">Overview</div>
          <div class="workspace-actions">
            <button id="btn-validate-ledger-now" class="btn btn-outline btn-sm" title="Trigger instant trial balance check across the entire ledger">
              Verify Ledger
            </button>
            <button id="btn-export-trial-balance" class="btn btn-secondary btn-sm">
              Trial Balance
            </button>
            <button id="btn-export-balance-sheet" class="btn btn-primary btn-sm">
              Balance Sheet
            </button>
          </div>
        </div>

        <div class="metric-strip">
          <div class="metric-pill">
            <span class="metric-label">Liquid Assets</span>
            <span class="metric-value">${Formatter.money(balances.totalGrossLiquidAssets)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Liquidity Ratio</span>
            <span class="metric-value">${liquidity.statutoryRatio.toFixed(1)}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Net Surplus</span>
            <span class="metric-value">${Formatter.money(incomeStatement.netSurplus)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Equation</span>
            <span class="metric-value">${trialBalance.isBalanced ? 'Balanced' : 'Break'}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Buffer</span>
            <span class="metric-value">${Formatter.money(liquidity.surplusDeficitAmount)}</span>
          </div>
        </div>

        <div class="workspace-grid">
          <section class="workspace-card workspace-card--wide">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Liquidity Position</div>
              <span class="solid-note">${liquidity.complianceStatus}</span>
            </div>
            <div class="workspace-card-body">
              <div class="hero-figure">
                <div>
                  <div class="hero-number">${liquidity.statutoryRatio.toFixed(1)}%</div>
                  <div class="hero-caption">Statutory liquidity ratio</div>
                </div>
                <div class="hero-caption">Buffer ${Formatter.money(liquidity.surplusDeficitAmount)} • Deposits ${Formatter.money(liquidity.totalDeposits)}</div>
              </div>
              <div class="inline-list">
                <div class="inline-item">
                  <span class="inline-item-label">Gross liquid</span>
                  <span class="inline-item-value">${Formatter.money(balances.totalGrossLiquidAssets)}</span>
                </div>
                <div class="inline-item">
                  <span class="inline-item-label">Net assets</span>
                  <span class="inline-item-value">${Formatter.money(balanceSheet.netAssets)}</span>
                </div>
                <div class="inline-item">
                  <span class="inline-item-label">Variance</span>
                  <span class="inline-item-value">${Formatter.money(trialBalance.variance)}</span>
                </div>
                <div class="inline-item">
                  <span class="inline-item-label">Status</span>
                  <span class="inline-item-value">${trialBalance.isBalanced ? 'Balanced' : 'Flagged'}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="workspace-card workspace-card--side">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Accounting check</div>
              <span class="solid-note">Live</span>
            </div>
            <div class="workspace-card-body">
              <div class="summary-grid">
                <div class="summary-chip">
                  <strong>${Formatter.money(trialBalance.totalDebits)}</strong>
                  <span>Debits</span>
                </div>
                <div class="summary-chip">
                  <strong>${Formatter.money(trialBalance.totalCredits)}</strong>
                  <span>Credits</span>
                </div>
                <div class="summary-chip">
                  <strong>${trialBalance.isBalanced ? '0.00' : Formatter.money(trialBalance.variance)}</strong>
                  <span>Variance</span>
                </div>
              </div>
              <div class="hero-caption">${trialBalance.isBalanced ? 'Accounting equation is compliant and balanced across the active ledger.' : 'Variance detected; exception log requires review.'}</div>
            </div>
          </section>
        </div>

        <div class="workspace-grid">
          <section class="workspace-card workspace-card--wide">
            <div class="workspace-card-header">
              <div class="workspace-card-title">General ledger snapshot</div>
              <div class="workspace-actions">
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'all' ? 'btn-primary' : 'btn-outline'}" data-filter="all">All</button>
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'assets' ? 'btn-primary' : 'btn-outline'}" data-filter="assets">Assets</button>
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'liabilities' ? 'btn-primary' : 'btn-outline'}" data-filter="liabilities">Liabilities</button>
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'equity' ? 'btn-primary' : 'btn-outline'}" data-filter="equity">Equity</button>
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'income' ? 'btn-primary' : 'btn-outline'}" data-filter="income">Income</button>
                <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'expenses' ? 'btn-primary' : 'btn-outline'}" data-filter="expenses">Expenses</button>
              </div>
            </div>
            <div class="workspace-card-body">
              <div class="table-responsive" style="max-height: 260px;">
                <table class="mini-table">
                  <thead>
                    <tr>
                      <th>GL</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th class="text-right">Debit</th>
                      <th class="text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredAccounts.map(g => `
                      <tr>
                        <td>${g.code}</td>
                        <td>${g.name}</td>
                        <td><span class="badge badge-emerald">${g.category || g.type}</span></td>
                        <td>${g.debitVal > 0 ? Formatter.money(g.debitVal) : '-'}</td>
                        <td>${g.creditVal > 0 ? Formatter.money(g.creditVal) : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="workspace-card workspace-card--side">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Delivery channels</div>
              <span class="solid-note">${channelSummary.channels.length} Live</span>
            </div>
            <div class="workspace-card-body">
              ${channelSummary.channels.slice(0, 4).map(ch => `
                <div class="inline-item">
                  <span class="inline-item-label">${ch.name}</span>
                  <span class="inline-item-value">${Formatter.money(ch.liveBalance)}</span>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <div class="workspace-grid">
          <section class="workspace-card workspace-card--wide">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Maturity ladder</div>
              <span class="solid-note">ALCO</span>
            </div>
            <div class="workspace-card-body">
              <div class="chart-container" style="min-height: 220px;">
                <canvas id="maturityLadderCanvas"></canvas>
              </div>
              <div class="maturity-bucket-row">
                ${ladder.slice(0, 5).map(b => `
                  <div class="maturity-bucket-item">
                    <div class="bucket-info">
                      <span class="bucket-label">${b.bucket}</span>
                      <span class="bucket-sub">Coverage: ${b.mismatchRatio.toFixed(0)}%</span>
                    </div>
                    <div class="bucket-stats">
                      <div class="gap-indicator ${b.isPositive ? 'gap-positive' : 'gap-negative'}">
                        ${b.isPositive ? '+' : ''}${Formatter.money(b.netGap, true)}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>

          <section class="workspace-card workspace-card--side">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Exceptions</div>
              <button id="btn-export-tb-exceptions" class="btn btn-outline btn-sm">Export</button>
            </div>
            <div class="workspace-card-body">
              <table class="mini-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Variant</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${exceptions.slice(0, 4).map(e => `
                    <tr>
                      <td>${e.id}</td>
                      <td>${Formatter.money(e.debitCreditVariance)}</td>
                      <td><span class="badge ${e.status === 'BALANCED' ? 'badge-emerald' : 'badge-rose'}">${e.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    `;

    setTimeout(() => {
      ChartManager.renderMaturityLadderChart('maturityLadderCanvas', ladder);
    }, 50);

    this.bindEvents(container, state);
  },

  bindEvents(container, state) {
    // COA Filter buttons
    const filterBtns = container.querySelectorAll('.btn-coa-filter');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeCOAFilter = btn.dataset.filter;
        this.render(container, state);
      });
    });

    // On-demand Ledger Balance Verification
    const valBtn = container.querySelector('#btn-validate-ledger-now');
    if (valBtn) {
      valBtn.addEventListener('click', () => {
        const res = CoreBankingEngine.validateLedgerBalance(state, 'USER_MANUAL_AUDIT_CHECK');
        if (res.isBalanced) {
          App.showToast(`✓ Ledger Balance Verified: Total Debits (${Formatter.money(res.totalDebits)}) = Total Credits (${Formatter.money(res.totalCredits)}). Zero variance!`, 'success');
        } else {
          App.showToast(`⚠ Accounting break detected! Variance: ${Formatter.money(res.variance)}. Exception logged to Layer 7.`, 'danger');
        }
        this.render(container, state);
      });
    }

    // Export Trial Balance
    const tbBtn = container.querySelector('#btn-export-trial-balance');
    if (tbBtn) {
      tbBtn.addEventListener('click', () => {
        ExportService.exportTrialBalance(state);
        App.showToast('General Ledger Trial Balance exported as CSV.', 'success');
      });
    }

    // Export Balance Sheet
    const bsBtn = container.querySelector('#btn-export-balance-sheet');
    if (bsBtn) {
      bsBtn.addEventListener('click', () => {
        ExportService.exportBalanceSheet(state);
        App.showToast('Statement of Financial Position (Balance Sheet) exported as CSV.', 'success');
      });
    }

    // Export Trial Balance Exception Log
    const tbExpBtn = container.querySelector('#btn-export-tb-exceptions');
    if (tbExpBtn) {
      tbExpBtn.addEventListener('click', () => {
        AuditService.exportTrialBalanceExceptions(state);
        App.showToast('Trial Balance Exception Log exported as CSV.', 'success');
      });
    }
  }
};

window.TreasuryView = TreasuryView;
