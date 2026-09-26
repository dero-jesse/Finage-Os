/**
 * Finage OS v3 - Layer 9: Credit & Loans Management View
 * Embedded Maker-Checker Workflow Inbox, Real-Time Online NPA Monitor, RIM borrower intelligence, and liquidity-pacing rules
 */

const CreditView = {
  render(container, state) {
    const pacing = PacingEngine.getPacingAnalysis(state);
    const pq = PortfolioEngine.getPortfolioMetrics(state);
    const npa = state.npaSummary;
    const workflowTasks = WorkflowEngine.getPendingTasks(state, 'credit');

    container.innerHTML = `
      <!-- View Header -->
      <div class="view-header-row">
        <div class="view-heading-group">
          <h1>Credit, Embedded Workflows & Online NPA Engine</h1>
          <p>Maker-Checker approval queue, Real-Time Online NPA tracking, RIM relationship scores, and liquidity pacing</p>
        </div>
        <div class="view-actions-group">
          <button id="btn-post-npa-provision" class="btn btn-outline" title="Execute double-entry loan loss impairment provision into GL (Dr 5030 / Cr 1250)">
            Post NPA Provision to GL
          </button>
          <button id="btn-export-sasra-form4a" class="btn btn-secondary">
            Export SASRA Form 4A (CSV)
          </button>
          <button id="btn-auto-pace-queue" class="btn btn-emerald">
            Auto-Pace Disbursement Queue
          </button>
        </div>
      </div>

      <!-- Pacing Rules Engine Banner (Layer 1 + Layer 6) -->
      <div style="background: #ffffff; border: 2px solid var(--accent-green-dark); padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="padding: 0.35rem 0.65rem; background: var(--accent-green-dark); color: #ffffff; font-size: 0.85rem; font-weight: 800; font-family: var(--font-mono);">
            PACING GATE
          </div>
          <div>
            <div style="font-weight: 800; color: var(--accent-green-dark); font-size: 0.95rem; text-transform: uppercase;">
              Disbursement Headroom: ${Formatter.money(pacing.safeHeadroomTarget)} (Maintains 20% Target Buffer)
            </div>
            <div style="font-size: 0.775rem; color: var(--text-dim); margin-top: 0.15rem;">
              Pending Pipeline: ${Formatter.money(pacing.totalPendingAmount)} across ${pacing.pendingCount} approved loans • Max Statutory Cap: ${Formatter.money(pacing.maxStatutoryHeadroom)}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="badge ${pacing.canDisburseAllImmediate ? 'badge-safe' : 'badge-danger'}" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
            ${pacing.canDisburseAllImmediate ? 'Sufficient Immediate Liquidity' : 'Staggered Pacing Active'}
          </span>
        </div>
      </div>
      </div>

      <!-- Embedded Maker-Checker Workflow Queue Panel (Layer 1) -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Maker-Checker Workflow Inbox (Embedded Layer 1)</span>
            </div>
            <span class="badge badge-purple">${workflowTasks.length} Pending Approval Tasks</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Task ID / Type</th>
                  <th>Request Title</th>
                  <th>Amount</th>
                  <th>Maker / Initiator</th>
                  <th>Liquidity Impact Verification</th>
                  <th>Status</th>
                  <th>Checker Action</th>
                </tr>
              </thead>
              <tbody>
                ${workflowTasks.map(t => `
                  <tr>
                    <td>
                      <div class="cell-mono">${t.id}</div>
                      <div style="font-size: 0.7rem; color: var(--text-dim);">${t.type}</div>
                    </td>
                    <td class="cell-bold">${t.title}</td>
                    <td class="cell-mono" style="color: var(--accent-cyan); font-weight: 700;">${Formatter.money(t.amount)}</td>
                    <td style="font-size: 0.8rem;">${t.requestedBy}</td>
                    <td>
                      <span class="badge ${t.liquidityImpactCheck.includes('PASSED') ? 'badge-emerald' : 'badge-amber'}" style="font-size: 0.7rem;">
                        ${t.liquidityImpactCheck}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${t.makerCheckerStatus.includes('Approved') ? 'badge-emerald' : 'badge-amber'}">
                        ${t.makerCheckerStatus}
                      </span>
                    </td>
                    <td class="action-cell">
                      ${t.makerCheckerStatus.includes('Approved') ? `
                        <span class="badge badge-emerald">Completed</span>
                      ` : `
                        <button class="btn btn-emerald btn-sm btn-wf-approve" data-id="${t.id}">
                          Approve & Release
                        </button>
                        <button class="btn btn-rose btn-sm btn-wf-reject" data-id="${t.id}">
                          Reject
                        </button>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Real-Time Online NPA Classification Grid (Layer 5) -->
      <div class="panel-grid">
        <!-- SASRA / CBK Online NPA Provisioning Table -->
        <div class="glass-panel col-8">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Real-Time Online NPA Classification (SASRA / CBK Benchmark)</span>
            </div>
            <span class="badge badge-indigo">Zero-Batch NPA Engine</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Classification</th>
                  <th>Aging (Days)</th>
                  <th>Book Value (${Formatter.currencySymbol})</th>
                  <th>Portfolio %</th>
                  <th>Statutory Provision %</th>
                  <th>Required Provision</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span class="badge badge-emerald">Normal (Performing)</span></td>
                  <td>0 - 29 Days</td>
                  <td class="cell-mono">${Formatter.money(npa.normal.amount)}</td>
                  <td>${npa.normal.percentage}%</td>
                  <td>${npa.normal.provisionRate}%</td>
                  <td class="cell-mono">${Formatter.money(npa.normal.requiredProvision)}</td>
                </tr>
                <tr>
                  <td><span class="badge badge-amber">Watch Category</span></td>
                  <td>30 - 59 Days</td>
                  <td class="cell-mono">${Formatter.money(npa.watch.amount)}</td>
                  <td>${npa.watch.percentage}%</td>
                  <td>${npa.watch.provisionRate}%</td>
                  <td class="cell-mono">${Formatter.money(npa.watch.requiredProvision)}</td>
                </tr>
                <tr>
                  <td><span class="badge badge-amber">Substandard</span></td>
                  <td>60 - 89 Days</td>
                  <td class="cell-mono">${Formatter.money(npa.substandard.amount)}</td>
                  <td>${npa.substandard.percentage}%</td>
                  <td>${npa.substandard.provisionRate}%</td>
                  <td class="cell-mono">${Formatter.money(npa.substandard.requiredProvision)}</td>
                </tr>
                <tr>
                  <td><span class="badge badge-rose">Doubtful</span></td>
                  <td>90 - 179 Days</td>
                  <td class="cell-mono">${Formatter.money(npa.doubtful.amount)}</td>
                  <td>${npa.doubtful.percentage}%</td>
                  <td>${npa.doubtful.provisionRate}%</td>
                  <td class="cell-mono">${Formatter.money(npa.doubtful.requiredProvision)}</td>
                </tr>
                <tr>
                  <td><span class="badge badge-rose">Loss Category</span></td>
                  <td>180+ Days</td>
                  <td class="cell-mono">${Formatter.money(npa.loss.amount)}</td>
                  <td>${npa.loss.percentage}%</td>
                  <td>${npa.loss.provisionRate}%</td>
                  <td class="cell-mono">${Formatter.money(npa.loss.requiredProvision)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Portfolio Quality Donut & Risk Summary -->
        <div class="glass-panel col-4">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Online NPA Donut</span>
            </div>
            <span class="badge badge-cyan">PAR Metric</span>
          </div>

          <div class="chart-container" style="min-height: 220px;">
            <canvas id="portfolioDonutCanvas"></canvas>
          </div>

          <div style="margin-top: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 0.725rem; color: var(--text-dim);">Online NPA Ratio:</span>
              <div style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: 800; color: ${npa.onlineNpaRatio < 5.0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
                ${npa.onlineNpaRatio}%
              </div>
            </div>
            <span class="badge badge-emerald">SASRA Benchmark &lt; 5%</span>
          </div>
        </div>
      </div>

      <!-- Pending Pipeline Pacing Table -->
      <div class="panel-grid">
        <div class="glass-panel col-12">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Pending Loan Pipeline & Staggered Pacing Queue</span>
            </div>
            <span class="badge badge-indigo">Priority Ranked</span>
          </div>

          <div class="table-responsive">
            <table class="data-table disbursement-queue-table">
              <thead>
                <tr>
                  <th>Client / RIM Member ID</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Yield / Score</th>
                  <th>Assigned Batch</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${pacing.prioritizedQueue.map(loan => `
                  <tr>
                    <td>
                      <div class="cell-bold">${loan.clientName}</div>
                      <div style="font-size: 0.7rem; color: var(--text-dim);">${loan.branch} • ${loan.memberId || loan.id}</div>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem;">${loan.product}</div>
                      <span class="badge ${loan.urgency === 'High' ? 'badge-rose' : (loan.urgency === 'Medium' ? 'badge-amber' : 'badge-muted')}" style="font-size: 0.65rem;">
                        ${loan.urgency} Urgency
                      </span>
                    </td>
                    <td class="cell-mono">${Formatter.money(loan.amount)}</td>
                    <td>
                      <div class="cell-mono" style="color: var(--accent-cyan); font-weight: 700;">${loan.expectedYield}% Yield</div>
                      <div style="font-size: 0.7rem; color: var(--text-dim);">Score: ${loan.score}/100</div>
                    </td>
                    <td>
                      <span class="badge ${loan.staggeredBatch === 'Batch 1' ? 'badge-emerald' : (loan.staggeredBatch === 'Batch 2' ? 'badge-cyan' : 'badge-amber')}">
                        ${loan.staggeredBatch || loan.recommendedBatch}
                      </span>
                    </td>
                    <td class="action-cell">
                      <button class="btn btn-emerald btn-sm btn-disburse-loan" data-id="${loan.id}">
                        Release Cash
                      </button>
                      <button class="btn btn-outline btn-sm btn-shift-batch" data-id="${loan.id}">
                        Shift Batch
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      ChartManager.renderPortfolioDonut('portfolioDonutCanvas', pq);
    }, 50);

    this.bindEvents(container, state, pacing);
  },

  bindEvents(container, state, pacing) {
    // Export SASRA Form 4A
    const sasraBtn = container.querySelector('#btn-export-sasra-form4a');
    if (sasraBtn) {
      sasraBtn.addEventListener('click', () => {
        AuditService.exportSASRAForm4A(state);
        App.showToast('SASRA Form 4A Loan Classification & Provisioning Return exported.', 'success');
      });
    }

    // Auto Pace Queue
    const autoPaceBtn = container.querySelector('#btn-auto-pace-queue');
    if (autoPaceBtn) {
      autoPaceBtn.addEventListener('click', () => {
        pacing.prioritizedQueue.forEach(loan => {
          store.updateDisbursementStatus(loan.id, 'Approved - Pending Pacing', loan.isRecommendedImmediate ? 'Batch 1' : 'Batch 2');
        });
        App.showToast('Queue re-optimized. Safe loans prioritized into Batch 1 immediate release.', 'success');
      });
    }

    // Workflow Approve / Reject
    const approveBtns = container.querySelectorAll('.btn-wf-approve');
    approveBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const taskId = btn.dataset.id;
        WorkflowEngine.processTask(taskId, 'Approve', 'Credit');
        App.showToast(`Workflow Task ${taskId} approved and released.`, 'success');
      });
    });

    const rejectBtns = container.querySelectorAll('.btn-wf-reject');
    rejectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const taskId = btn.dataset.id;
        const reason = prompt('Enter rejection / exception reason:', 'Policy exception / Insufficient liquidity');
        if (reason) {
          WorkflowEngine.processTask(taskId, 'Reject', 'Credit', reason);
          App.showToast(`Workflow Task ${taskId} rejected.`, 'info');
        }
      });
    });

    // Individual Disburse Buttons
    const disburseBtns = container.querySelectorAll('.btn-disburse-loan');
    disburseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const loanId = btn.dataset.id;
        const loan = state.disbursementQueue.find(l => l.id === loanId);
        if (loan) {
          if (confirm(`Confirm immediate cash disbursement of ${Formatter.money(loan.amount)} to ${loan.clientName}?`)) {
            store.updateDisbursementStatus(loanId, 'Disbursed');
            App.showToast(`Disbursed ${Formatter.money(loan.amount)} to ${loan.clientName}. Liquidity deducted from Bank Clearing Acc.`, 'success');
          }
        }
      });
    });

    // Shift Batch Buttons
    const shiftBtns = container.querySelectorAll('.btn-shift-batch');
    shiftBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const loanId = btn.dataset.id;
        const loan = state.disbursementQueue.find(l => l.id === loanId);
        if (loan) {
          const nextBatch = loan.staggeredBatch === 'Batch 1' ? 'Batch 2' : (loan.staggeredBatch === 'Batch 2' ? 'Batch 3' : 'Batch 1');
          store.updateDisbursementStatus(loanId, loan.status, nextBatch);
          App.showToast(`Loan ${loanId} shifted to ${nextBatch}.`, 'info');
        }
      });
    });

    // Post NPA Provision to GL (Layer 5 -> Layer 0)
    const provBtn = container.querySelector('#btn-post-npa-provision');
    if (provBtn) {
      provBtn.addEventListener('click', () => {
        const defaultAmt = state.npaSummary?.watch?.requiredProvision || 50000;
        const input = prompt(`Enter NPA Loan Loss Provision amount to post into GL (${Formatter.currencySymbol}):\nDouble-Entry: Dr 5030 Provision Expense / Cr 1250 Loan Loss Reserve`, defaultAmt);
        if (input && !isNaN(Number(input)) && Number(input) > 0) {
          const amt = Number(input);
          const res = PortfolioEngine.postLoanLossProvision(state, {
            amount: amt,
            notes: `NPA loan loss provision charge for watch/substandard risk portfolio`,
            user: store.getCurrentUser()
          });

          if (res.success) {
            App.showToast(`✓ Provision of ${Formatter.money(amt)} posted to GL: Dr 5030 / Cr 1250. Ledger updated in real-time!`, 'success');
          } else {
            App.showToast(`Provision post failed: ${res.error}`, 'danger');
          }
        }
      });
    }
  }
};

window.CreditView = CreditView;
