/**
 * Finage OS v3 - Layer 9: Credit & Loans Management View
 * Embedded Maker-Checker Workflow Inbox, Real-Time Online NPA Monitor, RIM borrower intelligence, and liquidity-pacing rules
 */

const CreditView = {
  activeTab: 'overview',

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  },

  hasCreditApproval(state) {
    const user = store.getCurrentUser();
    if (user?.roles?.includes('ROLE-ADMIN')) return true;
    return UserManagementEngine.getUserRoles(state, user?.id)
      .some(role => role.permissions?.includes('APPROVE_CREDIT_FACILITY'));
  },

  getLoanRecords(state) {
    return (state.members || []).flatMap(member => (member.activeLoans || []).map(loan => {
      const schedule = Array.isArray(loan.repaymentSchedule) ? loan.repaymentSchedule : [];
      const legacySchedule = !schedule.length && loan.nextDueDate && Number(loan.monthlyInstallment) > 0
        ? [{
          id: `${loan.loanId}-DUE-${loan.nextDueDate}`,
          dueDate: loan.nextDueDate,
          installmentAmount: Number(loan.monthlyInstallment),
          status: 'Due'
        }]
        : [];
      return { member, loan, schedule: schedule.length ? schedule : legacySchedule };
    }));
  },

  getOverdueInstallments(state) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getLoanRecords(state).flatMap(({ member, loan, schedule }) => schedule
      .filter(item => item.status !== 'Paid')
      .map(item => {
        const dueDate = new Date(`${item.dueDate}T00:00:00`);
        if (!Number.isFinite(dueDate.getTime())) return null;
        const daysOverdue = Math.max(0, Math.floor((today - dueDate) / 86400000));
        if (daysOverdue <= 0) return null;
        const policy = loan.penaltyPolicy || {};
        const graceDays = Number(policy.graceDays) || 0;
        const chargeableDays = Math.max(0, daysOverdue - graceDays);
        const assessedForInstallment = (loan.penaltyAssessments || [])
          .filter(penalty => penalty.installmentId === item.id);
        const assessedTotal = assessedForInstallment.reduce((sum, penalty) => sum + Number(penalty.amount || 0), 0);
        const computedTotal = chargeableDays
          ? (Number(policy.fixedFee) || 0) +
            (Number(item.outstandingAmount ?? item.installmentAmount) * (Number(policy.dailyRate) || 0) / 100 * chargeableDays)
          : 0;
        const penaltySuggestion = Math.round(Math.max(0, computedTotal - assessedTotal) * 100) / 100;
        return {
          member,
          loan,
          installment: item,
          daysOverdue,
          penaltySuggestion: Math.round(penaltySuggestion * 100) / 100,
          alreadyAssessed: assessedTotal > 0,
          assessedTotal
        };
      })
      .filter(Boolean));
  },

  renderPortalNav(activeTab) {
    const tabs = [
      ['overview', 'Overview'],
      ['applications', 'Applications'],
      ['portfolio', 'Client loans'],
      ['collections', 'Collections & penalties'],
      ['products', 'Products & rates']
    ];
    return `<nav class="credit-portal-tabs" aria-label="Credit portal sections">${tabs.map(([id, label]) => `
      <button type="button" class="btn btn-sm ${activeTab === id ? 'btn-primary' : 'btn-outline'}" data-credit-tab="${id}">${label}</button>
    `).join('')}</nav>`;
  },

  renderPortalSection(container, state) {
    const canApprove = this.hasCreditApproval(state);
    const escapeHtml = value => this.escapeHtml(value);
    let content = '';

    if (this.activeTab === 'applications') {
      const applications = [...(state.disbursementQueue || [])]
        .sort((a, b) => String(b.appliedDate || '').localeCompare(String(a.appliedDate || '')));
      content = `
        <section class="glass-panel col-12">
          <div class="panel-header"><div class="panel-title-wrap"><span class="panel-title">Loan application tracker</span></div>
            <span class="badge badge-purple">${applications.length} applications</span>
          </div>
          <div class="table-responsive"><table class="data-table"><thead><tr>
            <th>Reference / Applied</th><th>Applicant</th><th>Product &amp; purpose</th><th>Requested</th><th>Term</th><th>Status</th><th>Workflow</th><th>Action</th>
          </tr></thead><tbody>
            ${applications.length ? applications.map(app => {
              const task = state.workflowTasks.find(item => item.id === app.workflowTaskId);
              return `<tr>
                <td><span class="cell-mono">${escapeHtml(app.id)}</span><div>${escapeHtml(app.appliedDate || '—')}</div></td>
                <td>${escapeHtml(app.clientName)}<div class="cell-mono">${escapeHtml(app.memberId)}</div></td>
                <td>${escapeHtml(app.product)}<div>${escapeHtml(app.purpose || 'Purpose not recorded')}</div></td>
                <td class="cell-mono">${Formatter.money(app.amount)}</td>
                <td>${Number(app.termMonths) || '—'} months</td>
                <td><span class="badge ${String(app.status).startsWith('Approved') ? 'badge-emerald' : app.status === 'Rejected' ? 'badge-rose' : 'badge-amber'}">${escapeHtml(app.status)}</span></td>
                <td>${escapeHtml(task?.makerCheckerStatus || 'No linked review')}</td>
                <td>${app.status === 'Approved - Pending Pacing' && canApprove
                  ? `<button type="button" class="btn btn-emerald btn-sm btn-disburse-loan" data-id="${escapeHtml(app.id)}">Disburse</button>`
                  : (task?.makerCheckerStatus === 'Pending Checker Release' && canApprove
                    ? `<button type="button" class="btn btn-primary btn-sm btn-application-approve" data-id="${escapeHtml(task.id)}">Review &amp; approve</button>
                       <button type="button" class="btn btn-outline btn-sm btn-application-reject" data-id="${escapeHtml(task.id)}">Return / reject</button>`
                    : '—')}
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="8">No loan applications recorded.</td></tr>'}
          </tbody></table></div>
        </section>`;
    } else if (this.activeTab === 'portfolio') {
      const records = this.getLoanRecords(state);
      content = `
        <section class="glass-panel col-12">
          <div class="panel-header"><div class="panel-title-wrap"><span class="panel-title">Client loan accounts</span></div>
            <span class="badge badge-cyan">${records.length} accounts</span>
          </div>
          <div class="table-responsive"><table class="data-table"><thead><tr>
            <th>Loan / Borrower</th><th>Product</th><th>Principal</th><th>Outstanding</th><th>Instalment</th><th>Next due</th><th>Rate / Method</th><th>Recorded penalties</th><th>Activity</th>
          </tr></thead><tbody>
            ${records.length ? records.map(({ member, loan }) => {
              const penaltyTotal = (loan.penaltyAssessments || []).filter(item => item.status !== 'Paid')
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const payments = loan.paymentHistory || [];
              return `<tr>
                <td><span class="cell-mono">${escapeHtml(loan.loanId || loan.id)}</span><div>${escapeHtml(member.name)} (${escapeHtml(member.id)})</div></td>
                <td>${escapeHtml(loan.product)}</td>
                <td class="cell-mono">${Formatter.money(loan.principal || 0)}</td>
                <td class="cell-mono">${Formatter.money(loan.outstandingBalance || 0)}</td>
                <td class="cell-mono">${Formatter.money(loan.monthlyInstallment || 0)}</td>
                <td>${escapeHtml(loan.nextDueDate || 'Not set')}</td>
                <td>${Number(loan.interestRate || 0).toFixed(2)}% p.a. · ${loan.repaymentMethod === 'flat' ? 'Flat' : 'Reducing'}</td>
                <td class="cell-mono">${Formatter.money(penaltyTotal)}</td>
                <td><details><summary>${payments.length} repayments</summary>
                  ${payments.map(payment => `<div>${escapeHtml(payment.postedAt?.slice(0, 10) || '—')} · ${Formatter.money(payment.amount)}</div>`).join('') || '<div>No recorded repayments</div>'}
                  ${(loan.penaltyAssessments || []).map(penalty => `<div>${escapeHtml(penalty.assessedAt?.slice(0, 10) || '—')} · Penalty ${Formatter.money(penalty.amount)} · ${escapeHtml(penalty.status)}</div>`).join('')}
                </details></td>
              </tr>`;
            }).join('') : '<tr><td colspan="9">No client loan accounts recorded.</td></tr>'}
          </tbody></table></div>
        </section>`;
    } else if (this.activeTab === 'collections') {
      const overdue = this.getOverdueInstallments(state);
      content = `
        <section class="glass-panel col-12">
          <div class="panel-header"><div class="panel-title-wrap"><span class="panel-title">Collections &amp; overdue instalments</span></div>
            <span class="badge badge-amber">${overdue.length} overdue</span>
          </div>
          <div class="hero-caption" style="margin-bottom:.8rem;">Suggested penalty = configured fixed fee + (overdue instalment × daily rate × chargeable days). The amount remains a suggestion until an authorized checker reviews it. Assessment is recorded on the loan file only; it is not collected or posted to the GL.</div>
          <div class="table-responsive"><table class="data-table"><thead><tr>
            <th>Loan / Client</th><th>Due date</th><th>Days overdue</th><th>Instalment due</th><th>Penalty suggestion</th><th>Action</th>
          </tr></thead><tbody>
            ${overdue.length ? overdue.map(({ member, loan, installment, daysOverdue, penaltySuggestion, alreadyAssessed, assessedTotal }) => `
              <tr>
                <td><span class="cell-mono">${escapeHtml(loan.loanId || loan.id)}</span><div>${escapeHtml(member.name)}</div></td>
                <td>${escapeHtml(installment.dueDate)}</td>
                <td>${daysOverdue}</td>
                <td class="cell-mono">${Formatter.money(installment.outstandingAmount ?? installment.installmentAmount)}</td>
                <td class="cell-mono">${alreadyAssessed ? `${Formatter.money(assessedTotal)} assessed · ${Formatter.money(penaltySuggestion)} additional` : Formatter.money(penaltySuggestion)}</td>
                <td>${canApprove && !alreadyAssessed
                  ? `<button type="button" class="btn btn-outline btn-sm btn-assess-loan-penalty" data-member-id="${escapeHtml(member.id)}" data-loan-id="${escapeHtml(loan.loanId || loan.id)}" data-installment-id="${escapeHtml(installment.id)}" data-suggested="${penaltySuggestion}">Review &amp; record</button>`
                  : (canApprove && alreadyAssessed && penaltySuggestion > 0
                    ? `<button type="button" class="btn btn-outline btn-sm btn-assess-loan-penalty" data-member-id="${escapeHtml(member.id)}" data-loan-id="${escapeHtml(loan.loanId || loan.id)}" data-installment-id="${escapeHtml(installment.id)}" data-suggested="${penaltySuggestion}">Review top-up</button>`
                    : (alreadyAssessed ? 'Recorded' : 'Checker authorization required'))}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6">No overdue instalments in the available loan schedule data.</td></tr>'}
          </tbody></table></div>
          <h3 class="panel-title" style="margin:1.2rem 0 .6rem;">Recorded penalties</h3>
          ${this.getLoanRecords(state).flatMap(({ member, loan }) => (loan.penaltyAssessments || []).map(penalty => `
            <div class="inline-item"><span class="inline-item-label">${escapeHtml(loan.loanId)} · ${escapeHtml(member.name)} · ${escapeHtml(penalty.reason)} · ${escapeHtml(penalty.status)}</span><span class="inline-item-value">${Formatter.money(penalty.amount)}</span></div>
          `)).join('') || '<div class="hero-caption">No penalties have been assessed.</div>'}
        </section>`;
    } else if (this.activeTab === 'products') {
      const products = state.loanProducts || [];
      content = `
        <section class="glass-panel col-12">
          <div class="panel-header"><div class="panel-title-wrap"><span class="panel-title">Loan products &amp; policy rates</span></div></div>
          <div class="hero-caption" style="margin-bottom:.8rem;">Product rate changes apply to new applications. Existing applications and loan accounts keep their saved policy snapshot. Confirm each rate against your approved policy by saving it here before applications can use it. Daily penalties are simple (not compounded), applied to the scheduled instalment only after the grace period.</div>
          ${canApprove ? `<div class="credit-product-list">${products.map(product => `
            <form class="form-loan-product credit-product-grid" data-product-id="${escapeHtml(product.id)}">
              <div><label class="form-label">Product</label><div class="cell-bold">${escapeHtml(product.name)}</div><div class="hero-caption">${product.rateConfigured === false ? 'Rate requires checker confirmation' : 'Rate confirmed'}</div></div>
              <label class="form-group">Annual rate %<input class="form-control" name="annualInterestRate" type="number" min="0" step="0.01" value="${Number(product.annualInterestRate) || 0}" required></label>
              <label class="form-group">Repayment method<select class="form-control" name="repaymentMethod"><option value="reducing" ${product.repaymentMethod !== 'flat' ? 'selected' : ''}>Reducing balance</option><option value="flat" ${product.repaymentMethod === 'flat' ? 'selected' : ''}>Flat rate</option></select></label>
              <label class="form-group">Grace days<input class="form-control" name="penaltyGraceDays" type="number" min="0" step="1" value="${Number(product.penaltyGraceDays) || 0}" required></label>
              <label class="form-group">Fixed late fee<input class="form-control" name="penaltyFixedFee" type="number" min="0" step="0.01" value="${Number(product.penaltyFixedFee) || 0}" required></label>
              <label class="form-group">Daily rate %<input class="form-control" name="penaltyDailyRate" type="number" min="0" step="0.001" value="${Number(product.penaltyDailyRate) || 0}" required></label>
              <button class="btn btn-secondary btn-sm" type="submit">Save policy</button>
            </form>
          `).join('')}</div>` : '<p>Only authorized credit checkers can view or change product rates.</p>'}
          ${canApprove ? `<form id="form-add-loan-product" class="credit-product-grid" style="padding-top:1rem;">
            <label class="form-group">New product name<input class="form-control" name="name" required maxlength="80"></label>
            <label class="form-group">Annual rate %<input class="form-control" name="annualInterestRate" type="number" min="0" step="0.01" value="0" required></label>
            <label class="form-group">Repayment method<select class="form-control" name="repaymentMethod"><option value="reducing">Reducing balance</option><option value="flat">Flat rate</option></select></label>
            <label class="form-group">Grace days<input class="form-control" name="penaltyGraceDays" type="number" min="0" step="1" value="0" required></label>
            <label class="form-group">Fixed late fee<input class="form-control" name="penaltyFixedFee" type="number" min="0" step="0.01" value="0" required></label>
            <label class="form-group">Daily rate %<input class="form-control" name="penaltyDailyRate" type="number" min="0" step="0.001" value="0" required></label>
            <button class="btn btn-primary btn-sm" type="submit">Add product</button>
          </form>` : ''}
        </section>`;
    }

    container.innerHTML = `<div class="workspace-module">
      <div class="workspace-toolbar"><div class="workspace-breadcrumb" data-label="Credit">Loan officer portal</div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-open-loan-application">New application</button>
      </div>
      ${this.renderPortalNav(this.activeTab)}
      <div class="panel-grid">${content}</div>
    </div>`;
    this.bindPortalEvents(container, state);
  },

  bindPortalEvents(container, state) {
    container.querySelectorAll('[data-credit-tab]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.creditTab;
        this.render(container, state);
      });
    });
    container.querySelector('#btn-open-loan-application')?.addEventListener('click', () => {
      InputModalView.open('loans');
    });
    container.querySelectorAll('.btn-application-approve').forEach(button => {
      button.addEventListener('click', () => {
        const result = WorkflowEngine.processTask(button.dataset.id, 'Approve', 'Credit');
        if (result?.success) App.showToast('Loan application approved; it is now in the pacing queue.', 'success');
        else App.showToast(result?.error || 'Application approval failed.', 'danger');
      });
    });
    container.querySelectorAll('.btn-application-reject').forEach(button => {
      button.addEventListener('click', () => {
        const reason = prompt('Enter a reason for returning or rejecting this application:');
        if (!reason?.trim()) return;
        const result = WorkflowEngine.processTask(button.dataset.id, 'Reject', 'Credit', reason.trim());
        if (result) App.showToast('Application returned to the maker / rejected.', 'info');
      });
    });
    container.querySelectorAll('.btn-disburse-loan').forEach(button => {
      button.addEventListener('click', () => {
        const app = state.disbursementQueue.find(item => item.id === button.dataset.id);
        if (!app || !confirm(`Confirm disbursement of ${Formatter.money(app.amount)} to ${app.clientName}?`)) return;
        if (store.updateDisbursementStatus(app.id, 'Disbursed')) {
          App.showToast(`Loan ${app.id} disbursed. A repayment schedule was created.`, 'success');
        }
      });
    });
    container.querySelectorAll('.btn-assess-loan-penalty').forEach(button => {
      button.addEventListener('click', () => {
        const suggested = Number(button.dataset.suggested) || 0;
        const value = prompt(`Suggested penalty: ${Formatter.money(suggested)}\nEnter the authorized amount to record:`, suggested || '');
        if (value === null) return;
        const reason = prompt('Enter the reason / review note for this penalty:');
        if (reason === null) return;
        try {
          store.recordLoanPenalty({
            memberId: button.dataset.memberId,
            loanId: button.dataset.loanId,
            installmentId: button.dataset.installmentId,
            amount: value,
            reason
          });
          App.showToast('Penalty assessment recorded on the loan account.', 'success');
        } catch (error) {
          App.showToast(error.message, 'danger');
        }
      });
    });
    container.querySelectorAll('.form-loan-product').forEach(form => {
      form.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        try {
          store.updateLoanProduct(form.dataset.productId, values);
          App.showToast('Product policy saved for new applications.', 'success');
        } catch (error) {
          App.showToast(error.message, 'danger');
        }
      });
    });
    container.querySelector('#form-add-loan-product')?.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        store.addLoanProduct(values);
        App.showToast('Loan product added.', 'success');
      } catch (error) {
        App.showToast(error.message, 'danger');
      }
    });
  },

  render(container, state) {
    if (this.activeTab !== 'overview') {
      this.renderPortalSection(container, state);
      return;
    }
    const pacing = PacingEngine.getPacingAnalysis(state);
    const pq = PortfolioEngine.getPortfolioMetrics(state);
    const npa = state.npaSummary;
    const workflowTasks = WorkflowEngine.getPendingTasks(state, 'credit');

    const creditActions = `
      <button id="btn-open-loan-application" class="btn btn-primary btn-sm">
        New application
      </button>
      <button id="btn-post-npa-provision" class="btn btn-outline btn-sm" title="Execute double-entry loan loss impairment provision into GL (Dr 5030 / Cr 1250)">
        Post NPA Provision
      </button>
      <button id="btn-export-sasra-form4a" class="btn btn-secondary btn-sm">
        SASRA Form 4A
      </button>
      <button id="btn-auto-pace-queue" class="btn btn-emerald btn-sm">
        Auto-Pace Queue
      </button>
    `;

    container.innerHTML = `
      <div class="workspace-module">
        <div class="workspace-toolbar">
          <div class="workspace-breadcrumb" data-label="Credit">Overview</div>
          <div class="workspace-actions">${creditActions}</div>
        </div>
        ${this.renderPortalNav('overview')}

        <div class="metric-strip">
          <div class="metric-pill">
            <span class="metric-label">Headroom</span>
            <span class="metric-value">${Formatter.money(pacing.safeHeadroomTarget)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Pending pipeline</span>
            <span class="metric-value">${Formatter.money(pacing.totalPendingAmount)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">NPA ratio</span>
            <span class="metric-value">${npa.onlineNpaRatio}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Queue</span>
            <span class="metric-value">${workflowTasks.length}</span>
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
        const result = WorkflowEngine.processTask(taskId, 'Approve', 'Credit');
        if (result?.success) App.showToast(`Workflow Task ${taskId} approved.`, 'success');
        else App.showToast(result?.error || 'Workflow approval failed.', 'danger');
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
            if (store.updateDisbursementStatus(loanId, 'Disbursed')) {
              App.showToast(`Disbursed ${Formatter.money(loan.amount)} to ${loan.clientName}.`, 'success');
            }
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

    container.querySelectorAll('[data-credit-tab]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.creditTab;
        this.render(container, state);
      });
    });
    container.querySelector('#btn-open-loan-application')?.addEventListener('click', () => {
      InputModalView.open('loans');
    });
  }
};

window.CreditView = CreditView;
