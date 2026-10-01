/**
 * Finage OS v3 - Institutional User Management & Role-Based Task Separation (RBAC)
 * Enforces Segregation of Duties (SoD), transaction limits, and user administration
 */

const UserManagementView = {
  activeTab: 'directory', // 'directory' | 'matrix' | 'adduser'

  renderModal(container, state) {
    const currentUser = store.getCurrentUser();

    container.innerHTML = `
      <div class="modal-backdrop" id="user-mgmt-modal">
        <div class="modal-container" style="max-width: 860px;">
          <!-- Modal Header -->
          <div class="modal-header">
            <div>
              <div class="modal-title">
                User Access
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">
                Active: <strong>${currentUser.name}</strong> (${currentUser.role} • ${currentUser.singleApprovalLimit > 0 ? Formatter.money(currentUser.singleApprovalLimit) : 'No cap'})
              </span>
            </div>
            <button class="modal-close" id="btn-close-user-modal" title="Close modal" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 0.3rem 0.6rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
              ✕ Close
            </button>
          </div>

          <!-- Navigation Tabs -->
          <div style="display: flex; align-items: center; border-bottom: 1px solid var(--border-subtle); padding: 0 1.5rem; background: #f8fafc; overflow-x: auto; gap: 0.5rem;">
            <button class="input-tab-btn ${this.activeTab === 'directory' ? 'active' : ''}" data-tab="directory">
              1. Operators (${state.users.length})
            </button>
            <button class="input-tab-btn ${this.activeTab === 'matrix' ? 'active' : ''}" data-tab="matrix">
              2. Permissions
            </button>
            <button class="input-tab-btn ${this.activeTab === 'adduser' ? 'active' : ''}" data-tab="adduser">
              3. + Add User
            </button>
            <button class="input-tab-btn ${this.activeTab === 'danger' ? 'active' : ''}" data-tab="danger" style="color: var(--accent-rose);">
              4. Reset
            </button>
          </div>

          <!-- Tab Content Body -->
          <div class="modal-body" id="user-mgmt-tab-body">
            ${this.renderActiveTab(state)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  renderActiveTab(state) {
    if (this.activeTab === 'users') return this.renderDirectoryTab(state);
    if (this.activeTab === 'matrix') return this.renderMatrixTab(state);
    if (this.activeTab === 'add') return this.renderAddUserTab(state);
    if (this.activeTab === 'edit') return this.renderEditRolesTab(state);
    
    switch (this.activeTab) {
      case 'matrix':
        return this.renderMatrixTab(state);
      case 'adduser':
        return this.renderAddUserTab(state);
      case 'danger':
        return this.renderDangerTab(state);
      case 'directory':
      default:
        return this.renderDirectoryTab(state);
    }
  },

  // --- TAB 4: Edit User Roles ---
  renderEditRolesTab(state) {
    if (!this.editingUserId) return `<p>No operator selected for editing.</p>`;
    const user = state.users.find(u => u.id === this.editingUserId);
    if (!user) return `<p>Operator not found.</p>`;
    
    return `
      <form id="form-edit-roles" style="display: flex; flex-direction: column; gap: 1rem;">
        <h4>Edit Roles for ${user.name} (${user.id})</h4>
        <div class="form-group" style="margin: 0;">
          <label class="form-label">Assigned Institutional Roles (Multi-select)</label>
          <select id="inp-edit-role" class="form-control" multiple size="8">
            ${state.roles.map(r => `
              <option value="${r.id}" ${(user.roles || []).includes(r.id) ? 'selected' : ''}>
                ${r.name}
              </option>
            `).join('')}
          </select>
          <small style="color: var(--text-dim); display: block; margin-top: 4px;">Hold Ctrl/Cmd to select multiple roles.</small>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-cancel-edit">Cancel</button>
          <button type="submit" class="btn btn-primary">
            Update Roles
          </button>
        </div>
      </form>
    `;
  },

  // --- TAB 4: Go-Live & Reset Wizard ---
  renderDangerTab(state) {
    const userCount = state.users ? state.users.length : 0;
    const memberCount = state.members ? state.members.length : 0;
    const txCount = state.recentTransactions ? state.recentTransactions.length : 0;
    const syncAvail = !!window.supabase;
    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">

        <!-- Status Banner -->
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem;
          background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-md);">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent-emerald); flex-shrink: 0; box-shadow: 0 0 0 3px rgba(16,185,129,0.2);"></div>
          <div>
            <div style="font-size: 0.78rem; font-weight: 800; color: var(--accent-emerald); text-transform: uppercase; letter-spacing: 0.05em;">Real Operations Mode</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
              ${userCount} staff &middot; ${memberCount} members &middot; ${txCount} transactions &middot; Supabase
              ${syncAvail ? '<strong style="color:var(--accent-emerald);">Connected</strong>' : '<strong style="color:var(--accent-amber);">Offline</strong>'}
            </div>
          </div>
        </div>

        <!-- STEP 1: Clear local browser -->
        <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 0.75rem 1rem; background: var(--bg-surface-elevated); border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 800; background: var(--accent-amber-subtle); color: var(--accent-amber); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--accent-amber);">STEP 1</span>
            <span style="font-size: 0.825rem; font-weight: 700;">Clear Local Browser Cache</span>
          </div>
          <div style="padding: 1rem;">
            <p style="font-size: 0.8rem; color: var(--text-dim); margin: 0 0 0.75rem;">Wipes this browser's localStorage demo state only. Supabase data is unaffected. App reloads and pulls fresh data from the cloud.</p>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <button type="button" id="btn-clear-local-cache" class="btn btn-outline" style="font-size: 0.78rem; border-color: var(--accent-amber); color: var(--accent-amber);">Clear Cache &amp; Reload</button>
              <span style="font-size: 0.72rem; color: var(--text-muted);">Safe &middot; Reversible on next sync</span>
            </div>
          </div>
        </div>

        <!-- STEP 2: Supabase operational clean slate -->
        <div style="border: 1px solid rgba(239,68,68,0.35); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 0.75rem 1rem; background: rgba(239,68,68,0.04); border-bottom: 1px solid rgba(239,68,68,0.2); display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 800; background: rgba(239,68,68,0.1); color: var(--accent-rose); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--accent-rose);">STEP 2</span>
            <span style="font-size: 0.825rem; font-weight: 700;">Supabase Operational Clean Slate</span>
            <span class="badge badge-rose" style="font-size: 0.6rem; margin-left: auto;">Irreversible</span>
          </div>
          <div style="padding: 1rem;">
            <p style="font-size: 0.8rem; color: var(--text-dim); margin: 0 0 0.6rem;">Deletes all <strong>demo operational data</strong> from Supabase and zeroes GL balances. Staff users, roles, and branch structure are <strong>preserved</strong>.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.85rem; font-size: 0.72rem;">
              <div style="padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.06); border-radius: 4px; color: var(--accent-rose);">&#x2715; ${memberCount} member records</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.06); border-radius: 4px; color: var(--accent-rose);">&#x2715; ${txCount} transactions</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.06); border-radius: 4px; color: var(--accent-rose);">&#x2715; Audit trail</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.06); border-radius: 4px; color: var(--accent-rose);">&#x2715; GL balances &rarr; 0</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(16,185,129,0.06); border-radius: 4px; color: var(--accent-emerald);">&#x2713; ${userCount} staff users</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(16,185,129,0.06); border-radius: 4px; color: var(--accent-emerald);">&#x2713; Roles &amp; permissions</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(16,185,129,0.06); border-radius: 4px; color: var(--accent-emerald);">&#x2713; Branch structure</div>
              <div style="padding: 0.4rem 0.6rem; background: rgba(16,185,129,0.06); border-radius: 4px; color: var(--accent-emerald);">&#x2713; GL Chart of Accounts</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 300px;">
              <label class="form-label" style="font-size: 0.72rem;">Admin Authorization Password</label>
              <input type="password" id="inp-golive-password" class="form-control" placeholder="Enter admin password" style="font-size: 0.8rem;">
              <div id="golive-error" style="display:none; color: var(--accent-rose); font-size: 0.75rem; font-weight: 600;"></div>
              <button type="button" id="btn-execute-golive" class="btn btn-primary" style="background: var(--accent-rose); border-color: var(--accent-rose); font-size: 0.8rem;" ${!syncAvail ? 'disabled' : ''}>
                ${syncAvail ? 'Execute Go-Live Clean Slate' : 'Supabase Offline'}
              </button>
            </div>
          </div>
        </div>

        <!-- STEP 3: Full factory reset -->
        <details style="border: 1px solid rgba(127,29,29,0.4); border-radius: var(--radius-md); overflow: hidden;">
          <summary style="padding: 0.75rem 1rem; background: rgba(127,29,29,0.05); cursor: pointer; font-size: 0.78rem; font-weight: 700; color: #b91c1c; list-style: none;">&#9658; Full Factory Reset &mdash; wipes everything including staff &amp; roles (last resort)</summary>
          <div style="padding: 1rem; border-top: 1px solid rgba(127,29,29,0.2);">
            <p style="font-size: 0.78rem; color: var(--text-dim); margin: 0 0 0.75rem;">Destroys ALL data including staff, roles, and branches. You must re-run the full schema and seed scripts afterwards.</p>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <input type="password" id="inp-purge-password" class="form-control" placeholder="Purge password" style="max-width: 200px; font-size: 0.78rem;">
              <button type="button" id="btn-execute-purge" class="btn btn-primary" style="background: #7f1d1d; border-color: #7f1d1d; font-size: 0.78rem;">Factory Reset</button>
            </div>
          </div>
        </details>

      </div>
    `;
  },


  // --- TAB 1: User Directory ---
  renderDirectoryTab(state) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.825rem; font-weight: 700; color: var(--text-main);">
            Authorized System Users & Institutional Approval Ceilings
          </span>
          <span class="badge badge-aqua">MFA Enforced</span>
        </div>

        <div class="table-responsive" style="max-height: 420px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Designation / Role</th>
                <th>Branch Assignment</th>
                <th>Single Approval Limit</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.users.map(u => `
                <tr style="${u.id === state.currentUserId ? 'background: #f0fdfa;' : ''}">
                  <td>
                    <div class="cell-bold">${u.name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${u.email} • ${u.id}</div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      ${(u.roles || []).map(rId => {
                        const r = state.roles.find(rl => rl.id === rId);
                        if (!r) return '';
                        return `<span class="badge ${r.category === 'treasury' ? 'badge-cyan' : (r.category === 'credit' ? 'badge-purple' : (r.category === 'teller' ? 'badge-emerald' : (r.category === 'front-office' ? 'badge-aqua' : 'badge-orange')))}" style="align-self: flex-start;">
                          ${r.name}
                        </span>`;
                      }).join('')}
                    </div>
                  </td>
                  <td style="font-size: 0.775rem;">${u.branchName}</td>
                  <td class="cell-mono" style="color: ${u.singleApprovalLimit > 0 ? 'var(--accent-aqua)' : 'var(--text-dim)'};">
                    ${u.singleApprovalLimit > 0 ? Formatter.money(u.singleApprovalLimit) : 'Maker / Read-Only'}
                  </td>
                  <td>
                    <span class="badge ${u.status === 'Active' ? 'badge-emerald' : 'badge-rose'}">
                      ${u.status}
                    </span>
                  </td>
                  <td class="action-cell">
                    ${u.id === state.currentUserId ? `
                      <span class="badge badge-aqua" style="font-weight: 700; margin-right: 4px;">Active Context</span>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm btn-edit-roles" data-id="${u.id}">Edit Roles</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // --- TAB 2: Task Separation & Permissions Matrix ---
  renderMatrixTab(state) {
    const tasks = [
      { name: 'Member Counter Deposits & Cash Inflow', teller: 'YES', frontOffice: 'NO', mgr: 'NO', creditMaker: 'NO', creditChecker: 'NO', treasury: 'NO', audit: 'VIEW', board: 'VIEW' },
      { name: 'Teller Limit Override & Cash Vault Reconcile', teller: 'NO', frontOffice: 'YES', mgr: 'YES', creditMaker: 'NO', creditChecker: 'NO', treasury: 'VIEW', audit: 'VIEW', board: 'VIEW' },
      { name: 'Loan Origination & KYC Risk Scoring (Maker)', teller: 'NO', mgr: 'YES', creditMaker: 'YES', creditChecker: 'NO', treasury: 'NO', audit: 'VIEW', board: 'VIEW' },
      { name: 'Credit Committee Approval & Pacing Release (Checker)', teller: 'NO', mgr: 'TIER-1', creditMaker: 'NO', creditChecker: 'YES', treasury: 'NO', audit: 'VIEW', board: 'ESCALATION' },
      { name: 'DFI Facility Drawdowns & T-Bill Placements', teller: 'NO', mgr: 'NO', creditMaker: 'NO', creditChecker: 'NO', treasury: 'YES', audit: 'VIEW', board: 'POLICY' },
      { name: 'General Ledger Multi-Ledger Journal Adjustments', teller: 'NO', mgr: 'NO', creditMaker: 'NO', creditChecker: 'NO', treasury: 'YES', audit: 'VIEW', board: 'VIEW' },
      { name: 'Parallel Non-Blocking EOD Execution', teller: 'NO', mgr: 'NO', creditMaker: 'NO', creditChecker: 'NO', treasury: 'YES', audit: 'VIEW', board: 'VIEW' },
      { name: 'System Audit Trail & SASRA Returns Export', teller: 'NO', mgr: 'VIEW', creditMaker: 'NO', creditChecker: 'VIEW', treasury: 'VIEW', audit: 'YES', board: 'YES' },
      { name: 'Macro Stress-Testing Scenario Sliders', teller: 'NO', mgr: 'NO', creditMaker: 'NO', creditChecker: 'NO', treasury: 'VIEW', audit: 'VIEW', board: 'YES' }
    ];

    const getStatusTag = (val) => {
      if (val === 'YES') return `<span class="badge badge-emerald">ALLOWED</span>`;
      if (val === 'NO') return `<span class="badge badge-rose">RESTRICTED</span>`;
      if (val === 'VIEW') return `<span class="badge badge-muted">READ-ONLY</span>`;
      return `<span class="badge badge-orange">${val}</span>`;
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: var(--accent-aqua-subtle); border: 1px solid rgba(20, 184, 166, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-aqua);">
            Institutional Segregation of Duties (SoD) Policy:
          </span>
          <div style="font-size: 0.775rem; color: var(--text-dim); margin-top: 0.25rem;">
            Dual-control is strictly enforced across credit approvals and accounting journals. An operator who initiates a transaction as Maker cannot approve it as Checker.
          </div>
        </div>

        <div class="table-responsive" style="max-height: 380px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Operational Task / Function</th>
                <th>Teller</th>
                <th>FOSA</th>
                <th>Credit Maker</th>
                <th>Credit Checker</th>
                <th>Treasury</th>
                <th>Audit</th>
                <th>Board</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(t => `
                <tr>
                  <td class="cell-bold" style="font-size: 0.775rem;">${t.name}</td>
                  <td>${getStatusTag(t.teller)}</td>
                  <td>${getStatusTag(t.frontOffice ?? t.mgr)}</td>
                  <td>${getStatusTag(t.creditMaker)}</td>
                  <td>${getStatusTag(t.creditChecker)}</td>
                  <td>${getStatusTag(t.treasury)}</td>
                  <td>${getStatusTag(t.audit)}</td>
                  <td>${getStatusTag(t.board)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // --- TAB 3: Add New Operator Form ---
  renderAddUserTab(state) {
    return `
      <form id="form-add-user" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Operator Full Name</label>
            <input type="text" id="inp-u-name" class="form-control" placeholder="e.g. Mercy Chebet" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Official Corporate Email</label>
            <input type="email" id="inp-u-email" class="form-control" placeholder="e.g. mercy.chebet@finage.co.ke" required>
          </div>
        </div>

        <!-- Password row (used to create Supabase Auth account) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Initial Login Password ${window.supabase ? '<span class="badge badge-emerald" style="font-size:0.6rem;">Supabase Auth</span>' : '<span class="badge badge-amber" style="font-size:0.6rem;">Offline — not stored</span>'}</label>
            <input type="password" id="inp-u-password" class="form-control" placeholder="Min 8 characters" autocomplete="new-password" ${window.supabase ? 'required' : ''}>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Confirm Password</label>
            <input type="password" id="inp-u-password-confirm" class="form-control" placeholder="Re-enter password" autocomplete="new-password">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Assigned Institutional Roles (Multi-select)</label>
            <select id="inp-u-role" class="form-control" multiple size="4">
              ${state.roles.filter(r => r.category !== 'member').map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
            <small style="color: var(--text-dim); display: block; margin-top: 4px;">Hold Ctrl/Cmd to select multiple roles.</small>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Branch Station</label>
            <select id="inp-u-branch" class="form-control">
              ${state.branches.map(b => `<option value="${b.id}|${b.name}">${b.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Single Transaction Approval Ceiling (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-u-limit" class="form-control" value="25000" min="0" step="5000">
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Daily Aggregate Approval Limit (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-u-daily" class="form-control" value="100000" min="0" step="10000">
          </div>
        </div>

        <!-- Feedback slot -->
        <div id="adduser-error" style="display:none; color: var(--accent-rose); font-size: 0.78rem; font-weight: 600; padding: 0.5rem 0.75rem; background: rgba(220,38,38,0.06); border-radius: 6px; border: 1px solid rgba(220,38,38,0.25);"></div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-close-user-modal">Cancel</button>
          <button type="submit" id="btn-create-user" class="btn btn-primary">
            Create System User Account
          </button>
        </div>
      </form>
    `;
  },

  bindEvents(container, state) {
    const modal = container.querySelector('#user-mgmt-modal');
    if (!modal) return;

    const closeBtns = container.querySelectorAll('.modal-close, .btn-close-user-modal');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    });

    const tabBtns = container.querySelectorAll('.input-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabBody = container.querySelector('#user-mgmt-tab-body');
        if (tabBody) {
          tabBody.innerHTML = this.renderActiveTab(state);
          this.bindTabSpecificEvents(container, state);
        }
      });
    });

    this.bindTabSpecificEvents(container, state);
  },

  bindTabSpecificEvents(container, state) {
    const modal = container.querySelector('#user-mgmt-modal');


    // Add user form submit
    const addUserForm = container.querySelector('#form-add-user');
    if (addUserForm) {
      addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#inp-u-name')?.value.trim();
        const email = container.querySelector('#inp-u-email')?.value.trim();
        const password = container.querySelector('#inp-u-password')?.value || '';
        const passwordConfirm = container.querySelector('#inp-u-password-confirm')?.value || '';
        const roleSelect = container.querySelector('#inp-u-role');
        const roles = Array.from(roleSelect.selectedOptions).map(opt => opt.value);
        const branchParts = container.querySelector('#inp-u-branch')?.value.split('|');
        const singleLimit = Number(container.querySelector('#inp-u-limit')?.value) || 0;
        const dailyLimit = Number(container.querySelector('#inp-u-daily')?.value) || 0;
        const errEl = container.querySelector('#adduser-error');
        const submitBtn = container.querySelector('#btn-create-user');

        const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
        const clearErr = () => { if (errEl) errEl.style.display = 'none'; };
        clearErr();

        // Validate passwords when Supabase is live
        if (window.supabase) {
          if (password.length < 8) { showErr('Password must be at least 8 characters.'); return; }
          if (password !== passwordConfirm) { showErr('Passwords do not match.'); return; }
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating…'; }

        // Step 1: Create Supabase Auth account (if live)
        if (window.supabase && password) {
          const authResult = await UserManagementEngine.createAuthUser(email, password);
          if (!authResult.success) {
            showErr('Auth account creation failed: ' + authResult.error);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create System User Account'; }
            return;
          }
        }

        // Step 2: Add to the system user directory
        const newId = store.addUser({
          name,
          email,
          roles: roles,
          branchId: branchParts[0],
          branchName: branchParts[1],
          singleApprovalLimit: singleLimit,
          dailyApprovalLimit: dailyLimit
        });
        
        App.showToast(`Operator ${name} created (${newId}) with ${roles.length} role(s).${window.supabase ? ' Auth account sent confirmation email.' : ''}`, 'success');
        modal.classList.remove('active');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create System User Account'; }
      });
    }

    // STEP 1: Clear local browser cache only
    const btnClearCache = container.querySelector('#btn-clear-local-cache');
    if (btnClearCache) {
      btnClearCache.addEventListener('click', () => {
        if (confirm('Clear this browser\'s localStorage and reload from Supabase? Your Supabase data is not affected.')) {
          localStorage.removeItem(store.storageKey);
          App.showToast('Local cache cleared. Reloading…', 'info');
          setTimeout(() => window.location.reload(), 800);
        }
      });
    }

    // STEP 2: Go-Live clean slate (keeps staff/roles/branches, wipes operational data)
    const btnGoLive = container.querySelector('#btn-execute-golive');
    if (btnGoLive) {
      btnGoLive.addEventListener('click', async () => {
        const pass = container.querySelector('#inp-golive-password')?.value;
        const errEl = container.querySelector('#golive-error');
        if (!pass) { if (errEl) { errEl.textContent = 'Password required.'; errEl.style.display = 'block'; } return; }
        if (errEl) errEl.style.display = 'none';

        // Verify against Supabase Auth
        const currentUser = store.getCurrentUser();
        if (!currentUser) { if (errEl) { errEl.textContent = 'No active session.'; errEl.style.display = 'block'; } return; }

        if (!confirm('This will permanently delete all demo members, transactions, and audit trail from Supabase, and zero all GL balances.\n\nStaff users, roles, and branches are preserved.\n\nThis cannot be undone. Proceed?')) return;

        btnGoLive.disabled = true;
        btnGoLive.textContent = 'Executing…';

        try {
          // Verify password via Supabase auth
          if (window.supabase) {
            const { error } = await window.supabase.auth.signInWithPassword({
              email: currentUser.email, password: pass
            });
            if (error) {
              if (errEl) { errEl.textContent = 'Incorrect password: ' + error.message; errEl.style.display = 'block'; }
              btnGoLive.disabled = false; btnGoLive.textContent = 'Execute Go-Live Clean Slate';
              return;
            }
          }

          // Delete operational tables only — preserve users, roles, branches, general_ledger structure
          await window.supabase.from('audit_trail').delete().neq('id', 'AUD-GOLIVE-' + new Date().toISOString().slice(0,10).replace(/-/g,''));
          await window.supabase.from('transactions').delete().neq('id', '__keepall__');
          await window.supabase.from('members').delete().neq('id', '__keepall__');

          // Zero GL balances
          const { data: glRows } = await window.supabase.from('general_ledger').select('code');
          if (glRows) {
            for (const row of glRows) {
              await window.supabase.from('general_ledger').update({ balance: 0 }).eq('code', row.code);
            }
          }

          // Insert go-live audit marker
          await window.supabase.from('audit_trail').insert([{
            id: 'AUD-GOLIVE-' + Date.now(),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action: 'SYSTEM_GO_LIVE',
            module: 'System Administration',
            entityId: 'INST-001',
            description: 'Go-live clean slate executed. All demo data purged. Real operations commenced.',
            ipAddress: '127.0.0.1',
            glImpact: 'All GL balances zeroed — opening balances to be posted by Treasury'
          }]);

          // Clear local state
          localStorage.removeItem(store.storageKey);

          App.showToast('Go-live complete. All demo data cleared. Reloading…', 'success');
          setTimeout(() => window.location.reload(), 1800);
        } catch (err) {
          console.error(err);
          App.showToast('Go-live failed: ' + err.message, 'danger');
          btnGoLive.disabled = false;
          btnGoLive.textContent = 'Execute Go-Live Clean Slate';
        }
      });
    }

    // STEP 3: Full factory reset (wipes everything)
    const btnPurge = container.querySelector('#btn-execute-purge');
    if (btnPurge) {
      btnPurge.addEventListener('click', async () => {
        const pass = container.querySelector('#inp-purge-password')?.value;
        if (pass !== 'admin123') {
          App.showToast('Invalid authorization password.', 'danger');
          return;
        }
        if (confirm('CRITICAL: This deletes ALL data including staff users, roles, and branches. You must re-run the schema scripts afterwards. Proceed?')) {
          btnPurge.textContent = 'Purging…';
          btnPurge.disabled = true;
          try {
            await store.purgeSupabase();
            App.showToast('Full factory reset complete. Reloading…', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
            console.error(err);
            App.showToast('Factory reset failed: ' + err.message, 'danger');
            btnPurge.textContent = 'Factory Reset';
            btnPurge.disabled = false;
          }
        }
      });
    }

    // Edit roles buttons
    const editBtns = container.querySelectorAll('.btn-edit-roles');
    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.editingUserId = btn.dataset.id;
        this.activeTab = 'edit';
        
        container.querySelectorAll('.input-tab-btn').forEach(b => b.classList.remove('active'));
        
        const tabBody = container.querySelector('#user-mgmt-tab-body');
        if (tabBody) {
          tabBody.innerHTML = this.renderActiveTab(state);
          this.bindTabSpecificEvents(container, state);
        }
      });
    });

    // Edit user form submit
    const editForm = container.querySelector('#form-edit-roles');
    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const roleSelect = container.querySelector('#inp-edit-role');
        const roles = Array.from(roleSelect.selectedOptions).map(opt => opt.value);
        
        if (this.editingUserId) {
          store.updateUserRoles(this.editingUserId, roles);
          App.showToast(`Roles updated successfully.`, 'success');
          
          this.activeTab = 'users';
          const tabs = container.querySelectorAll('.input-tab-btn');
          if(tabs[0]) tabs[0].classList.add('active'); 
          
          const tabBody = container.querySelector('#user-mgmt-tab-body');
          if (tabBody) {
            tabBody.innerHTML = this.renderActiveTab(store.state);
            this.bindTabSpecificEvents(container, store.state);
          }
        }
      });
      
      const cancelBtn = container.querySelector('.btn-cancel-edit');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.activeTab = 'users';
          const tabs = container.querySelectorAll('.input-tab-btn');
          if(tabs[0]) tabs[0].classList.add('active');
          const tabBody = container.querySelector('#user-mgmt-tab-body');
          if (tabBody) {
            tabBody.innerHTML = this.renderActiveTab(store.state);
            this.bindTabSpecificEvents(container, store.state);
          }
        });
      }
    }
  },

  open() {
    const modal = document.getElementById('user-mgmt-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }
};

window.UserManagementView = UserManagementView;
