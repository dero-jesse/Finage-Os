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
      <!-- View Header -->
      <div class="view-header-row">
        <div class="view-heading-group">
          <h1>Treasury, Multi-Ledger GL & Accounting Equation Engine</h1>
          <p>Real-time enterprise General Ledger, double-entry balance validation, and multi-channel liquidity</p>
        </div>
        <div class="view-actions-group">
          <button id="btn-validate-ledger-now" class="btn btn-outline" title="Trigger instant trial balance check across the entire ledger">
            Verify Balance (Dr = Cr)
          </button>
          <button id="btn-run-parallel-eod" class="btn btn-secondary">
            Run Parallel EOD
          </button>
          <button id="btn-export-trial-balance" class="btn btn-secondary">
            Export Trial Balance
          </button>
          <button id="btn-export-balance-sheet" class="btn btn-primary">
            Export Balance Sheet
          </button>
        </div>
      </div>

      <!-- Accounting Equation Compliance Banner (Layer 0 Built-in) -->
      <div style="background: #ffffff; border: 2px solid var(--accent-green-dark); padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="padding: 0.35rem 0.65rem; background: var(--accent-green-dark); color: #ffffff; font-size: 0.85rem; font-weight: 800; font-family: var(--font-mono);">
            ${trialBalance.isBalanced ? 'BALANCE OK' : 'ATTENTION'}
          </div>
          <div>
            <div style="font-size: 0.95rem; font-weight: 800; color: var(--accent-green-dark); display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
              Accounting Equation: ${trialBalance.isBalanced ? 'COMPLIANT & BALANCED' : 'OUT OF BALANCE (BREAK DETECTED)'}
              <span class="badge ${trialBalance.isBalanced ? 'badge-safe' : 'badge-danger'}">
                ${trialBalance.isBalanced ? 'Assets = Liabilities + Equity + (Income - Expense)' : 'Variance Detected'}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; font-family: var(--font-mono);">
              Net Assets [<strong>${Formatter.money(balanceSheet.netAssets)}</strong>] = Liabilities [<strong>${Formatter.money(balanceSheet.totalLiabilities)}</strong>] + Equity [<strong>${Formatter.money(balanceSheet.totalEquity)}</strong>] + Net Surplus [<strong>${Formatter.money(balanceSheet.netOperatingIncome)}</strong>] · Variance: <strong>${trialBalance.variance === 0 ? '$0.00' : Formatter.money(trialBalance.variance)}</strong>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div style="text-align: right;">
            <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Total Balanced Leg Value</div>
            <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; color: var(--accent-green-dark);">
              Dr ${Formatter.money(trialBalance.totalDebits, true)} = Cr ${Formatter.money(trialBalance.totalCredits, true)}
            </div>
          </div>
        </div>
      </div>

      <!-- Stat Widgets Grid -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Total Gross Liquid Assets</span>
          </div>
          <div class="stat-value">${Formatter.money(balances.totalGrossLiquidAssets)}</div>
          <div class="stat-footer">
            <span>GL 1010 + 1020 + 1030 + 1040 + 1050</span>
            <span class="badge">Real-time Books</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">SASRA / CBK Liquidity Ratio</span>
          </div>
          <div class="stat-value">
            ${liquidity.statutoryRatio.toFixed(1)}%
          </div>
          <div class="stat-footer">
            <span>Deposits: ${Formatter.money(liquidity.totalDeposits, true)} (GL 2010-2030)</span>
            <span class="badge">
              ${liquidity.complianceStatus}
            </span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Current Operating Surplus (P&L)</span>
          </div>
          <div class="stat-value">${Formatter.money(incomeStatement.netSurplus)}</div>
          <div class="stat-footer">
            <span>Income: ${Formatter.money(incomeStatement.totalIncome, true)} - Expenses</span>
            <span class="badge">Real-time Surplus</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Balance Validation Control</span>
          </div>
          <div class="stat-value">
            ${trialBalance.isBalanced ? 'Balanced' : 'Break Flagged'}
          </div>
          <div class="stat-footer">
            <span>Debits = Credits (${exceptions.length} audit records)</span>
            <span class="badge">Zero Variance</span>
          </div>
        </div>
      </div>

      <!-- Real-Time General Ledger (GL) & Chart of Accounts Inspector -->
      <div class="panel-grid" style="margin-top: 1rem;">
        <div class="glass-panel col-12">
          <div class="panel-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div class="panel-title-wrap">
              <span class="panel-title">Layer 0 Chart of Accounts (COA) & Double-Entry Ledger Inspector</span>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: var(--text-dim); margin-right: 0.3rem;">Filter Category:</span>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'all' ? 'btn-primary' : 'btn-outline'}" data-filter="all">All (${trialBalance.glDetails.length})</button>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'assets' ? 'btn-primary' : 'btn-outline'}" data-filter="assets">Assets</button>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'liabilities' ? 'btn-primary' : 'btn-outline'}" data-filter="liabilities">Liabilities</button>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'equity' ? 'btn-primary' : 'btn-outline'}" data-filter="equity">Equity</button>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'income' ? 'btn-primary' : 'btn-outline'}" data-filter="income">Income</button>
              <button class="btn btn-sm btn-coa-filter ${this.activeCOAFilter === 'expenses' ? 'btn-primary' : 'btn-outline'}" data-filter="expenses">Expenses</button>
            </div>
          </div>

          <div class="table-responsive" style="max-height: 420px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>GL Code</th>
                  <th>Account Title</th>
                  <th>COA Category / Type</th>
                  <th>Normal Balance</th>
                  <th>Equation Side</th>
                  <th style="text-align: right;">Debit (${Formatter.currencySymbol})</th>
                  <th style="text-align: right;">Credit (${Formatter.currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                ${filteredAccounts.map(g => {
                  const isAsset = (g.category || g.type || '').toLowerCase().includes('asset');
                  const isLiab = (g.category || g.type || '').toLowerCase().includes('liabilit');
                  const isEquity = (g.category || g.type || '').toLowerCase().includes('equity');
                  const isIncome = (g.category || g.type || '').toLowerCase().includes('income') || (g.category || '').toLowerCase().includes('revenue');
                  const badgeClass = isAsset ? 'badge-cyan' : (isLiab ? 'badge-amber' : (isEquity ? 'badge-purple' : (isIncome ? 'badge-emerald' : 'badge-rose')));
                  const equationSide = (isAsset || (g.category || '').toLowerCase().includes('expense')) ? 'Left (A + X)' : 'Right (L + E + I)';

                  return `
                    <tr>
                      <td class="cell-mono" style="font-weight: 700; color: var(--accent-cyan);">${g.code}</td>
                      <td class="cell-bold">${g.name} ${g.isContra ? '<span class="badge badge-rose" style="font-size:0.65rem; padding:0.1rem 0.4rem;">Contra-Asset</span>' : ''}</td>
                      <td><span class="badge ${badgeClass}">${g.category || g.type}</span></td>
                      <td><span class="badge ${g.normal === 'Debit' ? 'badge-cyan' : 'badge-amber'}">${g.normal}</span></td>
                      <td style="font-size: 0.75rem; color: var(--text-dim);">${equationSide}</td>
                      <td class="cell-mono" style="text-align: right; color: ${g.debitVal > 0 ? 'var(--text-main)' : 'var(--text-dim)'};">
                        ${g.debitVal > 0 ? Formatter.money(g.debitVal) : '-'}
                      </td>
                      <td class="cell-mono" style="text-align: right; color: ${g.creditVal > 0 ? 'var(--text-main)' : 'var(--text-dim)'};">
                        ${g.creditVal > 0 ? Formatter.money(g.creditVal) : '-'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: rgba(255,255,255,0.04); font-weight: 800; border-top: 2px solid var(--border-subtle);">
                  <td colspan="5" style="text-align: right; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em;">
                    Total General Ledger Leg Balances:
                  </td>
                  <td class="cell-mono" style="text-align: right; color: var(--accent-cyan); font-size: 0.95rem;">
                    ${Formatter.money(trialBalance.totalDebits)}
                  </td>
                  <td class="cell-mono" style="text-align: right; color: var(--accent-cyan); font-size: 0.95rem;">
                    ${Formatter.money(trialBalance.totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- Balance Validation Exception Log (Layer 7 Audit & Compliance) & Multi-Channel Floats -->
      <div class="panel-grid" style="margin-top: 1.25rem;">
        <!-- Trial Balance Exception Log -->
        <div class="glass-panel col-6">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Layer 7 Balance Validation & Exception Log</span>
            </div>
            <button id="btn-export-tb-exceptions" class="btn btn-outline btn-sm" title="Export validation exception records to CSV">
              Export Exceptions CSV
            </button>
          </div>

          <div class="table-responsive" style="max-height: 280px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Audit Ref</th>
                  <th>Timestamp</th>
                  <th>Trigger Source</th>
                  <th>Variance</th>
                  <th>Integrity Status</th>
                </tr>
              </thead>
              <tbody>
                ${exceptions.map(e => `
                  <tr>
                    <td class="cell-mono" style="font-size: 0.75rem;">${e.id}</td>
                    <td class="cell-mono" style="font-size: 0.7rem; color: var(--text-dim);">${Formatter.dateTime(e.timestamp)}</td>
                    <td style="font-size: 0.75rem;">${e.triggerSource}</td>
                    <td class="cell-mono" style="color: ${e.debitCreditVariance === 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-weight: 700;">
                      $${e.debitCreditVariance.toFixed(2)}
                    </td>
                    <td>
                      <span class="badge ${e.status === 'BALANCED' ? 'badge-emerald' : 'badge-rose'}">
                        ${e.status}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Multi-Channel Delivery Float & Settlement Liquidity -->
        <div class="glass-panel col-6">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Multi-Channel Delivery Float Network</span>
            </div>
            <span class="badge badge-cyan">${channelSummary.channels.length} Live Channels</span>
          </div>

          <div class="bank-cards-grid" style="grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            ${channelSummary.channels.map(ch => `
              <div class="bank-card" style="padding: 0.75rem;">
                <div class="bank-card-top" style="margin-bottom: 0.4rem;">
                  <div>
                    <div class="bank-name" style="font-size: 0.825rem;">${ch.name}</div>
                    <div class="bank-acc-num" style="font-size: 0.68rem;">${ch.type} • ${ch.latencyMs}ms</div>
                  </div>
                  <span class="badge badge-emerald" style="font-size: 0.65rem;">${ch.status}</span>
                </div>
                <div class="bank-bal" style="font-size: 1.05rem;">${Formatter.money(ch.liveBalance)}</div>
                <div style="font-size: 0.68rem; color: var(--text-dim); margin-top: 0.2rem;">
                  Daily Turnover: ${Formatter.money(ch.dailyTurnover, true)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Asset vs Liability Maturity Ladder Gap Profile -->
      <div class="panel-grid" style="margin-top: 1.25rem;">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Asset vs Liability Maturity Ladder Gap Profile (ALCO Compliance)</span>
            </div>
            <span class="badge badge-cyan">Maturity Mismatch</span>
          </div>
          <div class="chart-container" style="min-height: 220px;">
            <canvas id="maturityLadderCanvas"></canvas>
          </div>

          <div class="maturity-bucket-row" style="margin-top: 0.75rem;">
            ${ladder.slice(0, 6).map(b => `
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

    // Parallel EOD Accrual
    const eodBtn = container.querySelector('#btn-run-parallel-eod');
    if (eodBtn) {
      eodBtn.addEventListener('click', () => {
        const res = CoreBankingEngine.runParallelEOD(state);
        App.showToast(`Parallel EOD executed: Accrued ${Formatter.money(res.interestAccrued)} loan interest without blocking counter availability.`, 'success');
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
