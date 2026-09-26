/**
 * Finage OS v3 - Client & Database User Search & Selection Modal
 * =====================================================================
 * Enables tellers to search all database records:
 *   1. Institutional Members (Depositors, Borrowers, Account Holders)
 *   2. System Users & Authorized Operators (Staff Accounts, Managers, Admins)
 *
 * Capabilities:
 *   - Real-time search across Name, Member ID, User ID, National ID, Phone, Email, Roles
 *   - Category filter pills: [ All Database Records ] | [ Members ] | [ System Users ]
 *   - Automatic staff customer account mapping for teller counter transactions
 *   - Always reads fresh live state from store (avoids stale closures)
 *   - Zero icons (clean typography & high-contrast institutional badges)
 * =====================================================================
 */

const ClientSelectionModalView = {
  activeFilter: 'all', // 'all' | 'members' | 'users'
  currentQuery: '',

  getState() {
    return (window.store && store.state) ? store.state : { members: [], users: [], roles: [] };
  },

  renderModal(container, state) {
    container.innerHTML = `
      <div class="modal-backdrop" id="client-selection-modal">
        <div class="modal-container" style="max-width: 680px; padding: 0;">
          <!-- Header & Search Area -->
          <div style="padding: 1.5rem 1.5rem 1rem 1.5rem; border-bottom: 1px solid var(--border-subtle); background: var(--bg-surface-elevated);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div>
                <div style="font-weight: 800; font-size: 1.15rem; color: var(--text-main); letter-spacing: -0.01em;">
                  Find Client &amp; Database User
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                  Search institutional members, account holders, and system operators in local &amp; cloud database
                </div>
              </div>
              <button class="modal-close" id="btn-close-client-modal" title="Close modal" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 0.35rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
                ✕ Close
              </button>
            </div>
            
            <!-- Search Input Box -->
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <input type="text" id="inp-client-search" class="form-control" placeholder="Search by Name, Member ID (MEM-...), User ID (USR-...), National ID, Phone, or Email..." style="font-size: 0.95rem; padding: 0.75rem 1rem; border: 1px solid var(--border-medium); font-weight: 500;" autocomplete="off" autofocus>
            </div>

            <!-- Category Filter Pills -->
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button class="client-filter-pill active" data-filter="all" id="pill-filter-all" style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--border-medium); background: var(--accent-green-dark); color: #ffffff; cursor: pointer;">
                All Records
              </button>
              <button class="client-filter-pill" data-filter="members" id="pill-filter-members" style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--border-medium); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
                Members Only
              </button>
              <button class="client-filter-pill" data-filter="users" id="pill-filter-users" style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--border-medium); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
                System Users &amp; Staff
              </button>
            </div>
          </div>

          <!-- Search Results List -->
          <div id="client-search-results" style="max-height: 420px; min-height: 220px; overflow-y: auto; background: var(--bg-surface); padding: 0.75rem;">
            <!-- Rendered dynamically -->
          </div>
          
          <!-- Modal Footer Info -->
          <div style="padding: 0.9rem 1.5rem; border-top: 1px solid var(--border-subtle); background: var(--bg-surface-elevated); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted);" id="client-search-count">
              Loading records…
            </span>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="badge badge-muted" style="font-size: 0.68rem;">Supabase &amp; Local DB</span>
              <button id="btn-force-refresh-clients" style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); background: transparent; color: var(--text-muted); cursor: pointer;">
                Refresh Cloud
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  getAllEntities(state) {
    const s = state || this.getState();
    const members = (s.members || []).map(m => ({
      entityType: 'member',
      id: m.id,
      name: m.name || 'Unnamed Member',
      nationalId: m.nationalId || '',
      phone: m.phone || '',
      email: m.email || '',
      branchName: m.branchName || 'Head Office',
      typeBadge: 'MEMBER',
      typeBadgeClass: 'badge-emerald',
      secondaryLine: `Account: ${m.id} • National ID: ${m.nationalId || '—'} • ${m.branchName || 'Head Office'}`,
      metricLine: `Savings: ${typeof Formatter !== 'undefined' ? Formatter.money(m.savingsBalance || 0) : m.savingsBalance} • Shares: ${typeof Formatter !== 'undefined' ? Formatter.money(m.shareCapital || 0) : m.shareCapital}`,
      subBadge: m.riskSegment || 'Standard Risk',
      raw: m
    }));

    const users = (s.users || []).map(u => {
      const roles = (u.roles || []).map(rId => {
        const r = (s.roles || []).find(rl => rl.id === rId);
        return r ? r.name : rId.replace('ROLE-', '');
      }).join(', ');

      const matchedMember = (s.members || []).find(m => 
        (m.email && u.email && m.email.toLowerCase() === u.email.toLowerCase()) || m.id === u.id
      );

      return {
        entityType: 'user',
        id: u.id,
        matchedMemberId: matchedMember ? matchedMember.id : null,
        name: u.name || 'Unnamed User',
        nationalId: u.id,
        phone: u.phone || '',
        email: u.email || '',
        branchName: u.branchName || 'Head Office',
        typeBadge: 'SYSTEM USER',
        typeBadgeClass: 'badge-purple',
        secondaryLine: `Operator ID: ${u.id} • ${roles || 'Staff Operator'} • ${u.branchName || 'Head Office'}`,
        metricLine: `Approval Cap: ${u.singleApprovalLimit > 0 ? (typeof Formatter !== 'undefined' ? Formatter.money(u.singleApprovalLimit) : u.singleApprovalLimit) : 'Maker / Operator'} • ${u.email}`,
        subBadge: u.status || 'Active',
        raw: u,
        matchedMember
      };
    });

    return { members, users, all: [...members, ...users] };
  },

  renderResults(query = '', filter = null) {
    const modal = document.getElementById('client-selection-modal');
    if (!modal) return;

    const resultsContainer = modal.querySelector('#client-search-results');
    const countLabel = modal.querySelector('#client-search-count');
    if (!resultsContainer) return;

    if (filter !== null) this.activeFilter = filter;
    this.currentQuery = query;

    const state = this.getState();
    const { members, users, all } = this.getAllEntities(state);

    // Update filter counts on pills
    const pillAll = modal.querySelector('#pill-filter-all');
    const pillMem = modal.querySelector('#pill-filter-members');
    const pillUsr = modal.querySelector('#pill-filter-users');
    if (pillAll) pillAll.textContent = `All Records (${all.length})`;
    if (pillMem) pillMem.textContent = `Members Only (${members.length})`;
    if (pillUsr) pillUsr.textContent = `System Users & Staff (${users.length})`;

    // Filter by category
    let pool = all;
    if (this.activeFilter === 'members') pool = members;
    if (this.activeFilter === 'users') pool = users;

    const q = query.toLowerCase().trim();

    // Filter by query string
    const filtered = pool.filter(item => {
      if (!q) return true;
      return (item.name || '').toLowerCase().includes(q) ||
             (item.id || '').toLowerCase().includes(q) ||
             (item.nationalId || '').toLowerCase().includes(q) ||
             (item.phone || '').toLowerCase().includes(q) ||
             (item.email || '').toLowerCase().includes(q) ||
             (item.branchName || '').toLowerCase().includes(q) ||
             (item.secondaryLine || '').toLowerCase().includes(q);
    });

    if (countLabel) {
      countLabel.textContent = `Showing ${filtered.length} of ${all.length} total database records`;
    }

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
          <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.35rem;">
            No Database Records Found
          </div>
          <div style="font-size: 0.85rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">
            No member or system operator matching <strong style="color: var(--text-main);">"${query}"</strong> was found in the database.
          </div>
          <div style="margin-top: 1.25rem;">
            <button id="btn-search-cloud-now" class="btn btn-secondary btn-sm" style="font-size: 0.78rem;">
              Force Pull &amp; Reload Cloud DB
            </button>
          </div>
        </div>
      `;

      const cloudBtn = resultsContainer.querySelector('#btn-search-cloud-now');
      if (cloudBtn && window.SupabaseSync) {
        cloudBtn.addEventListener('click', async () => {
          cloudBtn.textContent = 'Pulling from Supabase…';
          await window.SupabaseSync.pullAll(store.state);
          this.renderResults(this.currentQuery);
        });
      }
      return;
    }

    resultsContainer.innerHTML = filtered.map(item => {
      const initials = (item.name || 'MB').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const isUser = item.entityType === 'user';

      const avatarBg = isUser ? 'rgba(79, 70, 229, 0.1)' : 'rgba(5, 150, 105, 0.1)';
      const avatarBorder = isUser ? 'rgba(79, 70, 229, 0.25)' : 'rgba(5, 150, 105, 0.25)';
      const avatarColor = isUser ? '#4f46e5' : '#059669';

      return `
        <div class="client-result-item" data-type="${item.entityType}" data-id="${item.id}" style="display: flex; align-items: center; gap: 1rem; padding: 0.85rem 1rem; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease; margin-bottom: 0.35rem; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated);">
          <!-- Monogram Avatar (No Icons) -->
          <div style="width: 40px; height: 40px; border-radius: var(--radius-sm); background: ${avatarBg}; border: 1px solid ${avatarBorder}; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-weight: 800; color: ${avatarColor}; font-size: 0.85rem; letter-spacing: 0.05em; flex-shrink: 0;">
            ${initials}
          </div>

          <!-- Entity Details -->
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
              <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
                ${item.name}
              </span>
              <span class="badge ${item.typeBadgeClass}" style="font-size: 0.65rem; padding: 2px 6px; letter-spacing: 0.04em;">
                ${item.typeBadge}
              </span>
            </div>
            
            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${item.secondaryLine}
            </div>

            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.15rem; font-family: var(--font-mono);">
              ${item.metricLine}
            </div>
          </div>

          <!-- Status / Action -->
          <div style="text-align: right; flex-shrink: 0;">
            <span class="badge badge-muted" style="font-size: 0.68rem; margin-bottom: 0.25rem; display: block;">
              ${item.subBadge}
            </span>
            <span style="font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700; color: var(--accent-emerald);">
              Select →
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events on result rows
    const rows = resultsContainer.querySelectorAll('.client-result-item');
    rows.forEach(row => {
      row.addEventListener('mouseenter', () => {
        row.style.background = 'var(--bg-hover)';
        row.style.borderColor = 'var(--border-medium)';
        row.style.transform = 'translateY(-1px)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'var(--bg-surface-elevated)';
        row.style.borderColor = 'var(--border-subtle)';
        row.style.transform = 'translateY(0)';
      });
      row.addEventListener('click', () => {
        const type = row.dataset.type;
        const id = row.dataset.id;
        this.selectEntity(type, id);
      });
    });
  },

  selectEntity(type, id) {
    const state = this.getState();

    if (type === 'member') {
      const member = (state.members || []).find(m => m.id === id);
      if (member) {
        store.setSelectedMember(member.id);
        this.close();
        if (typeof App !== 'undefined') {
          App.render(store.state);
          App.showToast(`Selected member: ${member.name} (${member.id})`, 'success');
        }
      }
    } else if (type === 'user') {
      const user = (state.users || []).find(u => u.id === id);
      if (!user) return;

      // Check if user is already mapped to a member account
      let member = (state.members || []).find(m => 
        (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) || 
        m.id === user.id || 
        m.id === `MEM-${user.id}`
      );

      // If user does not yet have a member customer profile, create one automatically
      if (!member) {
        member = {
          id: `MEM-${user.id}`,
          name: `${user.name} (Staff Account)`,
          nationalId: `STF-${user.id}`,
          phone: user.phone || '+254 700 000000',
          email: user.email || `${user.id.toLowerCase()}@finage.local`,
          joinDate: new Date().toISOString().slice(0, 10),
          branchId: user.branchId || 'br-01',
          branchName: user.branchName || 'Head Office',
          kycStatus: 'Verified (Institutional Staff)',
          occupation: 'Financial Institution Staff Member',
          employer: 'Finage Apex Microfinance Bank',
          riskSegment: 'Low Risk - Institutional Staff',
          relationshipScore: 92,
          savingsBalance: 25000,
          fixedDepositBalance: 0,
          shareCapital: 10000,
          activeLoans: [],
          guarantorCommitments: []
        };
        state.members.push(member);
        store.saveQuiet('members');
      }

      store.setSelectedMember(member.id);
      this.close();
      if (typeof App !== 'undefined') {
        App.render(store.state);
        App.showToast(`Selected system user: ${user.name} (${user.id})`, 'success');
      }
    }
  },

  bindEvents(container) {
    const modal = container.querySelector('#client-selection-modal');
    if (!modal) return;

    // Close button
    const closeBtn = container.querySelector('#btn-close-client-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Search input
    const searchInput = container.querySelector('#inp-client-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderResults(e.target.value);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstItem = modal.querySelector('.client-result-item');
          if (firstItem) {
            this.selectEntity(firstItem.dataset.type, firstItem.dataset.id);
          }
        }
        if (e.key === 'Escape') {
          this.close();
        }
      });
    }

    // Category filter pills
    const pills = container.querySelectorAll('.client-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => {
          p.classList.remove('active');
          p.style.background = 'var(--bg-surface)';
          p.style.color = 'var(--text-muted)';
        });
        const target = e.currentTarget;
        target.classList.add('active');
        target.style.background = 'var(--accent-green-dark)';
        target.style.color = '#ffffff';

        const filter = target.dataset.filter;
        this.renderResults(searchInput ? searchInput.value : '', filter);
      });
    });

    // Cloud Refresh button
    const refreshBtn = container.querySelector('#btn-force-refresh-clients');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.textContent = 'Syncing…';
        if (window.SupabaseSync) {
          await window.SupabaseSync.pullAll(store.state);
        }
        refreshBtn.textContent = 'Refresh Cloud';
        this.renderResults(searchInput ? searchInput.value : '');
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('Database records refreshed from Supabase.', 'success');
        }
      });
    }

    // Initial render
    this.renderResults('');
  },

  open() {
    const modal = document.getElementById('client-selection-modal');
    if (modal) {
      modal.classList.add('active');
      const searchInput = modal.querySelector('#inp-client-search');
      if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 50);
      }
      this.activeFilter = 'all';
      
      // Update pill active styling
      const pills = modal.querySelectorAll('.client-filter-pill');
      pills.forEach(p => {
        if (p.dataset.filter === 'all') {
          p.classList.add('active');
          p.style.background = 'var(--accent-green-dark)';
          p.style.color = '#ffffff';
        } else {
          p.classList.remove('active');
          p.style.background = 'var(--bg-surface)';
          p.style.color = 'var(--text-muted)';
        }
      });

      this.renderResults('');
    }
  },

  close() {
    const modal = document.getElementById('client-selection-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
};

window.ClientSelectionModalView = ClientSelectionModalView;
