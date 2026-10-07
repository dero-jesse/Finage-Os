/**
 * Finage OS v3 - Master Application Bootstrap & View Coordinator
 * Includes User Management RBAC bindings and active operator badge
 */

const App = {
  getUserRoles(state = store.state) {
    const user = store.getCurrentUser();
    return user ? UserManagementEngine.getUserRoles(state, user.id) : [];
  },

  hasPermission(permission, state = store.state) {
    const user = store.getCurrentUser();
    return !!state.isAuthenticated && !!user && this.getUserRoles(state).some(role =>
      role.permissions.includes('READ_ALL_MODULES') || role.permissions.includes(permission)
    );
  },

  hasAnyPermission(permissions, state = store.state) {
    return permissions.some(permission => this.hasPermission(permission, state));
  },

  canAccessWorkspace(workspace, state = store.state) {
    if (!state.isAuthenticated || window.Platform?.context?.operationalStatus !== 'ready') return false;
    const roles = this.getUserRoles(state);
    if (roles.some(role => role.permissions.includes('READ_ALL_MODULES'))) return true;
    const categories = workspace === 'teller' ? ['teller', 'counter-ops'] : [workspace];
    return roles.some(role => categories.includes(role.category));
  },

  canUseInputTab(tab, state = store.state) {
    if (!state.isAuthenticated || window.Platform?.context?.operationalStatus !== 'ready') return false;
    const roles = this.getUserRoles(state);
    const hasCategory = (...categories) => roles.some(role => categories.includes(role.category));
    const permissions = {
      members: () => this.hasPermission('MANAGE_USERS', state) || hasCategory('front-office'),
      transactions: () => this.hasPermission('POST_COUNTER_TX', state),
      loans: () => this.hasAnyPermission(['ORIGINATE_LOAN_APP', 'APPROVE_CREDIT_FACILITY', 'APPROVE_BRANCH_LOAN_TIER1'], state),
      dfi: () => this.hasAnyPermission(['EXECUTE_DFI_DRAWDOWN', 'MODIFY_GL_JOURNAL', 'PLACE_TBILLS'], state),
      opex: () => this.hasAnyPermission(['MODIFY_GL_JOURNAL', 'EXECUTE_DFI_DRAWDOWN'], state),
      bulk: () => this.hasAnyPermission(['POST_COUNTER_TX', 'MODIFY_GL_JOURNAL', 'APPROVE_CREDIT_FACILITY', 'ORIGINATE_LOAN_APP', 'EXECUTE_DFI_DRAWDOWN'], state),
      journal: () => this.hasPermission('MODIFY_GL_JOURNAL', state)
    };
    return !!permissions[tab]?.();
  },

  canOpenInputHub(state = store.state) {
    return ['members', 'transactions', 'loans', 'dfi', 'opex', 'bulk', 'journal']
      .some(tab => this.canUseInputTab(tab, state));
  },

  canOpenReports(state = store.state) {
    return window.Platform?.context?.operationalStatus === 'ready' &&
      this.hasAnyPermission(['REPORTS_ACCESS', 'MANAGE_USERS'], state);
  },

  init() {
    this.viewport = document.getElementById('main-viewport');
    this.tickerBar = document.getElementById('liquidity-ticker-bar');
    this.roleButtons = document.querySelectorAll('.role-nav .role-btn');
    this.modalMount = document.getElementById('input-modal-mount');
    this.userMgmtMount = document.getElementById('user-mgmt-mount');
    this.reportsMount = document.getElementById('reports-modal-mount');
    this.aiWidgetMount = document.getElementById('ai-widget-mount');
    this.clientModalMount = document.getElementById('client-selection-modal-mount');
    this.orgSetupMount = document.getElementById('org-setup-mount');
    this.toastShelf = document.getElementById('toast-shelf'); // required by showToast
    this.portalDrawer = document.getElementById('portal-nav-drawer');
    this.utilityDrawer = document.getElementById('utility-menu-drawer');
    this.drawerOverlay = document.getElementById('drawer-overlay');

    this.initPortalDrawers();

    // Bind Role Switcher Buttons
    this.roleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetRole = e.currentTarget.dataset.role;
        if (targetRole && this.canAccessWorkspace(targetRole)) {
          store.setRole(targetRole);
        } else {
          this.showToast('Your role does not have access to that workspace.', 'danger');
        }
      });
      this.viewport.querySelector('#btn-gate-signout')?.addEventListener('click', async () => {
        await UserManagementEngine.logout(store.state);
        store.state.orgSelectorShown = false;
        store.notify();
      });
    });

    // Render Input Modal
    if (this.modalMount) {
      InputModalView.renderModal(this.modalMount, store.state);
    }

    // Render User Management Modal
    if (this.userMgmtMount) {
      UserManagementView.renderModal(this.userMgmtMount, store.state);
    }

    // Render Client Selection Modal
    if (this.clientModalMount) {
      ClientSelectionModalView.renderModal(this.clientModalMount, store.state);
    }
    if (this.orgSetupMount) OrganizationSetupView.renderModal(this.orgSetupMount, store.state);

    // Setup global input, user-management, and quick actions
    this.bindQuickActions();

    // Subscribe to state changes
    store.subscribe((state) => {
      this.render(state);
    });

    // Initial render
    this.render(store.state);
  },

  render(state) {
    this.populatePortalDrawer();
    this.populateUtilityMenu();
    if (this.reportsMount && this.reportsMount.innerHTML.trim()) {
      ReportsView.renderModal(this.reportsMount, state);
    }

    // 0. Keep product branding independent of the active organization
    const brandTitle = document.getElementById('brand-title-display');
    if (brandTitle) {
      brandTitle.textContent = 'FINAGE OS';
    }
    const organizationTitle = document.getElementById('organization-title-display');
    if (organizationTitle) {
      organizationTitle.textContent = state.institution?.name || 'Select organization';
      organizationTitle.title = state.institution?.name || '';
    }

    // 1. Update Header Role Buttons Active State & Enforce RBAC
    this.roleButtons.forEach(btn => {
      const btnRole = btn.dataset.role;
      const normalizedRole = btnRole === 'counter-ops' ? 'teller' : btnRole;
      btn.style.display = this.canAccessWorkspace(normalizedRole, state) ? 'flex' : 'none';

      const currentNormRole = state.currentRole === 'counter-ops' ? 'teller' : state.currentRole;
      if (normalizedRole === currentNormRole) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Update Active User Badge
    this.updateUserBadge(state);

    // 3. Update Live Liquidity Ticker Bar
    this.updateTicker(state);

    // 4. Render View Based on Auth & Landing State
    if (this.viewport) {
      const needsWorkspace = state.isAuthenticated && state.hasPassedLanding && !this._needsOrgSelection();
      const shouldShowHeader = state.isAuthenticated && state.hasPassedLanding &&
        !this._needsOrgSelection() && Platform?.context?.operationalStatus === 'ready';
      const headerEl = document.querySelector('.top-header');
      if (headerEl) {
        headerEl.style.display = shouldShowHeader ? 'flex' : 'none';
      }
      if (this.tickerBar) {
        this.tickerBar.style.display = shouldShowHeader ? 'flex' : 'none';
      }

      if (state.passwordChangeRequired) {
        LoginView.renderPasswordChange(this.viewport, state);
        return;
      }

      if (!state.hasPassedLanding) {
        LandingView.render(this.viewport, state);
        return;
      }

      if (!state.isAuthenticated) {
        LoginView.render(this.viewport, state);
        return;
      }

      if (this._needsOrgSelection()) {
        if (typeof OrgSelectorView !== 'undefined') {
          OrgSelectorView.render(this.viewport, state);
        }
        return;
      }

      if (Platform?.context?.operationalStatus !== 'ready') {
        this.renderOnlineReadinessGate();
        return;
      }

      if (!needsWorkspace) {
        return;
      }

      this.renderWorkspaceShell(state);
      const setupButton = this.viewport.querySelector('#btn-org-setup-start');
      if (setupButton) setupButton.addEventListener('click', () => OrganizationSetupView.open());
      const workspaceBody = this.viewport.querySelector('#workspace-body');
      if (!workspaceBody) return;
      switch (state.currentRole) {
        case 'front-office':
          BranchView.render(workspaceBody, state);
          break;
        case 'teller':
        case 'counter-ops':
          if (typeof TellerDeskView !== 'undefined') {
            TellerDeskView.render(workspaceBody, state);
          } else {
            BranchView.render(workspaceBody, state);
          }
          break;
        case 'credit':
          CreditView.render(workspaceBody, state);
          break;
        case 'board':
          BoardView.render(workspaceBody, state);
          break;
        case 'treasury':
        default:
          TreasuryView.render(workspaceBody, state);
          break;
      }
      this.updateWorkspaceContext(state);
    }

    // 5. Re-render modals with fresh state
    if (this.modalMount) {
      InputModalView.renderModal(this.modalMount, state);
    }
    if (this.userMgmtMount) {
      UserManagementView.renderModal(this.userMgmtMount, state);
    }
    if (this.clientModalMount) {
      ClientSelectionModalView.renderModal(this.clientModalMount, state);
    }
    if (this.orgSetupMount && !this.orgSetupMount.querySelector('#org-setup-modal')) {
      OrganizationSetupView.renderModal(this.orgSetupMount, state);
    }
    
    // 6. Render AI Widget if authenticated
    if (this.aiWidgetMount) {
      if (typeof AiWidgetView !== 'undefined') {
        AiWidgetView.render(this.aiWidgetMount, state);
      }
    }
  },

  renderOnlineReadinessGate() {
    const context = window.Platform?.context || {};
    const status = context.operationalStatus || 'loading';
    const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    let heading = 'Connecting to Supabase';
    let details = 'Operational records are not available from browser storage. Waiting for an authenticated organization connection.';
    if (status === 'no_org') {
      heading = 'No authorized organization selected';
      details = 'Sign in with an account linked to an active organization before accessing operational data.';
    } else if (status === 'empty') {
      heading = 'No operational records visible to this account';
      details = 'The visible remote tenant lists are empty. You may review supported legacy records for a one-time import; Supabase performs an authoritative empty-tenant check and rejects the import if any operational data exists.';
    } else if (status === 'read_only') {
      heading = 'Supabase data loaded · Online operations not enabled';
      details = context.operationalError || 'The tenant records visible to this authenticated account were loaded from Supabase. Operational workflows remain read-only until their permission-specific, atomic server write APIs are deployed. No browser-side write is accepted as success.';
    } else if (status === 'partial') {
      heading = 'Limited online operations enabled';
      details = 'Only the operations listed below have deployed, permission-checked Supabase RPCs. Other teller, credit, workflow, treasury, setup and administration actions remain blocked.';
    } else if (status === 'error') {
      heading = 'Unable to verify online data';
      details = context.operationalError || 'Supabase tenant data could not be loaded. Operations are blocked.';
    }
    const counts = context.operationalCounts || {};
    this.viewport.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:2rem;background:#f1f5f9;">
        <section style="width:min(720px,100%);padding:2rem;border:1px solid #cbd5e1;border-radius:16px;background:#fff;box-shadow:0 12px 36px rgba(15,23,42,.08);">
          <div style="font-size:.72rem;font-weight:800;letter-spacing:.12em;color:#0f766e;">FINAGE OS · SUPABASE ONLINE GATE</div>
          <h1 style="margin:.5rem 0;font-size:1.35rem;color:#0f172a;">${escapeHtml(heading)}</h1>
          <p style="color:#475569;line-height:1.6;">${escapeHtml(details)}</p>
          ${context.currentOrg ? `<p style="font-size:.82rem;color:#64748b;">Organization: <strong>${escapeHtml(context.currentOrg.name)}</strong></p>` : ''}
          ${status === 'read_only' ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.5rem;margin:1rem 0;">${Object.entries(counts).map(([key, count]) => `<div style="padding:.65rem;background:#f8fafc;border-radius:8px;font-size:.75rem;color:#475569;">${escapeHtml(key)}<strong style="display:block;color:#0f172a;font-size:1rem;">${Number(count) || 0}</strong></div>`).join('')}</div>` : ''}
          ${status === 'partial' ? this.renderOnlineOperations(context, escapeHtml) : ''}
          ${status === 'empty' ? `<button id="btn-review-legacy-import" type="button" style="padding:.7rem 1rem;border:0;border-radius:8px;background:#0f766e;color:white;font-weight:700;cursor:pointer;">Review browser records for one-time import</button><div id="legacy-import-preview" role="status" style="margin-top:1rem;"></div>` : ''}
          ${status === 'error' ? `<button id="btn-retry-online-load" type="button" style="padding:.65rem 1rem;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;font-weight:700;cursor:pointer;">Retry Supabase connection</button>` : ''}
          <button id="btn-gate-signout" type="button" style="margin-left:.5rem;padding:.65rem 1rem;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;font-weight:700;cursor:pointer;">Sign out</button>
          <p style="margin:1.25rem 0 0;font-size:.75rem;color:#64748b;">This fail-closed gate prevents offline or rejected writes from being reported as successful.</p>
        </section>
      </main>`;

    const reviewButton = this.viewport.querySelector('#btn-review-legacy-import');
    if (reviewButton) {
      reviewButton.addEventListener('click', () => {
        const preview = this.viewport.querySelector('#legacy-import-preview');
        try {
          const review = Platform.getLegacyImportPayload();
          preview.innerHTML = `
            <p>Records eligible for a one-time import into <strong>${escapeHtml(context.currentOrg?.name)}</strong>:</p>
            <ul>${Object.entries(review.counts).filter(([key]) => key !== 'totalRecords').map(([key, count]) => `<li>${escapeHtml(key)}: ${count}</li>`).join('')}</ul>
            <p><strong>${review.counts.totalRecords} records total.</strong> Roles, users, module configuration, workflow queues, teller floats, investment portfolios and other non-core local modules are not imported by this migration.</p>
            <button id="btn-confirm-legacy-import" type="button" style="padding:.65rem 1rem;border:0;border-radius:8px;background:#b45309;color:white;font-weight:700;cursor:pointer;">Confirm one-time import; do not overwrite remote data</button>`;
          this.viewport.querySelector('#btn-confirm-legacy-import').addEventListener('click', async event => {
            event.currentTarget.disabled = true;
            event.currentTarget.textContent = 'Waiting for Supabase…';
            try {
              const result = await Platform.importCurrentBrowserData();
              this.showToast(`Supabase accepted the one-time import (${result.counts.totalRecords} records). Operations remain read-only.`, 'success');
            } catch (error) {
              preview.insertAdjacentHTML('beforeend', `<p style="color:#b91c1c;">${escapeHtml(error.message)}</p>`);
              event.currentTarget.disabled = false;
              event.currentTarget.textContent = 'Retry one-time import';
            }
          });
        } catch (error) {
          preview.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(error.message)}</p>`;
        }
      });
    }
    const retryButton = this.viewport.querySelector('#btn-retry-online-load');
    if (retryButton) retryButton.addEventListener('click', async () => {
      retryButton.disabled = true;
      try {
        await Platform.loadOperationalData();
      } catch (_) {
        this.renderOnlineReadinessGate();
      }
    });
    this.bindOnlineOperationForms();
  },

  renderOnlineOperations(context, escapeHtml) {
    const caps = context.writeCapabilities || {};
    const state = store.state;
    const branches = state.branches || [];
    const members = state.members || [];
    const ledger = state.generalLedger || [];
    const options = rows => rows.map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)} (${escapeHtml(row.id)})</option>`).join('');
    const glOptions = ledger.map(account =>
      `<option value="${escapeHtml(account.code)}">${escapeHtml(account.code)} · ${escapeHtml(account.name)}</option>`
    ).join('');
    const selectOptions = rows => rows.map(row =>
      `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name || row.lender || row.category || row.id)} (${escapeHtml(row.id)})</option>`
    ).join('');
    const productOptions = (state.loanProducts || []).map(product =>
      `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${Number(product.annualInterestRate) || 0}%</option>`
    ).join('');
    const applications = state.disbursementQueue || [];
    const applicationCards = applications.map(app => {
      const workflow = (state.workflowTasks || []).find(task => task.id === app.workflowTaskId);
      const isPending = app.status === 'Application Submitted';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.7rem;padding:.65rem;border:1px solid #e2e8f0;border-radius:8px;">
        <div><strong>${escapeHtml(app.id)} · ${escapeHtml(app.clientName)}</strong><div style="font-size:.76rem;color:#64748b;">${escapeHtml(app.product)} · ${escapeHtml(app.status)} · ${escapeHtml(workflow?.makerCheckerStatus || '')} · ${Formatter.money(app.amount)}</div></div>
        <div>${isPending && caps.credit_admin ? `<button type="button" data-domain-review="Approve" data-app-id="${escapeHtml(app.id)}">Approve</button> <button type="button" data-domain-review="Reject" data-app-id="${escapeHtml(app.id)}">Reject</button>` : ''}
        ${app.status === 'Approved - Pending Pacing' && caps.credit_admin ? `<select data-domain-batch="${escapeHtml(app.id)}"><option value="">Pacing</option><option>Batch 1</option><option>Batch 2</option><option>Batch 3</option></select><button type="button" data-domain-disburse="${escapeHtml(app.id)}">Disburse</button>` : ''}</div></div>`;
    }).join('') || '<p>No loan applications.</p>';
    const overdueOptions = members.flatMap(member => (member.activeLoans || []).flatMap(loan =>
      (loan.repaymentSchedule || []).filter(item => item.status !== 'Paid' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10))
        .map(item => `<option value="${escapeHtml(member.id)}|${escapeHtml(loan.loanId || loan.id)}|${escapeHtml(item.id)}">${escapeHtml(member.name)} · ${escapeHtml(loan.loanId || loan.id)} · ${escapeHtml(item.dueDate)}</option>`)
    )).join('');
    const roleOptions = (state.roles || []).map(role =>
      `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name || role.id)}</option>`
    ).join('');
    return `
      <div style="display:grid;gap:1rem;margin-top:1.5rem;">
        ${caps.member_create ? `
          <form id="online-member-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Online member onboarding</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;">
              <input name="name" required placeholder="Full name" aria-label="Member full name">
              <input name="nationalId" required placeholder="National ID" aria-label="Member national ID">
              <input name="phone" required placeholder="Phone" aria-label="Member phone">
              <input name="email" type="email" placeholder="Email (optional)" aria-label="Member email">
              <select name="branchId" required aria-label="Member branch"><option value="">Select branch</option>${options(branches)}</select>
              <input name="occupation" placeholder="Occupation" aria-label="Member occupation">
              <input name="employer" placeholder="Employer" aria-label="Member employer">
            </div>
            <button type="submit" style="margin-top:.7rem;padding:.6rem .9rem;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;">Create member online</button>
            <div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.counter_post ? `
          <form id="online-counter-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Teller counter transaction</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;">
              <select name="type" required aria-label="Counter transaction">
                <option value="Teller Deposit">Deposit</option>
                <option value="Teller Withdrawal">Withdrawal</option>
                <option value="Teller Loan Payment">Loan repayment</option>
              </select>
              <select name="memberId" required aria-label="Member"><option value="">Select member</option>${options(members)}</select>
              <select name="loanId" aria-label="Loan facility" disabled><option value="">Select a member and loan</option></select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" aria-label="Amount">
              <input name="description" placeholder="Reference / description" aria-label="Reference">
            </div>
            <p style="font-size:.74rem;color:#64748b;">Cash is posted against GL 1010 / 2010 or 1200, member balances and the authenticated operator's assigned branch/till. Supabase validates till cash, member savings, loan ownership and balances atomically. This bounded phase uses the selected member/amount; denomination capture, till management and reconciliation remain disabled.</p>
            <button type="submit" style="padding:.6rem .9rem;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;">Post to Supabase</button>
            <div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.manual_journal ? `
          <form id="online-journal-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Manual GL journal</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;">
              <select name="debitCode" required aria-label="Debit account"><option value="">Debit GL account</option>${glOptions}</select>
              <select name="creditCode" required aria-label="Credit account"><option value="">Credit GL account</option>${glOptions}</select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" aria-label="Journal amount">
              <input name="description" required placeholder="Journal description" aria-label="Journal description">
            </div>
            <button type="submit" style="margin-top:.7rem;padding:.6rem .9rem;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;">Post balanced journal</button>
            <div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.credit_application ? `
          <form id="online-loan-application-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Loan application · server workflow</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem;">
              <select name="memberId" required><option value="">Select member</option>${options(members)}</select>
              <select name="productId" required><option value="">Select approved product</option>${productOptions}</select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Principal">
              <input name="termMonths" type="number" min="1" max="600" required placeholder="Term (months)">
              <input name="purpose" required maxlength="500" placeholder="Loan purpose">
              <input name="guarantorMemberId" placeholder="Guarantor member ID (optional)">
              <select name="urgency"><option>Medium</option><option>Low</option><option>High</option></select>
            </div>
            <button type="submit">Submit application online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.credit_admin ? `
          <form id="online-loan-product-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Create loan product</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.6rem;">
              <input name="name" required maxlength="80" placeholder="Product name">
              <input name="annualInterestRate" type="number" min="0" max="1000" step="0.01" required placeholder="Annual interest rate">
              <select name="repaymentMethod"><option value="reducing">Reducing</option><option value="flat">Flat</option></select>
              <input name="penaltyGraceDays" type="number" min="0" max="3650" value="0" placeholder="Penalty grace days">
              <input name="penaltyFixedFee" type="number" min="0" step="0.01" value="0" placeholder="Fixed penalty fee">
              <input name="penaltyDailyRate" type="number" min="0" step="0.001" value="0" placeholder="Daily penalty rate (%)">
            </div>
            <button type="submit">Create product online</button><div class="online-form-result" role="status"></div>
          </form>
          <section style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;"><h2 style="font-size:1rem;">Applications / maker-checker</h2>${applicationCards}</section>` : ''}
        ${caps.credit_admin ? `
          <form id="online-penalty-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Assess overdue loan penalty</h2>
            <select name="installmentRef" required><option value="">Select overdue installment</option>${overdueOptions}</select>
            <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Assessed amount">
            <input name="reason" required maxlength="500" placeholder="Reason">
            <button type="submit">Record assessment online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.treasury_drawdown ? `
          <form id="online-facility-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Register DFI facility</h2>
            <input name="lender" required placeholder="Lender"><input name="facilityType" required placeholder="Facility type">
            <input name="commitment" type="number" min="0.01" required placeholder="Commitment">
            <input name="interestRate" type="number" min="0" step="0.01" value="0" placeholder="Rate %">
            <input name="firstRepaymentDate" type="date"><input name="repaymentAmount" type="number" min="0" value="0" placeholder="Repayment amount">
            <button type="submit">Register facility online</button><div class="online-form-result" role="status"></div>
          </form>
          <form id="online-drawdown-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Draw DFI facility</h2>
            <select name="facilityId" required><option value="">Select facility</option>${selectOptions(state.externalFacilities || [])}</select>
            <input name="amount" type="number" min="0.01" required placeholder="Draw amount">
            <input name="notes" placeholder="Reference"><button type="submit">Draw and post online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.treasury_invest ? `
          <form id="online-investment-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Place treasury investment</h2>
            <input name="institution" required placeholder="Institution"><input name="product" required placeholder="Instrument">
            <input name="principal" type="number" min="0.01" required placeholder="Principal">
            <input name="annualYield" type="number" min="0" step="0.01" value="0" placeholder="Annual yield %">
            <input name="maturityDate" type="date" required>
            <button type="submit">Place investment online</button><div class="online-form-result" role="status"></div>
          </form>
          <div>${(state.shortTermInvestments || []).filter(item => item.status === 'Active').map(item =>
            `<div>${escapeHtml(item.id)} · ${escapeHtml(item.institution)} · ${Formatter.money(item.principal)} · <button type="button" data-investment-redeem="${escapeHtml(item.id)}">Redeem</button></div>`
          ).join('')}</div>` : ''}
        ${caps.opex_manage ? `
          <form id="online-opex-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Add operating expense schedule</h2>
            <input name="category" required placeholder="Category"><input name="monthlyAmount" type="number" min="0.01" required placeholder="Monthly amount">
            <input name="dueDay" type="number" min="1" max="31" value="15" required placeholder="Due day">
            <button type="submit">Save schedule online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.branch_reconcile ? `
          <form id="online-vault-reconciliation-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Vault physical count</h2>
            <select name="branchId" required><option value="">Select branch</option>${options(branches)}</select>
            <input name="cashInVault" type="number" min="0" step="0.01" required placeholder="Counted vault cash">
            <input name="notes" required placeholder="Count / reconciliation note">
            <button type="submit">Submit reconciliation online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.till_reconcile ? `
          <form id="online-till-reconciliation-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Assigned till count</h2>
            <input name="balance" type="number" min="0" step="0.01" required placeholder="Physical till cash">
            <button type="submit">Reconcile assigned till online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.portfolio_provision ? `
          <form id="online-provision-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Post portfolio loan-loss provision</h2>
            <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Provision amount">
            <input name="notes" required placeholder="Provision basis / reference">
            <button type="submit">Post provision online (Dr 5030 / Cr 1250)</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
        ${caps.user_manage ? `
          <form id="online-user-role-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Change existing user's role (server permission checked)</h2>
            <select name="userId" required><option value="">Select user</option>${selectOptions(state.users || [])}</select>
            <select name="roleId" required><option value="">Select role</option>${roleOptions}</select>
            <button type="submit">Replace user roles online</button><div class="online-form-result" role="status"></div>
          </form>
          <form id="online-user-status-form" style="padding:1rem;border:1px solid #cbd5e1;border-radius:12px;">
            <h2 style="font-size:1rem;margin:0 0 .75rem;">Update user status</h2>
            <select name="userId" required><option value="">Select user</option>${selectOptions(state.users || [])}</select>
            <select name="status" required><option>Active</option><option>Suspended</option><option>Inactive</option></select>
            <button type="submit">Update status online</button><div class="online-form-result" role="status"></div>
          </form>` : ''}
      </div>`;
  },

  bindOnlineOperationForms() {
    const memberForm = this.viewport.querySelector('#online-member-form');
    memberForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = memberForm.querySelector('[type="submit"]');
      const result = memberForm.querySelector('.online-form-result');
      const values = Object.fromEntries(new FormData(memberForm).entries());
      let accepted = false;
      let refreshFailed = false;
      button.disabled = true;
      button.textContent = 'Waiting for Supabase…';
      try {
        const created = await Platform.createMember(values, { notify: false });
        accepted = true;
        refreshFailed = Boolean(created.refreshError);
        result.textContent = created.refreshError
          ? `Supabase created ${created.member.name} (${created.member.id}); refresh failed: ${created.refreshError.message}`
          : `Supabase created ${created.member.name} (${created.member.id}).`;
        result.style.color = created.refreshError ? '#b45309' : '#047857';
        if (!created.refreshError) memberForm.reset();
      } catch (error) {
        result.textContent = `Member creation rejected: ${error.message}`;
        result.style.color = '#b91c1c';
      } finally {
        button.disabled = false;
        button.textContent = 'Create member online';
        if (accepted) {
          App.showToast(result.textContent, refreshFailed ? 'warning' : 'success');
          store.notify();
        }
      }
    });

    const counterForm = this.viewport.querySelector('#online-counter-form');
    const loanSelect = counterForm?.querySelector('[name="loanId"]');
    const memberSelect = counterForm?.querySelector('[name="memberId"]');
    const typeSelect = counterForm?.querySelector('[name="type"]');
    const updateLoanOptions = () => {
      if (!counterForm || !loanSelect) return;
      const member = store.state.members.find(item => item.id === memberSelect.value);
      const showLoan = typeSelect.value === 'Teller Loan Payment';
      loanSelect.disabled = !showLoan || !(member?.activeLoans?.length);
      loanSelect.required = showLoan;
      loanSelect.innerHTML = showLoan && member?.activeLoans?.length
        ? `<option value="">Select loan</option>${member.activeLoans.map(loan =>
          `<option value="${String(loan.loanId || loan.id).replace(/[&<>"']/g, '')}">${String(loan.product || loan.loanId || loan.id).replace(/[&<>"']/g, '')} · balance ${Number(loan.outstandingBalance) || 0}</option>`
        ).join('')}`
        : '<option value="">No active loan available</option>';
    };
    memberSelect?.addEventListener('change', updateLoanOptions);
    typeSelect?.addEventListener('change', updateLoanOptions);
    counterForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = counterForm.querySelector('[type="submit"]');
      const result = counterForm.querySelector('.online-form-result');
      const values = Object.fromEntries(new FormData(counterForm).entries());
      const amount = Number(values.amount);
      const glPairs = {
        'Teller Deposit': ['1010', '2010'],
        'Teller Withdrawal': ['2010', '1010'],
        'Teller Loan Payment': ['1010', '1200']
      };
      const [debitCode, creditCode] = glPairs[values.type];
      let accepted = false;
      let refreshFailed = false;
      button.disabled = true;
      button.textContent = 'Waiting for Supabase…';
      counterForm.dataset.idempotencyKey ||= crypto.randomUUID();
      try {
        const posted = await Platform.postFinancialTransaction({
          type: values.type,
          memberId: values.memberId,
          loanId: values.loanId || null,
          amount,
          channel: 'Branch FOSA Counter',
          description: values.description || values.type,
          legs: [
            { glCode: debitCode, type: 'Debit', amount },
            { glCode: creditCode, type: 'Credit', amount }
          ],
          idempotencyKey: counterForm.dataset.idempotencyKey,
          notify: false
        });
        accepted = true;
        refreshFailed = Boolean(posted.refreshError);
        delete counterForm.dataset.idempotencyKey;
        result.textContent = posted.refreshError
          ? `Supabase accepted ${posted.transaction.id}; reload failed: ${posted.refreshError.message}`
          : `Supabase accepted ${posted.transaction.id}.`;
        result.style.color = posted.refreshError ? '#b45309' : '#047857';
        if (!posted.refreshError) counterForm.reset();
      } catch (error) {
        result.textContent = `Transaction rejected: ${error.message}`;
        result.style.color = '#b91c1c';
      } finally {
        button.disabled = false;
        button.textContent = 'Post to Supabase';
        if (accepted) {
          App.showToast(result.textContent, refreshFailed ? 'warning' : 'success');
          store.notify();
        }
      }
    });

    const journalForm = this.viewport.querySelector('#online-journal-form');
    journalForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = journalForm.querySelector('[type="submit"]');
      const result = journalForm.querySelector('.online-form-result');
      const values = Object.fromEntries(new FormData(journalForm).entries());
      const amount = Number(values.amount);
      if (values.debitCode === values.creditCode) {
        result.textContent = 'Choose different debit and credit accounts.';
        result.style.color = '#b91c1c';
        return;
      }
      let accepted = false;
      let refreshFailed = false;
      button.disabled = true;
      button.textContent = 'Waiting for Supabase…';
      journalForm.dataset.idempotencyKey ||= crypto.randomUUID();
      try {
        const posted = await Platform.postFinancialTransaction({
          type: 'Manual GL Journal',
          amount,
          channel: 'Treasury Journal',
          description: values.description,
          legs: [
            { glCode: values.debitCode, type: 'Debit', amount },
            { glCode: values.creditCode, type: 'Credit', amount }
          ],
          idempotencyKey: journalForm.dataset.idempotencyKey,
          notify: false
        });
        accepted = true;
        refreshFailed = Boolean(posted.refreshError);
        delete journalForm.dataset.idempotencyKey;
        result.textContent = posted.refreshError
          ? `Supabase accepted ${posted.transaction.id}; reload failed: ${posted.refreshError.message}`
          : `Supabase accepted balanced journal ${posted.transaction.id}.`;
        result.style.color = posted.refreshError ? '#b45309' : '#047857';
        if (!posted.refreshError) journalForm.reset();
      } catch (error) {
        result.textContent = `Journal rejected: ${error.message}`;
        result.style.color = '#b91c1c';
      } finally {
        button.disabled = false;
        button.textContent = 'Post balanced journal';
        if (accepted) {
          App.showToast(result.textContent, refreshFailed ? 'warning' : 'success');
          store.notify();
        }
      }
    });

    const bindDomainForm = (selector, action, makePayload, successLabel) => {
      const form = this.viewport.querySelector(selector);
      form?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        const result = form.querySelector('.online-form-result');
        const values = Object.fromEntries(new FormData(form).entries());
        button.disabled = true;
        button.textContent = 'Waiting for Supabase…';
        form.dataset.idempotencyKey ||= crypto.randomUUID();
        let accepted = false;
        let refreshError = null;
        try {
          const outcome = await Platform.executeDomainAction(action, makePayload(values), {
            idempotencyKey: form.dataset.idempotencyKey,
            notify: false
          });
          accepted = true;
          refreshError = outcome.refreshError;
          result.textContent = `${successLabel}: ${outcome.result.id || outcome.result.transactionId || outcome.result.applicationId || 'server accepted'}.${refreshError ? ` Refresh failed: ${refreshError.message}` : ''}`;
          result.style.color = refreshError ? '#b45309' : '#047857';
          if (!refreshError) {
            delete form.dataset.idempotencyKey;
            form.reset();
          }
        } catch (error) {
          result.textContent = `Rejected by Supabase: ${error.message}`;
          result.style.color = '#b91c1c';
        } finally {
          button.disabled = false;
          button.textContent = successLabel;
          if (accepted) store.notify();
        }
      });
    };

    bindDomainForm('#online-loan-application-form', 'create_loan_application', values => ({
      memberId: values.memberId, productId: values.productId, amount: Number(values.amount),
      termMonths: Number(values.termMonths), purpose: values.purpose,
      guarantorMemberId: values.guarantorMemberId || null, urgency: values.urgency
    }), 'Submit application');
    bindDomainForm('#online-loan-product-form', 'create_loan_product', values => ({
      name: values.name, annualInterestRate: Number(values.annualInterestRate),
      repaymentMethod: values.repaymentMethod, penaltyGraceDays: Number(values.penaltyGraceDays),
      penaltyFixedFee: Number(values.penaltyFixedFee), penaltyDailyRate: Number(values.penaltyDailyRate)
    }), 'Create product');
    bindDomainForm('#online-penalty-form', 'assess_loan_penalty', values => {
      const [memberId, loanId, installmentId] = values.installmentRef.split('|');
      return { memberId, loanId, installmentId, amount: Number(values.amount), reason: values.reason };
    }, 'Record penalty');
    bindDomainForm('#online-facility-form', 'create_external_facility', values => ({
      lender: values.lender, facilityType: values.facilityType, commitment: Number(values.commitment),
      interestRate: Number(values.interestRate), firstRepaymentDate: values.firstRepaymentDate || null,
      repaymentAmount: Number(values.repaymentAmount) || 0
    }), 'Register facility');
    bindDomainForm('#online-drawdown-form', 'draw_external_facility', values => ({
      facilityId: values.facilityId, amount: Number(values.amount), notes: values.notes
    }), 'Draw facility');
    bindDomainForm('#online-investment-form', 'create_investment', values => ({
      institution: values.institution, product: values.product, principal: Number(values.principal),
      annualYield: Number(values.annualYield), maturityDate: values.maturityDate
    }), 'Place investment');
    bindDomainForm('#online-opex-form', 'create_operating_expense', values => ({
      category: values.category, monthlyAmount: Number(values.monthlyAmount), dueDay: Number(values.dueDay)
    }), 'Save expense schedule');
    bindDomainForm('#online-vault-reconciliation-form', 'reconcile_vault', values => ({
      branchId: values.branchId, cashInVault: Number(values.cashInVault), notes: values.notes
    }), 'Submit vault reconciliation');
    bindDomainForm('#online-till-reconciliation-form', 'reconcile_assigned_till', values => ({
      balance: Number(values.balance)
    }), 'Reconcile assigned till');
    bindDomainForm('#online-provision-form', 'post_portfolio_provision', values => ({
      amount: Number(values.amount), notes: values.notes
    }), 'Post provision');
    bindDomainForm('#online-user-role-form', 'update_user_roles', values => ({
      userId: values.userId, roles: [values.roleId]
    }), 'Update user role');
    bindDomainForm('#online-user-status-form', 'update_user_status', values => ({
      userId: values.userId, status: values.status
    }), 'Update user status');

    this.viewport.querySelectorAll('[data-domain-review]').forEach(button => {
      button.addEventListener('click', async () => {
        const decision = button.dataset.domainReview;
        const reason = decision === 'Reject' ? prompt('Enter a reason for rejecting this application:') : '';
        if (decision === 'Reject' && !reason?.trim()) return;
        button.disabled = true;
        try {
          const outcome = await Platform.executeDomainAction('review_loan_application', {
            applicationId: button.dataset.appId, decision, reason: reason?.trim() || ''
          }, { idempotencyKey: button.dataset.idempotencyKey ||= crypto.randomUUID(), notify: false });
          App.showToast(`Supabase recorded the loan ${decision.toLowerCase()} decision (${outcome.result.application?.id || button.dataset.appId}).`, outcome.refreshError ? 'warning' : 'success');
          store.notify();
        } catch (error) {
          button.disabled = false;
          App.showToast(`Loan review rejected: ${error.message}`, 'danger');
        }
      });
    });
    this.viewport.querySelectorAll('[data-domain-disburse]').forEach(button => {
      button.addEventListener('click', async () => {
        const appId = button.dataset.domainDisburse;
        if (!confirm(`Confirm online disbursement for ${appId}?`)) return;
        button.disabled = true;
        try {
          const outcome = await Platform.executeDomainAction('disburse_loan_application', { applicationId: appId }, {
            idempotencyKey: button.dataset.idempotencyKey ||= crypto.randomUUID(), notify: false
          });
          App.showToast(`Supabase accepted disbursement ${outcome.result.id}.`, outcome.refreshError ? 'warning' : 'success');
          store.notify();
        } catch (error) {
          button.disabled = false;
          App.showToast(`Disbursement rejected: ${error.message}`, 'danger');
        }
      });
    });
    this.viewport.querySelectorAll('[data-domain-batch]').forEach(select => {
      select.addEventListener('change', async () => {
        if (!select.value) return;
        select.disabled = true;
        try {
          const outcome = await Platform.executeDomainAction('set_loan_pacing', {
            applicationId: select.dataset.domainBatch, batch: select.value
          }, { idempotencyKey: select.dataset.idempotencyKey ||= crypto.randomUUID(), notify: false });
          App.showToast(`Supabase assigned ${outcome.result.batch} pacing.`, outcome.refreshError ? 'warning' : 'success');
          store.notify();
        } catch (error) {
          select.disabled = false;
          App.showToast(`Pacing update rejected: ${error.message}`, 'danger');
        }
      });
    });
    this.viewport.querySelectorAll('[data-investment-redeem]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm(`Confirm redemption of investment ${button.dataset.investmentRedeem}?`)) return;
        button.disabled = true;
        try {
          const outcome = await Platform.executeDomainAction('redeem_investment', {
            investmentId: button.dataset.investmentRedeem
          }, { idempotencyKey: button.dataset.idempotencyKey ||= crypto.randomUUID(), notify: false });
          App.showToast(`Supabase accepted redemption ${outcome.result.id}.`, outcome.refreshError ? 'warning' : 'success');
          store.notify();
        } catch (error) {
          button.disabled = false;
          App.showToast(`Redemption rejected: ${error.message}`, 'danger');
        }
      });
    });
  },

  renderWorkspaceShell(state) {
    if (!this.viewport) return;
    const currentRole = state.currentRole || 'treasury';
    const portalName = {
      treasury: 'Treasury',
      'front-office': 'FOSA',
      teller: 'Teller',
      board: 'Board',
      credit: 'Credit'
    }[currentRole] || 'Operations';
    const activeOrg = window.Platform?.getActiveOrg();
    const currentUser = store.getCurrentUser();
    const canManageOrg = currentUser && UserManagementEngine.getUserRoles(state, currentUser.id)
      .some(role => role.permissions.includes('MANAGE_USERS'));
    const setupNotice = activeOrg?.setup_completed === false && canManageOrg
      ? `<section style="display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem 1rem;background:#fffbeb;border-bottom:1px solid #fcd34d;color:#78350f;"><div><strong style="font-size:.8rem;">Organization setup is incomplete</strong><div style="font-size:.72rem;margin-top:2px;">Add branches, import existing members, balances, loans, or transaction history.</div></div><button id="btn-org-setup-start" class="btn btn-secondary btn-sm" type="button">Continue Setup</button></section>`
      : '';

    this.viewport.innerHTML = `
      <div class="workspace-shell">
        <header id="workspace-context-bar" class="workspace-context-bar" aria-live="polite">
          <div class="workspace-context-main">
            <div class="workspace-context-kicker">${portalName}</div>
            <h1>${portalName} Workspace</h1>
          </div>
          <div class="workspace-context-actions">
            <span class="workspace-pill workspace-pill--neutral">Live</span>
            <span class="workspace-pill workspace-pill--highlight">${portalName}</span>
          </div>
        </header>
        ${setupNotice}
        <div id="workspace-body" class="workspace-body"></div>
      </div>
    `;
  },

  updateWorkspaceContext(state) {
    const bar = document.getElementById('workspace-context-bar');
    if (!bar) return;
    const roleMap = {
      treasury: { label: 'Treasury', task: 'Liquidity & funding operations' },
      'front-office': { label: 'FOSA', task: 'Branch operations & member services' },
      teller: { label: 'Teller', task: 'Cash desk operations & reconciliation' },
      credit: { label: 'Credit', task: 'Loan applications, client loans & collections' },
      board: { label: 'Board', task: 'Governance, risk & oversight' }
    };
    const current = roleMap[state.currentRole] || roleMap.treasury;
    bar.innerHTML = `
      <div class="workspace-context-main">
        <div class="workspace-context-kicker">${current.label}</div>
        <h1>${current.label} Workspace</h1>
      </div>
      <div class="workspace-context-actions">
        <span class="workspace-pill workspace-pill--neutral">${current.task}</span>
        <span class="workspace-pill workspace-pill--highlight">Live</span>
      </div>
    `;
  },

  initPortalDrawers() {
    const openPortalBtn = document.getElementById('btn-open-portal-nav');
    const openActionsBtn = document.getElementById('btn-open-actions');
    const portalDrawer = this.portalDrawer;
    const utilityDrawer = this.utilityDrawer;
    const closeButtons = document.querySelectorAll('[data-close-drawer]');

    if (openPortalBtn && portalDrawer) {
      openPortalBtn.addEventListener('click', () => {
        this.toggleDrawer(portalDrawer, utilityDrawer);
      });
    }

    if (openActionsBtn && utilityDrawer) {
      openActionsBtn.addEventListener('click', () => {
        this.toggleDrawer(utilityDrawer, portalDrawer);
      });
    }

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.closeDrawer === 'portal' ? portalDrawer : utilityDrawer;
        if (target) {
          target.classList.remove('open');
          target.setAttribute('aria-hidden', 'true');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        [portalDrawer, utilityDrawer].forEach(drawer => {
          if (drawer) {
            drawer.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
          }
        });
      }
    });

    this.populatePortalDrawer();
    this.populateUtilityMenu();
  },

  toggleDrawer(openDrawer, siblingDrawer) {
    if (!openDrawer) return;
    const isOpen = openDrawer.classList.contains('open');
    if (siblingDrawer) {
      siblingDrawer.classList.remove('open');
      siblingDrawer.setAttribute('aria-hidden', 'true');
    }
    openDrawer.classList.toggle('open', !isOpen);
    openDrawer.setAttribute('aria-hidden', String(isOpen));
  },

  populatePortalDrawer() {
    const list = document.getElementById('portal-drawer-list');
    if (!list) return;

    const portalGroups = [
      { label: 'Dashboard', items: [
        { name: 'Dashboard', action: 'dashboard' }
      ]},
      { label: 'FOSA', items: [
        { name: 'Overview', role: 'front-office' },
        { name: 'Member Onboarding', role: 'front-office' },
        { name: 'Approval Queue', role: 'front-office' },
        { name: 'Teller Monitor', role: 'teller' },
        { name: 'Cash Management', role: 'front-office' },
        { name: 'Transactions', role: 'front-office' },
        { name: 'End-of-Day', role: 'front-office' }
      ]},
      { label: 'Treasury', items: [
        { name: 'Overview', role: 'treasury' },
        { name: 'Liquidity', role: 'treasury' },
        { name: 'Cash', role: 'treasury' },
        { name: 'Funding', role: 'treasury' },
        { name: 'Maturity Ladder', role: 'treasury' },
        { name: 'GL', role: 'treasury' }
      ]},
      { label: 'Credit', items: [
        { name: 'Overview', role: 'credit', tab: 'overview' },
        { name: 'Applications', role: 'credit', tab: 'applications' },
        { name: 'Client loans', role: 'credit', tab: 'portfolio' },
        { name: 'Collections & penalties', role: 'credit', tab: 'collections' },
        { name: 'Products & rates', role: 'credit', tab: 'products' }
      ]},
      { label: 'Board', items: [
        { name: 'Overview', role: 'board' }
      ]},
      { label: 'Administration', items: [
        { name: 'Users & Access', action: 'users' },
        { name: 'Organization Setup', action: 'org-setup' }
      ]},
      { label: 'Reports', items: [
        { name: 'Portal Menu', action: 'reports' }
      ]}
    ];

    const visibleGroups = portalGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.role) return this.canAccessWorkspace(item.role);
        if (item.action === 'dashboard') return true;
        if (item.action === 'users' || item.action === 'org-setup') return this.hasPermission('MANAGE_USERS');
        if (item.action === 'reports') return this.canOpenReports();
        return false;
      })
    })).filter(group => group.items.length);

    list.innerHTML = visibleGroups.map(group => `
      <div class="drawer-group">
        <div class="drawer-group-label">${group.label}</div>
        <div class="drawer-menu-items">
          ${group.items.map(item => `
            <button type="button" class="drawer-menu-item" data-portal-action="${item.role || item.action}" data-portal-tab="${item.tab || ''}">
              <span>${item.name}</span>
              <span class="drawer-item-meta">Open</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.drawer-menu-item').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.portalAction;
        if (action === 'dashboard') {
          const fallbackRole = store.state.currentRole || 'treasury';
          store.setRole(fallbackRole);
        } else if (action === 'treasury' || action === 'front-office' || action === 'teller' || action === 'credit' || action === 'board') {
          if (action === 'credit' && button.dataset.portalTab) {
            CreditView.activeTab = button.dataset.portalTab;
          }
          store.setRole(action);
        } else if (action === 'reports') {
          ReportsView.open();
        } else if (action === 'users') {
          UserManagementView.open();
        } else if (action === 'org-setup') {
          OrganizationSetupView.open();
        }
        this.closeAllDrawers();
      });
    });
  },

  populateUtilityMenu() {
    const list = document.getElementById('utility-menu-list');
    if (!list) return;

    const items = [
      ...(this.canOpenInputHub() ? [{ label: 'Input Hub', action: () => InputModalView.open() }] : []),
      ...(this.hasPermission('MANAGE_USERS') ? [{ label: 'Users', action: () => UserManagementView.open() }] : []),
      ...(this.hasPermission('MANAGE_USERS') ? [{ label: 'Organization Setup', action: () => OrganizationSetupView.open() }] : []),
      ...(this.canOpenReports() ? [{ label: 'Reports', action: () => ReportsView.open() }] : []),
      { label: 'Sign Out', action: async () => {
        await UserManagementEngine.logout(store.state);
        store.save();
      } }
    ];

    list.innerHTML = items.map(item => `
      <button type="button" class="drawer-menu-item" data-action-menu="${item.label}">${item.label}</button>
    `).join('');

    list.querySelectorAll('.drawer-menu-item').forEach((button, idx) => {
      button.addEventListener('click', () => {
        items[idx].action();
        this.closeAllDrawers();
      });
    });
  },

  closeAllDrawers() {
    [this.portalDrawer, this.utilityDrawer].forEach(drawer => {
      if (drawer) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
      }
    });
  },

  // Determine if the user still needs to pick an org
  _needsOrgSelection() {
    if (!window.Platform) return false;
    // Explicit switch request
    if (store.state.orgSelectorShown) return true;
    const orgs = Platform.getOrganizations();
    if (!orgs || orgs.length === 0) {
      // A verified live superuser with no tenants must start in organization setup.
      return !!(window.supabase && Platform.isSuperuser());
    }
    const activeOrgs = orgs.filter(o => o.status === 'active');
    if (activeOrgs.length <= 1) return false; // Auto-selected or none
    // Multiple orgs — need explicit selection
    return !Platform.context.currentOrgId;
  },

  _updateOrgSwitcherBtn() {
    if (!window.Platform) return;
    let btn = document.getElementById('btn-org-switch');
    if (!btn) return;
    const org = Platform.getActiveOrg();
    if (org) {
      btn.textContent = '🏦 ' + (org.name.split(' ')[0]);
      btn.style.display = 'flex';
    } else if (Platform.isSuperuser()) {
      btn.textContent = '🏦 Select Org';
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  },

  updateUserBadge(state) {
    const badge = document.getElementById('active-user-badge');
    if (!badge) return;

    const currentUser = store.getCurrentUser();
    if (!currentUser) return;
    
    const roleObjs = UserManagementEngine.getUserRoles(state, currentUser.id);
    const roleName = roleObjs.length > 0 ? roleObjs.map(r => r.name).join(', ') : 'Unknown Role';

    const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    badge.innerHTML = `
      <div class="user-avatar-sm">${initials}</div>
      <div class="user-badge-info">
        <span class="user-badge-name">${currentUser.name}</span>
        <span class="user-badge-role">${roleName}</span>
      </div>
    `;
  },

  updateTicker(state) {
    if (!this.tickerBar) return;
    const balances = CashEngine.getAggregateBalances(state);
    const liquidity = CashEngine.calculateLiquidityRatios(state);
    const npa = state.npaSummary;
    const currentUser = store.getCurrentUser();
    const pendingWF = state.workflowTasks ? state.workflowTasks.filter(t => !t.makerCheckerStatus.includes('Approved')).length : 0;

    this.tickerBar.innerHTML = `
      <!-- Group 1: Liquidity & Compliance (Informational) -->
      <div class="ticker-group">
        <div class="ticker-item">
          <span class="ticker-label">Liquid Assets:</span>
          <span class="ticker-value">${Formatter.money(balances.totalGrossLiquidAssets)}</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">SASRA Liquidity:</span>
          <span class="ticker-value" style="color: ${liquidity.statutoryRatio < 15 ? 'var(--accent-rose)' : 'var(--accent-aqua)'};">
            ${liquidity.statutoryRatio.toFixed(1)}%
          </span>
          <span class="ticker-badge ${liquidity.statusClass}">
            ${liquidity.complianceStatus}
          </span>
        </div>
      </div>
      
      <div class="ticker-divider"></div>

      <!-- Group 2: Actionable & Risk (Stronger Visual Treatment) -->
      <div class="ticker-group actionable">
        <div class="ticker-item">
          <span class="ticker-label">Buffer:</span>
          <span class="ticker-value" style="color: var(--accent-aqua); font-weight: 700;">+${Formatter.money(liquidity.surplusDeficitAmount, true)}</span>
        </div>
        <div class="ticker-item">
          <span class="ticker-label">Online NPA:</span>
          <span class="ticker-value" style="color: ${npa.onlineNpaRatio > 5.0 ? 'var(--accent-rose)' : 'var(--accent-orange)'}; font-weight: 800;">${npa.onlineNpaRatio}%</span>
        </div>
        <div class="ticker-item highlight-action">
          <span class="ticker-label">Workflow:</span>
          <span class="ticker-value" style="color: #fff; background: var(--accent-orange); padding: 2px 6px; border-radius: 4px;">${pendingWF} Pending</span>
        </div>
      </div>
      
      <div class="ticker-divider"></div>

      <!-- Group 3: Session Info -->
      <div class="ticker-group">
        <div class="ticker-item">
          <span class="ticker-label">Operator:</span>
          <span class="ticker-value" style="color: var(--text-dim);">${currentUser ? currentUser.name.split(' ')[0] : '—'}</span>
        </div>
      </div>
    `;
  },

  bindQuickActions() {
    // Open Universal Data Input Hub
    const btnOpenInput = document.getElementById('btn-open-input-hub');
    if (btnOpenInput) {
      btnOpenInput.addEventListener('click', () => {
        InputModalView.open();
      });
    }

    // Open User Management & RBAC Center
    const btnOpenUserMgmt = document.getElementById('btn-open-user-mgmt');
    if (btnOpenUserMgmt) {
      btnOpenUserMgmt.addEventListener('click', () => {
        UserManagementView.open();
      });
    }

    // Open Admin Reports Portal
    const btnOpenReports = document.getElementById('btn-open-reports');
    if (btnOpenReports) {
      btnOpenReports.addEventListener('click', () => {
        const currentUser = store.getCurrentUser();
        const currentRoleObjs = currentUser ? UserManagementEngine.getUserRoles(store.state, currentUser.id) : [];
        const canOpenReports = currentRoleObjs.some(r =>
          r.permissions.includes('READ_ALL_MODULES') ||
          r.permissions.includes('MANAGE_USERS') ||
          r.permissions.includes('REPORTS_ACCESS')
        );

        if (canOpenReports) {
          ReportsView.open();
        } else {
          App.showToast('Unauthorized: reporting access is limited to admin and oversight roles.', 'error');
        }
      });
    }

    // Logout (async — ends Supabase session)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        await UserManagementEngine.logout(store.state);
        store.save();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
      if (Platform?.context?.operationalStatus !== 'ready') return;
      InputModalView.open();
    }
    if (e.altKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      if (Platform?.context?.operationalStatus !== 'ready') return;
        const currentUser = store.getCurrentUser();
        const currentRoleObjs = currentUser ? UserManagementEngine.getUserRoles(store.state, currentUser.id) : [];
        if (currentRoleObjs.some(r => r.permissions.includes('MANAGE_USERS'))) {
          UserManagementView.open();
        } else {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Unauthorized: System Admin access required.', 'error');
          }
        }
      }
    });

  },

  showToast(message, type = 'info') {
    if (!this.toastShelf) return;
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    let tagText = 'INFO';
    let tagBg = 'var(--primary-subtle)';
    let tagColor = 'var(--primary-dark)';
    if (type === 'success') {
      tagText = 'OK';
      tagBg = 'var(--accent-emerald-subtle)';
      tagColor = 'var(--accent-emerald)';
    } else if (type === 'warning') {
      tagText = 'WARN';
      tagBg = 'var(--accent-amber-subtle)';
      tagColor = 'var(--accent-amber)';
    } else if (type === 'danger') {
      tagText = 'ALERT';
      tagBg = 'var(--accent-rose-subtle)';
      tagColor = 'var(--accent-rose)';
    }

    toast.innerHTML = `
      <span style="font-family: var(--font-mono); font-size: 0.65rem; font-weight: 800; letter-spacing: 0.05em; padding: 2px 6px; border-radius: var(--radius-xs); background: ${tagBg}; color: ${tagColor}; border: 1px solid currentColor;">
        ${tagText}
      </span>
    `;
    const messageNode = document.createElement('div');
    messageNode.style.cssText = 'font-size:0.8rem;font-weight:500;color:#0f172a;flex:1;';
    messageNode.textContent = message;
    toast.appendChild(messageNode);

    this.toastShelf.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', async () => {
  // Resolve the authenticated tenant and load its authorization records before
  // restoring app login state; browser copies are never used for this purpose.
  if (window.Platform) {
    try {
      await Platform.init();
    } catch (e) {
      console.warn('[Platform] init error:', e.message);
    }
  }

  // Restore login only after tenant users and roles have come from Supabase.
  if (window.supabase) {
    try {
      const restored = await UserManagementEngine.restoreSession(store.state);
      if (restored) console.log('[Auth] Session restored from Supabase JWT.');
    } catch (e) {
      console.warn('[Auth] Session restore failed:', e.message);
    }
  }

  App.init();
});
