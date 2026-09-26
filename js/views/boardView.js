/**
 * Finage OS v3 - Layer 9: Board & Executive Governance View
 * Macro cash flow projections, system audit trail oversight, SASRA returns, and stress testing lab
 */

const BoardView = {
  render(container, state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const forecastHorizon = state.forecastHorizon || 'monthly';
    const projections = ForecastEngine.generateProjections(state, forecastHorizon);
    const stressResult = StressTestEngine.runSimulation(state);
    const segmentation = RIMEngine.getSegmentationSummary(state);

    const newActions = `
      <select id="system-currency-select" class="dropdown-select" style="margin-right: 0.5rem;">
        <option value="KES" ${state.baseCurrency === 'KES' ? 'selected' : ''}>KES Base</option>
        <option value="USD" ${state.baseCurrency === 'USD' ? 'selected' : ''}>USD Base</option>
      </select>
      <button id="btn-export-forecast-csv" class="btn btn-outline" style="margin-right: 0.5rem;">
        Forecast CSV
      </button>
      <button id="btn-export-reg-return" class="btn btn-outline" style="margin-right: 0.5rem;">
        SASRA L-1
      </button>
      <button id="btn-export-tb-log" class="btn btn-outline" style="margin-right: 0.5rem;" title="Export Trial Balance & Balance Validation Exception Log">
        TB Exceptions
      </button>
      <button id="btn-export-audit-log" class="btn btn-primary">
        Export Audit Trail
      </button>
    `;

    container.innerHTML = `
      <!-- View Header -->
      <div class="view-header-row">
        <div class="view-heading-group">
          <h1>Board & Executive Governance Dashboard</h1>
          <p>Macro cash flow projections, system-level audit logs, SASRA regulatory returns, and liquidity stress testing</p>
        </div>
        <div class="view-actions-group">${newActions}</div>
      </div>

      <!-- Macro Executive Stat Grid -->
      <div class="stat-grid">
        <div class="stat-card cyan">
          <div class="stat-card-header">
            <span class="stat-title">Aggregate Liquid Assets</span>
            <span class="badge badge-cyan" style="font-size: 0.65rem;">AUDITED</span>
          </div>
          <div class="stat-value">${Formatter.money(balances.totalGrossLiquidAssets)}</div>
          <div class="stat-footer">
            <span>Branch + Bank + T-Bills</span>
            <span class="cell-mono" style="font-size: 0.75rem; color: var(--accent-emerald);">Verified</span>
          </div>
        </div>

        <div class="stat-card ${liquidity.statusClass}">
          <div class="stat-card-header">
            <span class="stat-title">SASRA / CBK Liquidity Ratio</span>
            <span class="badge ${liquidity.statusClass === 'safe' ? 'badge-emerald' : 'badge-amber'}" style="font-size: 0.65rem;">
              ${liquidity.complianceStatus}
            </span>
          </div>
          <div class="stat-value" style="color: ${liquidity.statutoryRatio < 15 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">
            ${liquidity.statutoryRatio.toFixed(1)}%
          </div>
          <div class="stat-footer">
            <span>Statutory Floor: 15.0%</span>
            <span class="cell-mono" style="font-size: 0.75rem;">SASRA FORM 1</span>
          </div>
        </div>

        <div class="stat-card emerald">
          <div class="stat-card-header">
            <span class="stat-title">Net Buffer Surplus</span>
            <span class="badge badge-emerald" style="font-size: 0.65rem;">BUFFER</span>
          </div>
          <div class="stat-value">${Formatter.money(liquidity.surplusDeficitAmount)}</div>
          <div class="stat-footer">
            <span>Excess Over 15% Statutory Floor</span>
            <span class="cell-mono" style="font-size: 0.75rem; color: var(--accent-emerald);">Solvent</span>
          </div>
        </div>

        <div class="stat-card purple">
          <div class="stat-card-header">
            <span class="stat-title">RIM Relationship Health</span>
            <span class="badge badge-purple" style="font-size: 0.65rem;">PORTFOLIO</span>
          </div>
          <div class="stat-value">${segmentation.vipCount} VIP / ${segmentation.commercialCount} SME</div>
          <div class="stat-footer">
            <span>Watchlist: ${segmentation.watchlistCount} Accounts</span>
            <span class="cell-mono" style="font-size: 0.75rem;">Active</span>
          </div>
        </div>
      </div>

      <!-- Inflow vs Outflow Forecast Timeline Panel -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Institutional Inflows vs Outflows Cash Projection Schedule</span>
            </div>
            <div class="panel-actions">
              <div class="horizon-tabs">
                <button class="horizon-tab-btn ${forecastHorizon === 'daily' ? 'active' : ''}" data-horizon="daily">
                  Daily (30D)
                </button>
                <button class="horizon-tab-btn ${forecastHorizon === 'weekly' ? 'active' : ''}" data-horizon="weekly">
                  Weekly (12W)
                </button>
                <button class="horizon-tab-btn ${forecastHorizon === 'monthly' ? 'active' : ''}" data-horizon="monthly">
                  Monthly (12M)
                </button>
              </div>
            </div>
          </div>

          <div class="chart-container" style="min-height: 310px;">
            <canvas id="forecastCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Interactive Scenario & Liquidity Stress-Testing Laboratory -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title" style="color: var(--accent-rose);">Interactive Liquidity Stress-Testing Laboratory</span>
            </div>
            <span class="badge badge-rose">Scenario Simulation</span>
          </div>

          <div class="stress-lab-box">
            <div class="panel-grid" style="margin-bottom: 0;">
              <!-- Stress Sliders -->
              <div class="col-6" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div class="slider-group">
                  <div class="slider-header">
                    <span class="slider-label">Member Withdrawal Surge Shock:</span>
                    <span class="slider-val" id="val-shock-withdraw">+${state.stressTesting.withdrawalSpikePct}%</span>
                  </div>
                  <input type="range" id="slider-withdraw" class="range-slider" min="0" max="60" step="5" value="${state.stressTesting.withdrawalSpikePct}">
                </div>

                <div class="slider-group">
                  <div class="slider-header">
                    <span class="slider-label">Loan Repayment Collection Drop:</span>
                    <span class="slider-val" id="val-shock-repay">-${state.stressTesting.repaymentDropPct}%</span>
                  </div>
                  <input type="range" id="slider-repay" class="range-slider" min="0" max="50" step="5" value="${state.stressTesting.repaymentDropPct}">
                </div>

                <div class="slider-group">
                  <div class="slider-header">
                    <span class="slider-label">External DFI Drawdown Delay:</span>
                    <span class="slider-val" id="val-shock-delay">${state.stressTesting.dfiDrawdownDelayDays} Days</span>
                  </div>
                  <input type="range" id="slider-delay" class="range-slider" min="0" max="90" step="15" value="${state.stressTesting.dfiDrawdownDelayDays}">
                </div>
              </div>

              <!-- Stress Test Trajectory Chart -->
              <div class="col-6">
                <div class="chart-container" style="min-height: 220px;">
                  <canvas id="stressChartCanvas"></canvas>
                </div>
              </div>
            </div>

            <!-- Dynamic Stress Test Results Banner -->
            <div class="stress-result-banner">
              <div class="stress-kpi">
                <span class="stress-kpi-title">Stressed Day-30 Cash</span>
                <span class="stress-kpi-val" style="color: ${stressResult.stressedCashDay30 < 4275000 ? 'var(--accent-rose)' : 'var(--accent-cyan)'};">
                  ${Formatter.money(stressResult.stressedCashDay30)}
                </span>
              </div>

              <div class="stress-kpi">
                <span class="stress-kpi-title">Stressed Liquidity Ratio</span>
                <span class="stress-kpi-val" style="color: ${stressResult.stressedLiquidityRatio30d < 15.0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">
                  ${stressResult.stressedLiquidityRatio30d.toFixed(1)}%
                </span>
              </div>

              <div class="stress-kpi">
                <span class="stress-kpi-title">Statutory Breach Point</span>
                <span class="stress-kpi-val" style="color: ${stressResult.regulatoryBreachDay ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">
                  ${stressResult.regulatoryBreachDay ? `Breach on Day ${stressResult.regulatoryBreachDay}` : 'No Breach in 90D'}
                </span>
              </div>

              <div class="stress-kpi">
                <span class="stress-kpi-title">Stressed Runway</span>
                <span class="stress-kpi-val" style="color: ${stressResult.runwayDays < 60 ? 'var(--accent-amber)' : 'var(--accent-purple)'};">
                  ${stressResult.runwayDays > 365 ? '12+ Months' : `${stressResult.runwayDays} Days`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Immutable System Audit Trail (Layer 7) -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">System-Level Immutable Audit Trail (Layer 7)</span>
            </div>
            <span class="badge badge-cyan">${state.auditTrail.length} Logged Events</span>
          </div>

          <div class="table-responsive" style="max-height: 320px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Timestamp</th>
                  <th>User / Role</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Entity / GL Impact</th>
                  <th>Event Description</th>
                </tr>
              </thead>
              <tbody>
                ${state.auditTrail.map(a => `
                  <tr>
                    <td class="cell-mono">${a.id}</td>
                    <td class="cell-mono" style="font-size: 0.725rem;">${Formatter.dateTime(a.timestamp)}</td>
                    <td>
                      <div class="cell-bold">${a.userName}</div>
                      <div style="font-size: 0.675rem; color: var(--text-dim);">${a.userId} • ${a.ipAddress}</div>
                    </td>
                    <td><span class="badge badge-indigo">${a.action}</span></td>
                    <td style="font-size: 0.75rem;">${a.module}</td>
                    <td>
                      <div class="cell-mono" style="font-size: 0.75rem; color: var(--accent-cyan);">${a.entityId}</div>
                      <div style="font-size: 0.675rem; color: var(--text-dim);">${a.glImpact || 'N/A'}</div>
                    </td>
                    <td style="font-size: 0.775rem; color: var(--text-muted);">${a.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      ChartManager.renderForecastChart('forecastCanvas', projections);
      ChartManager.renderStressTrajectoryChart('stressChartCanvas', stressResult);
    }, 50);

    this.bindEvents(container, state);
  },

  bindEvents(container, state) {
    const horizonBtns = container.querySelectorAll('.horizon-tab-btn');
    horizonBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const horizon = btn.dataset.horizon;
        store.setForecastHorizon(horizon);
      });
    });

    const sliderWithdraw = container.querySelector('#slider-withdraw');
    const sliderRepay = container.querySelector('#slider-repay');
    const sliderDelay = container.querySelector('#slider-delay');

    const updateStressUI = () => {
      const wVal = parseFloat(sliderWithdraw.value);
      const rVal = parseFloat(sliderRepay.value);
      const dVal = parseInt(sliderDelay.value);

      container.querySelector('#val-shock-withdraw').textContent = `+${wVal}%`;
      container.querySelector('#val-shock-repay').textContent = `-${rVal}%`;
      container.querySelector('#val-shock-delay').textContent = `${dVal} Days`;

      store.updateStressParameters({
        withdrawalSpikePct: wVal,
        repaymentDropPct: rVal,
        dfiDrawdownDelayDays: dVal
      });
    };

    if (sliderWithdraw) sliderWithdraw.addEventListener('input', updateStressUI);
    if (sliderRepay) sliderRepay.addEventListener('input', updateStressUI);
    if (sliderDelay) sliderDelay.addEventListener('input', updateStressUI);

    
    const currencySelect = container.querySelector('#system-currency-select');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        store.setBaseCurrency(e.target.value);
        App.showToast(`Institution base currency updated to ${e.target.value}`, 'success');
        App.render();
      });
    }

    const auditBtn = container.querySelector('#btn-export-audit-log');
    if (auditBtn) {
      auditBtn.addEventListener('click', () => {
        AuditService.exportAuditTrail(state);
        App.showToast('System Audit Trail exported as CSV.', 'success');
      });
    }

    const regBtn = container.querySelector('#btn-export-reg-return');
    if (regBtn) {
      regBtn.addEventListener('click', () => {
        ExportService.exportRegulatoryCompliance(state);
        App.showToast('SASRA Schedule L-1 Liquidity Return exported.', 'success');
      });
    }

    const tbLogBtn = container.querySelector('#btn-export-tb-log');
    if (tbLogBtn) {
      tbLogBtn.addEventListener('click', () => {
        AuditService.exportTrialBalanceExceptions(state);
        App.showToast('Trial Balance Exception Log exported as CSV.', 'success');
      });
    }

    const forecastBtn = container.querySelector('#btn-export-forecast-csv');
    if (forecastBtn) {
      forecastBtn.addEventListener('click', () => {
        ExportService.exportCashFlowForecast(state, state.forecastHorizon || 'monthly');
        App.showToast('Cash Flow Forecast schedule exported as CSV.', 'success');
      });
    }
  }
};

window.BoardView = BoardView;
