/**
 * Finage OS v3 - Client & Database User Search & Selection Modal
 * =====================================================================
 * Enables tellers to search institutional member accounts only.
 *
 * Capabilities:
 *   - Real-time search across member name, ID, national ID, phone, and email
 *   - Always reads fresh live state from store (avoids stale closures)
 *   - Zero icons (clean typography & high-contrast institutional badges)
 * =====================================================================
 */

const ClientSelectionModalView = {
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
                  Find Member Account
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                  Search institutional members and account holders
                </div>
              </div>
              <button class="modal-close" id="btn-close-client-modal" title="Close modal" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 0.35rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
                ✕ Close
              </button>
            </div>
            
            <!-- Search Input Box -->
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <input type="text" id="inp-client-search" class="form-control" placeholder="Search by member name, member ID, national ID, phone, or email..." style="font-size: 0.95rem; padding: 0.75rem 1rem; border: 1px solid var(--border-medium); font-weight: 500;" autocomplete="off" autofocus>
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
            <span class="badge badge-muted" style="font-size: 0.68rem;">Saved on this device</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  getAllEntities(state) {
    const s = state || this.getState();
    const members = (s.members || []).filter(m => !RIMEngine.isStaffProfile(m)).map(m => ({
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

    return { members, all: members };
  },

  renderResults(query = '') {
    const modal = document.getElementById('client-selection-modal');
    if (!modal) return;

    const resultsContainer = modal.querySelector('#client-search-results');
    const countLabel = modal.querySelector('#client-search-count');
    if (!resultsContainer) return;

    this.currentQuery = query;

    const state = this.getState();
    const { all } = this.getAllEntities(state);

    const q = query.toLowerCase().trim();

    const filtered = all.filter(item => {
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
      countLabel.textContent = `Showing ${filtered.length} of ${all.length} locally saved records`;
    }

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding: 3rem 1.5rem; text-align: center; color: var(--text-muted);">
          <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.35rem;">
            No Locally Saved Records Found
          </div>
          <div style="font-size: 0.85rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">
            No member account matching <strong style="color: var(--text-main);">"${query}"</strong> was found in locally saved records.
          </div>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = filtered.map(item => {
      const initials = (item.name || 'MB').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const avatarBg = 'rgba(5, 150, 105, 0.1)';
      const avatarBorder = 'rgba(5, 150, 105, 0.25)';
      const avatarColor = '#059669';

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
      const member = (state.members || []).find(m => m.id === id && !RIMEngine.isStaffProfile(m));
      if (member) {
        store.setSelectedMember(member.id);
        this.close();
        if (typeof App !== 'undefined') {
          App.render(store.state);
          App.showToast(`Selected member: ${member.name} (${member.id})`, 'success');
        }
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
