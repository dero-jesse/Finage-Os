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
    const brandSub = document.getElementById('brand-subtitle-display');
    if (brandSub) {
      brandSub.innerHTML = `${state.institution.type}`;
    }

    // 1. Update Header Role Buttons Active State & Enforce RBAC
    const currentUser = store.getCurrentUser();
    const currentRoleObjs = currentUser ? UserManagementEngine.getUserRoles(state, currentUser.id) : [];
    const canReadAll = currentRoleObjs.some(r => r.permissions.includes('READ_ALL_MODULES'));
    
    this.roleButtons.forEach(btn => {
      const btnRole = btn.dataset.role;
      const normalizedRole = btnRole === 'counter-ops' ? 'teller' : btnRole;
      
      // Enforce RBAC Visibility
      if (canReadAll || currentRoleObjs.some(r => r.category === normalizedRole)) {
        btn.style.display = 'flex'; // Show authorized tabs
      } else {
        btn.style.display = 'none'; // Hide unauthorized tabs
      }

      // Update Active State
      if (btnRole === state.currentRole) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Enforce RBAC for User Management (System Admin Only)
    const btnUserMgmt = document.getElementById('btn-open-user-mgmt');
    if (btnUserMgmt) {
      if (currentRoleObjs.some(r => r.permissions.includes('MANAGE_USERS'))) {
        btnUserMgmt.style.display = 'flex';
      } else {
        btnUserMgmt.style.display = 'none';
      }
    }

    const btnReports = document.getElementById('btn-open-reports');
    if (btnReports) {
      const canOpenReports = currentRoleObjs.some(r =>
        r.permissions.includes('READ_ALL_MODULES') ||
        r.permissions.includes('MANAGE_USERS') ||
        r.permissions.includes('REPORTS_ACCESS')
      );
      btnReports.style.display = canOpenReports ? 'flex' : 'none';
    }

    // 3. Update Active User Badge
    this.updateUserBadge(state);

    // 4. Update Live Liquidity Ticker Bar
    this.updateTicker(state);

    // 5. Render View Based on Auth & Landing State
    if (this.viewport) {
      if (!state.hasPassedLanding) {
        document.querySelector('.top-header').style.display = 'none';
        if (this.tickerBar) this.tickerBar.style.display = 'none';
        LandingView.render(this.viewport, state);
      } else if (!state.isAuthenticated) {
        document.querySelector('.top-header').style.display = 'none';
        if (this.tickerBar) this.tickerBar.style.display = 'none';
        LoginView.render(this.viewport, state);
      } else {
        document.querySelector('.top-header').style.display = 'flex';
        if (this.tickerBar) this.tickerBar.style.display = 'flex';
        
        switch (state.currentRole) {
          case 'front-office':
            BranchView.render(this.viewport, state);
            break;
          case 'teller':
          case 'counter-ops':
            if (typeof TellerDeskView !== 'undefined') {
              TellerDeskView.render(this.viewport, state);
            } else {
              BranchView.render(this.viewport, state);
            }
            break;
          case 'credit':
            CreditView.render(this.viewport, state);
            break;
          case 'board':
            BoardView.render(this.viewport, state);
            break;
          case 'treasury':
          default:
            TreasuryView.render(this.viewport, state);
            break;
        }
      }
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

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        UserManagementEngine.logout(store.state);
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
  // 1. Immediate UI render from local operational state (0ms latency)
  App.init();

  // 2. Initialize Supabase sync protocol in background
  if (window.SupabaseSync && typeof window.SupabaseSync.init === 'function') {
    try {
      await window.SupabaseSync.init(store);
    } catch (e) {
      console.error("Supabase sync initialization error:", e);
    }
  }
});
