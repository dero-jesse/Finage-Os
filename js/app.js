/**
 * Finage OS v3 - Master Application Bootstrap & View Coordinator
 * Includes User Management RBAC bindings and active operator badge
 */

const App = {
  init() {
    this.viewport = document.getElementById('main-viewport');
    this.tickerBar = document.getElementById('liquidity-ticker-bar');
    this.roleButtons = document.querySelectorAll('.role-nav .role-btn');
    this.modalMount = document.getElementById('input-modal-mount');
    this.userMgmtMount = document.getElementById('user-mgmt-mount');
    this.reportsMount = document.getElementById('reports-modal-mount');
    this.aiWidgetMount = document.getElementById('ai-widget-mount');
    this.clientModalMount = document.getElementById('client-selection-modal-mount');
    this.toastShelf = document.getElementById('toast-shelf'); // required by showToast
    this.portalDrawer = document.getElementById('portal-nav-drawer');
    this.utilityDrawer = document.getElementById('utility-menu-drawer');
    this.drawerOverlay = document.getElementById('drawer-overlay');

    this.initPortalDrawers();

    // Bind Role Switcher Buttons
    this.roleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetRole = e.currentTarget.dataset.role;
        if (targetRole) {
          store.setRole(targetRole);
        }
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

    // Setup Global Input Hub, User Mgmt & Quick Simulation Actions
    this.bindQuickActions();

    // Subscribe to state changes
    store.subscribe((state) => {
      this.render(state);
    });

    // Initial render
    this.render(store.state);
  },

  render(state) {
    if (this.reportsMount && this.reportsMount.innerHTML.trim()) {
      ReportsView.renderModal(this.reportsMount, state);
    }

    // 0. Update Brand Info dynamically
    const brandTitle = document.getElementById('brand-title-display');
    if (brandTitle) {
      brandTitle.innerHTML = `${state.institution.name.split(' ')[0].toUpperCase()} OS`;
    }

    // 1. Update Header Role Buttons Active State & Enforce RBAC
    const currentUser = store.getCurrentUser();
    const currentRoleObjs = currentUser ? UserManagementEngine.getUserRoles(state, currentUser.id) : [];
    const canReadAll = currentRoleObjs.some(r => r.permissions.includes('READ_ALL_MODULES'));
    
    this.roleButtons.forEach(btn => {
      const btnRole = btn.dataset.role;
      const normalizedRole = btnRole === 'counter-ops' ? 'teller' : btnRole;
      
      if (canReadAll || currentRoleObjs.some(r => r.category === normalizedRole || (normalizedRole === 'teller' && (r.category === 'teller' || r.category === 'counter-ops')))) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }

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
      const shouldShowHeader = state.isAuthenticated && state.hasPassedLanding && !this._needsOrgSelection();
      const headerEl = document.querySelector('.top-header');
      if (headerEl) {
        headerEl.style.display = shouldShowHeader ? 'flex' : 'none';
      }
      if (this.tickerBar) {
        this.tickerBar.style.display = shouldShowHeader ? 'flex' : 'none';
      }

      if (!state.hasPassedLanding) {
        LandingView.render(this.viewport, state);
        return;
      }

      if (state.passwordChangeRequired) {
        LoginView.renderPasswordChange(this.viewport, state);
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

      if (!needsWorkspace) {
        return;
      }

      this.renderWorkspaceShell(state);
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
    
    // 6. Render AI Widget if authenticated
    if (this.aiWidgetMount) {
      if (typeof AiWidgetView !== 'undefined') {
        AiWidgetView.render(this.aiWidgetMount, state);
      }
    }
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
      credit: { label: 'Credit', task: 'Applications, approval queue & NPA management' },
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
        { name: 'Overview', role: 'credit' },
        { name: 'Applications', role: 'credit' },
        { name: 'Approval Queue', role: 'credit' },
        { name: 'Portfolio', role: 'credit' },
        { name: 'Collections', role: 'credit' }
      ]},
      { label: 'Board', items: [
        { name: 'Overview', role: 'board' }
      ]},
      { label: 'Administration', items: [
        { name: 'Portal Menu', action: 'users' }
      ]},
      { label: 'Reports', items: [
        { name: 'Portal Menu', action: 'reports' }
      ]}
    ];

    list.innerHTML = portalGroups.map(group => `
      <div class="drawer-group">
        <div class="drawer-group-label">${group.label}</div>
        <div class="drawer-menu-items">
          ${group.items.map(item => `
            <button type="button" class="drawer-menu-item" data-portal-action="${item.role || item.action}">
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
          store.setRole(action);
        } else if (action === 'reports') {
          ReportsView.open();
        } else if (action === 'users') {
          UserManagementView.open();
        }
        this.closeAllDrawers();
      });
    });
  },

  populateUtilityMenu() {
    const list = document.getElementById('utility-menu-list');
    if (!list) return;

    const items = [
      { label: 'Input Hub', action: () => InputModalView.open() },
      { label: 'Users', action: () => UserManagementView.open() },
      { label: 'Reports', action: () => ReportsView.open() },
      { label: 'Mobile Inflow', action: () => {
        const simAmount = 250000;
        CoreBankingEngine.executeTransaction(store.state, {
          type: 'Bulk M-Pesa C2B Inflow Shock',
          memberId: null,
          amount: simAmount,
          channel: 'M-Pesa B2C/C2B',
          debitGL: '1040',
          creditGL: '2010',
          description: `Institutional Member Mobile Inflow (+${Formatter.money(simAmount)})`
        });
        App.showToast(`Simulated +${Formatter.money(simAmount)} Bulk M-Pesa C2B Inflow. Instant GL Dr 1040 / Cr 2010 posted.`, 'success');
      } },
      { label: 'Reset Data', action: () => {
        if (confirm('Reset Finage OS to v3 institutional baseline seed data?')) {
          store.resetState();
          this.showToast('System reset to v3 institutional baseline.', 'info');
        }
      } },
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
        InputModalView.open();
      }
      if (e.altKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
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

    const btnSimulateDeposit = document.getElementById('btn-quick-deposit');
    if (btnSimulateDeposit) {
      btnSimulateDeposit.addEventListener('click', () => {
        const simAmount = 250000;
        CoreBankingEngine.executeTransaction(store.state, {
          type: 'Bulk M-Pesa C2B Inflow Shock',
          memberId: null,
          amount: simAmount,
          channel: 'M-Pesa B2C/C2B',
          debitGL: '1040',
          creditGL: '2010',
          description: `Institutional Member Mobile Inflow (+${Formatter.money(simAmount)})`
        });
        this.showToast(`Simulated +${Formatter.money(simAmount)} Bulk M-Pesa C2B Inflow. Instant GL Dr 1040 / Cr 2010 posted.`, 'success');
      });
    }


    const btnSync = document.getElementById('sync-status-badge');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        if (window.SupabaseSync) {
          this.showToast('Synchronizing with Supabase cloud database…', 'info');
          try {
            await window.SupabaseSync.pullAll(store.state);
            await window.SupabaseSync.pushAll(store.state);
            this.showToast('Sync complete: Local & Supabase states aligned.', 'success');
          } catch (e) {
            this.showToast(`Sync error: ${e.message}`, 'danger');
          }
        }
      });
    }

    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Reset Finage OS to v3 institutional baseline seed data?')) {
          store.resetState();
          this.showToast('System reset to v3 institutional baseline.', 'info');
        }
      });
    }
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
      <div style="font-size: 0.8rem; font-weight: 500; color: #0f172a; flex: 1;">${message}</div>
    `;

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
  // 1. Try to restore an existing Supabase Auth session (returning operator auto-login)
  if (window.supabase) {
    try {
      const restored = await UserManagementEngine.restoreSession(store.state);
      if (restored) {
        console.log('[Auth] Session restored from Supabase JWT.');
        store.saveQuiet && store.saveQuiet();
      }
    } catch (e) {
      console.warn('[Auth] Session restore failed:', e.message);
    }
  }

  // 2. Immediate UI render from local operational state (0ms latency)
  App.init();

  // 3. Initialize Platform multi-org context manager
  if (window.Platform) {
    try {
      await Platform.init();
      // If org was resolved, patch store institution info
      if (Platform.getActiveOrg() || Platform.isSuperuser()) {
        store.notify();
      }
    } catch (e) {
      console.warn('[Platform] init error:', e.message);
    }
  }

  // 4. Initialize Supabase sync protocol in background
  if (window.SupabaseSync && typeof window.SupabaseSync.init === 'function') {
    try {
      await window.SupabaseSync.init(store);
    } catch (e) {
      console.error('Supabase sync initialization error:', e);
    }
  }
});
