/**
 * Finage OS v3 - Layer 9: Board & Executive Governance View
 * Macro cash flow projections, system audit trail oversight, and SASRA returns
 */

const BoardView = {
  render(container, state) {
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const forecastHorizon = state.forecastHorizon || 'monthly';
    const projections = ForecastEngine.generateProjections(state, forecastHorizon);
    const segmentation = RIMEngine.getSegmentationSummary(state);

    const newActions = `
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
      <div class="workspace-module">
        <div class="workspace-toolbar">
          <div class="workspace-breadcrumb" data-label="Board">Overview</div>
          <div class="workspace-actions">${newActions}</div>
        </div>

        <div class="metric-strip">
          <div class="metric-pill">
            <span class="metric-label">Liquid assets</span>
            <span class="metric-value">${Formatter.money(balances.totalGrossLiquidAssets)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Liquidity ratio</span>
            <span class="metric-value">${liquidity.statutoryRatio.toFixed(1)}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Net buffer</span>
            <span class="metric-value">${Formatter.money(liquidity.surplusDeficitAmount)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">RIM coverage</span>
            <span class="metric-value">${segmentation.vipCount + segmentation.commercialCount}</span>
          </div>
        </div>

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
              <span class="panel-title">Cash Projection</span>
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

      <!-- Committee Multi-Signature Governance Queue -->
      <div class="panel-grid" style="margin-bottom: 1.5rem;">
        <div class="glass-panel col-12">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div class="panel-title-wrap">
              <span class="panel-title">Board Credit Committee Multi-Signature Governance</span>
              <div style="font-size: 0.725rem; color: var(--text-dim);">High-value institutional exposures requiring dual/triple board approvals</div>
            </div>
            <span class="badge badge-purple">Tier-2 Escalations</span>
          </div>
          <div style="padding: 1rem;">
            ${(state.disbursementQueue || []).filter(app => app.amount >= 20000000 || (app.status && app.status.includes('Committee'))).length ? `
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Application Ref</th>
                      <th>Borrower / Member</th>
                      <th>Facility Amount</th>
                      <th>Signatures Required</th>
                      <th>Status</th>
                      <th>Governance Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(state.disbursementQueue || []).filter(app => app.amount >= 20000000 || (app.status && app.status.includes('Committee'))).map(app => {
                      const review = (state.committeeReviews || []).find(r => r.applicationId === app.id);
                      const signatures = review ? `${review.currentSignatures}/${review.requiredSignatures}` : '1/2 Signatures';
                      return `
                        <tr>
                          <td class="cell-mono"><strong>${app.id}</strong></td>
                          <td>${app.clientName || app.memberId}</td>
                          <td class="cell-mono"><strong>${Formatter.money(app.amount)}</strong></td>
                          <td><span class="badge badge-cyan">${signatures}</span></td>
                          <td><span class="badge badge-emerald">${review?.status || app.status}</span></td>
                          <td>
                            <button type="button" class="btn btn-emerald btn-sm btn-sign-committee" data-id="${app.id}">Sign & Authorize</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-dim); text-align: center; padding: 1rem;">
                No high-value loan exposures currently pending Credit Committee multi-signature authorization.
              </p>
            `}
          </div>
        </div>
      </div>

      <!-- Immutable System Audit Trail (Layer 7) -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Audit Trail</span>
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
      </div>
    `;

    setTimeout(() => {
      ChartManager.renderForecastChart('forecastCanvas', projections);
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

    // Committee multi-signature approval
    container.querySelectorAll('.btn-sign-committee').forEach(btn => {
      btn.addEventListener('click', async e => {
        const appId = e.currentTarget.dataset.id;
        const button = e.currentTarget;
        button.disabled = true;
        button.textContent = 'Posting transaction…';
        try {
          await Platform.recordCommitteeDecision({
            applicationId: appId,
            decision: 'approved',
            comments: 'Board committee authorization confirmed.'
          });
          App.showToast(`Committee signature recorded for application ${appId}.`, 'success');
        } catch (err) {
          App.showToast(`Committee signing rejected: ${err.message}`, 'danger');
          button.disabled = false;
          button.textContent = 'Sign & Authorize';
        }
      });
    });
  }
};

window.BoardView = BoardView;
