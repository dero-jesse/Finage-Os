/**
 * Finage OS v3 - Layer 9: Teller Desk (FOSA Counter Desk)
 * Secure teller counter posting with strict physical cash denomination validation.
 */

const CURRENCIES = {
  USD: { symbol: '$',   denoms: [100, 50, 20, 10, 5, 1] },
  KES: { symbol: 'KES', denoms: [1000, 500, 200, 100, 50] },
  UGX: { symbol: 'UGX', denoms: [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] },
  TZS: { symbol: 'TZS', denoms: [10000, 5000, 2000, 1000, 500] },
  RWF: { symbol: 'FRW', denoms: [5000, 2000, 1000, 500, 100] }
};

const TX_TYPES = [
  { type: 'Deposit',          label: 'Deposit',       icon: '↓', color: 'btn-emerald', debitGL: '1010', creditGL: '2010' },
  { type: 'Withdrawal',       label: 'Withdrawal',    icon: '↑', color: 'btn-rose',    debitGL: '2010', creditGL: '1010' },
  { type: 'Loan Payment',     label: 'Loan Repayment',icon: '↩', color: 'btn-cyan',    debitGL: '1010', creditGL: '1200' },
  { type: 'Loan Disbursement',label: 'Loan Disburse', icon: '→', color: 'btn-amber',   debitGL: '1200', creditGL: '1010' },
];

const TellerDeskView = {
  render(container, state) {
    const currentUser = store.getCurrentUser();
    const userRoles = typeof UserManagementEngine !== 'undefined' ? UserManagementEngine.getUserRoles(state, currentUser?.id) : [];
    const canReadAll = userRoles.some(r => r.permissions.includes('READ_ALL_MODULES')) || (currentUser?.roles && currentUser.roles.includes('ROLE-ADMIN'));
    const isTellerRole = userRoles.some(r => r.id === 'ROLE-TELLER' || r.category === 'teller' || r.permissions.includes('POST_COUNTER_TX'));

    const currentBranch = state.branches.find(b => b.id === (currentUser?.branchId || state.selectedBranchId)) || state.branches[0];
    const assignedTill = store.getCurrentTellerTill ? store.getCurrentTellerTill(state) : null;

    if (!isTellerRole && !canReadAll) {
      container.innerHTML = `
        <div class="workspace-module">
          <div class="workspace-toolbar">
            <div class="workspace-breadcrumb" data-label="Teller">Overview</div>
            <div class="workspace-actions">
              <span class="solid-note">Restricted</span>
            </div>
          </div>

          <div class="metric-strip">
            <div class="metric-pill">
              <span class="metric-label">Branch</span>
              <span class="metric-value">${currentBranch ? currentBranch.name : 'Unassigned'}</span>
            </div>
            <div class="metric-pill">
              <span class="metric-label">Status</span>
              <span class="metric-value">Access denied</span>
            </div>
          </div>

          <div class="workspace-card" style="max-width: 760px; margin: 0 auto;">
            <div class="workspace-card-header">
              <div class="workspace-card-title">Assigned tellers only</div>
            </div>
            <div class="workspace-card-body" style="text-align: center; padding: 1.5rem 1rem;">
              <div style="width: 52px; height: 52px; margin: 0 auto 1.25rem; border-radius: 50%; background: var(--accent-rose-subtle); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--accent-rose); font-weight: 800; border: 1px solid var(--accent-rose);">
                !
              </div>
              <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">Access Restricted: Assigned Tellers Only</h2>
              <p style="font-size: 0.85rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 1.5rem;">
                The Counter Teller Desk is restricted exclusively to authorized branch cash tellers with active till custody.
                Current operator <strong>${currentUser ? currentUser.name : 'Unknown'}</strong> is not assigned as a counter teller at ${currentBranch ? currentBranch.name : 'this branch'}.
              </p>
              <div style="display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.25rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--text-muted);">
                <span>Separation of Duties (SoD) Enforced · Front-office supervision is conducted under the <strong>FOSA</strong> tab.</span>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const memberId = state.selectedMemberId;
    let profile = null;
    if (memberId) {
      profile = RIMEngine.getMemberProfile(state, memberId);
    }

    container.innerHTML = `
      <div class="workspace-module">
        <div class="workspace-toolbar">
          <div class="workspace-breadcrumb" data-label="Teller">Overview</div>
          <div class="workspace-actions">
            ${profile ? `
            <div class="form-group" style="margin: 0; min-width: 220px; padding: 0.45rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface-elevated);">
              <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-main);">${profile.name}</span>
              <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); margin-left: 0.4rem;">(${profile.id})</span>
            </div>
            <button id="btn-clear-client" class="btn btn-outline btn-sm" title="Clear Client & Start New Session">Reset</button>
            ` : ''}
            <button id="btn-quick-transact" class="btn btn-emerald btn-sm">
              ${profile ? 'Switch Client' : 'Select Client'}
            </button>
          </div>
        </div>

        <div class="metric-strip">
          <div class="metric-pill">
            <span class="metric-label">Drawer</span>
            <span class="metric-value">${assignedTill ? assignedTill.tellerId : 'Assigned till'}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Float</span>
            <span class="metric-value">${assignedTill ? Formatter.money(assignedTill.balance) : '—'}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Branch</span>
            <span class="metric-value">${currentBranch ? currentBranch.name : 'Branch'}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Operator</span>
            <span class="metric-value">${currentUser ? currentUser.name : 'Teller'}</span>
          </div>
        </div>

        ${!profile ? `
        <!-- No Member Selected: show today's teller session summary -->
        <div class="panel-grid">
          <div class="glass-panel col-12">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <span class="panel-title">Today's Activity</span>
              </div>
              <span class="badge badge-indigo">Live Audit Stream</span>
            </div>

            <!-- Prompt to select a client -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; gap: 0.75rem; text-align: center;">
              <span class="badge badge-muted" style="font-size: 0.75rem; letter-spacing: 0.05em; font-weight: 700; padding: 4px 10px;">COUNTER READY</span>
              <div>
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">No client selected</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Choose a client to open the cash desk.</div>
              </div>
            </div>

            <!-- Today's postings table -->
            <div class="table-responsive" style="margin-top: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Client</th>
                    <th>GL Impact</th>
                  </tr>
                </thead>
                <tbody>
                  ${(state.auditTrail || [])
                    .filter(t => t.userId === store.getCurrentUser()?.id && t.action.includes('POST_'))
                    .slice(0, 10)
                    .map(t => `
                      <tr>
                        <td style="font-size: 0.8rem; color: var(--text-dim);">${new Date(t.timestamp).toLocaleTimeString()}</td>
                        <td class="cell-mono">${t.entityId}</td>
                        <td>${t.action.replace('POST_', '').replace(/_/g, ' ')}</td>
                        <td style="font-size:0.85rem;">${t.description.split(' of ')[0]}</td>
                        <td class="cell-mono" style="font-size:0.8rem; color: var(--text-dim);">${t.glImpact}</td>
                      </tr>
                    `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No transactions posted in this session.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : `
        <!-- ===== MEMBER LOADED: Full Teller Workspace ===== -->

        <!-- Member 360 Profile Strip -->
        <div class="glass-panel" style="width: 100%; margin-bottom: 1.5rem; background: rgba(0,0,0,0.25);">
          <div class="panel-header" style="margin-bottom: 1rem;">
            <div class="panel-title-wrap">
              <span class="panel-title">Member Profile &amp; KYC Auth</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span class="badge badge-indigo">${profile.tier}</span>
              <span class="badge ${profile.kycStatus.includes('Verified') ? 'badge-emerald' : 'badge-amber'}">${profile.kycStatus}</span>
            </div>
          </div>

          <div style="display: flex; gap: 1.5rem; align-items: stretch;">
            <!-- Avatar Monogram -->
            <div style="flex: 0 0 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-surface-elevated); padding: 1.25rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="width: 72px; height: 72px; background: var(--primary-subtle); border: 2px solid var(--primary-light); border-radius: 50%; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-weight: 800; font-size: 1.35rem; color: var(--primary-dark); letter-spacing: 0.05em;">
                ${profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span style="font-weight: 700; text-align: center; font-size: 0.85rem; line-height: 1.2; color: var(--text-main);">${profile.name}</span>
            </div>

            <!-- Details Grid -->
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.75rem;">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">Member ID</div>
                  <div class="cell-mono" style="font-size: 0.9rem; font-weight: 700;">${profile.id}</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">National ID</div>
                  <div class="cell-mono masked-data" data-value="${profile.nationalId}" style="cursor: pointer; user-select: none;" title="Click to reveal">${profile.nationalId.slice(0,3)}****${profile.nationalId.slice(-2)}</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">Phone</div>
                  <div class="cell-mono masked-data" data-value="${profile.phone}" style="cursor: pointer; user-select: none;" title="Click to reveal">${profile.phone.slice(0,4)} *** ***${profile.phone.slice(-3)}</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">Branch</div>
                  <div style="font-weight: 600; font-size: 0.85rem;">${profile.branchName}</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">Risk Segment</div>
                  <div style="font-weight: 600; font-size: 0.8rem; color: ${profile.riskSegment.includes('High') ? 'var(--accent-rose)' : profile.riskSegment.includes('Low') ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${profile.riskSegment}</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.25rem;">Relationship Score</div>
                  <div style="font-weight: 800; font-size: 1rem; color: var(--accent-cyan);">${profile.relationshipScore} <span style="font-size:0.7rem; color: var(--text-dim);">/ 100</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Split Workspace -->
        <div style="display: grid; grid-template-columns: 1fr 1.6fr; gap: 1.5rem;">

          <!-- LEFT: Account Balances & Liabilities -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="stat-card cyan" style="margin:0;">
              <div class="stat-card-header">
                <span class="stat-title">Savings</span>
                <span class="badge badge-cyan" style="font-size: 0.65rem;">DEMAND</span>
              </div>
              <div class="stat-value" id="teller-savings-balance">${Formatter.money(profile.savingsBalance)}</div>
              <div class="stat-footer">
                <span>Interest: 4.5% p.a.</span>
                <span class="cell-mono" style="font-size: 0.75rem; color: var(--accent-emerald);">Available Float</span>
              </div>
            </div>

            <div class="stat-card emerald" style="margin:0;">
              <div class="stat-card-header">
                <span class="stat-title">Fixed Deposits</span>
                <span class="badge badge-emerald" style="font-size: 0.65rem;">TERM</span>
              </div>
              <div class="stat-value">${Formatter.money(profile.fixedDepositBalance)}</div>
              <div class="stat-footer">
                <span>Rate: 10.5% p.a.</span>
                <span class="cell-mono" style="font-size: 0.75rem;">Certificate</span>
              </div>
            </div>

            <div class="stat-card purple" style="margin:0;">
              <div class="stat-card-header">
                <span class="stat-title">Shares</span>
                <span class="badge badge-purple" style="font-size: 0.65rem;">EQUITY</span>
              </div>
              <div class="stat-value">${Formatter.money(profile.shareCapital)}</div>
              <div class="stat-footer">
                <span>Dividend: 12.0%</span>
                <span class="cell-mono" style="font-size: 0.75rem;">Shares</span>
              </div>
            </div>

            <div class="stat-card ${profile.totalLiabilities > 0 ? 'amber' : 'emerald'}" style="margin:0;">
              <div class="stat-card-header">
                <span class="stat-title">Loan Exposure</span>
                <span class="badge ${profile.totalLiabilities > 0 ? 'badge-amber' : 'badge-emerald'}" style="font-size: 0.65rem;">
                  ${profile.activeLoans.length > 0 ? profile.activeLoans[0].npaClassification : 'Debt-Free'}
                </span>
              </div>
              <div class="stat-value" id="teller-liabilities-balance">${Formatter.money(profile.totalLiabilities)}</div>
              <div class="stat-footer">
                <span>${profile.activeLoans.length} Credit ${profile.activeLoans.length === 1 ? 'Facility' : 'Facilities'}</span>
                <span class="cell-mono" style="font-size: 0.75rem;">Exposure</span>
              </div>
            </div>

            <!-- Active Loans Quick List -->
            ${profile.activeLoans.length > 0 ? `
            <div class="glass-panel" style="margin:0; padding: 1rem;">
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Active Credit Facilities</div>
              ${profile.activeLoans.map(l => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.82rem;">
                  <div>
                    <div style="font-weight: 600; color: #fff;">${l.product}</div>
                    <div style="color: var(--text-dim); font-family: var(--font-mono); font-size: 0.75rem;">${l.loanId} · ${l.daysInArrears}d arrears</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="color: var(--accent-rose); font-weight: 700; font-family: var(--font-mono);">${Formatter.money(l.outstandingBalance)}</div>
                    <div class="badge ${l.npaClassification.includes('Normal') ? 'badge-emerald' : l.npaClassification.includes('Watch') ? 'badge-amber' : 'badge-rose'}" style="font-size: 0.65rem;">${l.npaClassification.split(' ')[0]}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>

          <!-- RIGHT: Transaction Initiation & Denomination Desk -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">

            <!-- Initiate Cash Transaction Buttons -->
            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 0.75rem;">New Transaction</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;" id="tx-type-btn-group">
                ${TX_TYPES.map(t => `
                  <button
                    class="btn btn-outline btn-init-tx"
                    data-type="${t.type}"
                    data-color="${t.color}"
                    style="display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1rem; font-size: 0.82rem; font-weight: 600; border-radius: var(--radius-md); transition: all 0.15s ease;">
                    <span style="font-size: 1rem; line-height: 1;">${t.icon}</span>
                    ${t.label}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Transaction Workspace (shown after clicking a type button) -->
            <div class="glass-panel" id="transaction-workspace" style="display: none; padding: 1.25rem;">
              <div class="panel-header" style="margin-bottom: 1rem;">
                <div class="panel-title-wrap">
                  <span class="panel-title" id="tx-workspace-title">Cash Desk</span>
                </div>
                <span class="badge badge-rose">Match cash count</span>
              <div style="display: flex; flex-direction: column; gap: 1rem;">

                <!-- Transaction Form -->
                <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group" style="margin: 0;">
                      <label class="form-label">Currency</label>
                      <select id="teller-currency" class="form-control"></select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                      <label class="form-label">Transaction Type</label>
                      <select id="teller-tx-type" class="form-control">
                        ${TX_TYPES.map(t => `<option value="${t.type}">${t.label}</option>`).join('')}
                      </select>
                    </div>
                  </div>

                  <div class="form-group" id="loan-select-group" style="display: none; margin-bottom: 1rem;">
                    <label class="form-label">Select Loan Facility</label>
                    <select id="teller-loan-select" class="form-control">
                      ${profile.activeLoans.length > 0
                        ? profile.activeLoans.map((l, idx) => `<option value="${idx}">${l.product} — ${l.loanId} (Bal: ${Formatter.money(l.outstandingBalance)})</option>`).join('')
                        : '<option value="">No Active Loans</option>'}
                    </select>
                  </div>

                  <div class="form-group" style="margin: 0;">
                    <label class="form-label" for="teller-tx-amount">Target Amount (calculated from cash count)</label>
                    <input type="number" id="teller-tx-amount" class="form-control" placeholder="0" value="0" min="0" step="1" readonly aria-describedby="teller-amount-help" style="font-size: 1.1rem; font-family: var(--font-mono); font-weight: 700;">
                    <small id="teller-amount-help" style="color:var(--text-muted);">Enter the number of notes/coins below. The transaction amount updates automatically.</small>
                  </div>
                </div>

                <!-- Denomination Counter -->
                <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem;">Cash Count</div>
                  <div class="denomination-grid" id="denomination-grid-container" style="grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                    <!-- Populated by JS -->
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-subtle);">
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Physical Total:</span>
                    <span id="calculated-tx-total" style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: 800; color: var(--accent-cyan);">0.00</span>
                  </div>
                </div>

                <!-- Post Button + Validation Message -->
                <div>
                  <button id="btn-post-secure-tx" class="btn btn-emerald btn-lg" style="width: 100%; opacity: 0.5; cursor: not-allowed;" disabled>
                    Post Transaction
                  </button>
                  <div id="tx-validation-msg" style="font-size: 0.78rem; color: var(--accent-rose); display: block; margin-top: 0.5rem; text-align: center; padding: 0.4rem 0;">
                    Cash total must match the target amount.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `}

      <div id="teller-confirm-modal" style="display: none; position: fixed; inset: 0; background: rgba(2, 6, 23, 0.62); z-index: 1000; align-items: center; justify-content: center; padding: 1rem;">
        <div style="width: min(560px, 92vw); background: linear-gradient(180deg, #ffffff, #f8fafc); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 18px; box-shadow: 0 28px 44px rgba(15, 23, 42, 0.18); overflow: hidden;">
          <div style="padding: 1.1rem 1.2rem; border-bottom: 1px solid rgba(148, 163, 184, 0.18); background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.98));">
            <div style="font-size: 0.72rem; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.1em;">Transaction Confirmation</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #f8fafc; margin-top: 0.2rem;">Confirm posting</div>
          </div>

          <div style="padding: 1.2rem; display: flex; flex-direction: column; gap: 0.9rem;">
            <div style="padding: 0.9rem 1rem; border-radius: 12px; background: rgba(15, 23, 42, 0.04); border: 1px solid rgba(148, 163, 184, 0.14);">
              <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem;">Member</div>
              <div id="confirm-member-name" style="font-weight: 800; color: var(--text-main); font-size: 1rem;">—</div>
            </div>

            <div id="teller-confirm-summary" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <!-- injected by JS -->
            </div>

            <div style="display: flex; align-items: center; gap: 0.55rem; padding: 0.8rem 0.9rem; border-radius: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.18); color: var(--accent-rose); font-size: 0.8rem; font-weight: 700;">
              ⚠ Posting occurs immediately after confirmation.
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.7rem; margin-top: 0.2rem;">
              <button id="btn-cancel-tx-post" class="btn btn-secondary" type="button">Cancel</button>
              <button id="btn-confirm-tx-post" class="btn btn-emerald" type="button">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindGlobalEvents(container, state);
    if (profile) {
      this.bindProfileEvents(container, state, profile);
    }
  },

  bindGlobalEvents(container, state) {
    const transactBtn = container.querySelector('#btn-quick-transact');
    if (transactBtn) {
      transactBtn.addEventListener('click', () => {
        if (window.ClientSelectionModalView) ClientSelectionModalView.open();
      });
    }

    const clearBtn = container.querySelector('#btn-clear-client');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        store.setSelectedMember(null);
      });
    }
  },

  bindProfileEvents(container, state, profile) {
    // --- Masked data toggle ---
    container.querySelectorAll('.masked-data').forEach(el => {
      const original = el.innerText;
      const full = el.dataset.value;
      el.addEventListener('click', () => {
        el.innerText = el.innerText === original ? full : original;
      });
    });

    // --- DOM references (ALL declared before any callbacks that use them) ---
    const txAmountInput      = container.querySelector('#teller-tx-amount');
    const calculatedTotalEl  = container.querySelector('#calculated-tx-total');
    const postBtn            = container.querySelector('#btn-post-secure-tx');
    const validationMsg      = container.querySelector('#tx-validation-msg');
    const currencySelect     = container.querySelector('#teller-currency');
    const txTypeSelect       = container.querySelector('#teller-tx-type');
    const loanSelectGroup    = container.querySelector('#loan-select-group');
    const denomGridContainer = container.querySelector('#denomination-grid-container');
    const txWorkspace        = container.querySelector('#transaction-workspace');
    const txWorkspaceTitle   = container.querySelector('#tx-workspace-title');
    const initTxBtns         = container.querySelectorAll('.btn-init-tx');
    const confirmModal       = container.querySelector('#teller-confirm-modal');
    const confirmSummary     = container.querySelector('#teller-confirm-summary');
    const confirmMemberName  = container.querySelector('#confirm-member-name');
    const confirmCancel      = container.querySelector('#btn-cancel-tx-post');
    const confirmPost        = container.querySelector('#btn-confirm-tx-post');

    // Populate currency select from CURRENCIES map
    Object.entries(CURRENCIES).forEach(([code, cfg]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} — ${cfg.symbol}`;
      currencySelect.appendChild(opt);
    });
    currencySelect.value = state.institution.baseCurrency || 'UGX';

    // --- Denomination renderer ---
    const renderDenominations = () => {
      const currency = CURRENCIES[currencySelect.value] || CURRENCIES.UGX;
      denomGridContainer.innerHTML = currency.denoms.map(d => `
        <div class="denom-box">
          <span class="denom-val">${currency.symbol} ${d.toLocaleString()}</span>
          <input type="number" data-denom="${d}" class="form-control tx-denom" value="0" min="0" step="1" inputmode="numeric" aria-label="Count of ${currency.code || currencySelect.value} ${d} notes or coins">
        </div>
      `).join('');
      container.querySelectorAll('.tx-denom').forEach(inp => inp.addEventListener('input', syncTargetAmountFromCashCount));
      syncTargetAmountFromCashCount();
    };

    const getCashCount = () => {
      let total = 0;
      let valid = true;
      container.querySelectorAll('.tx-denom').forEach(inp => {
        const rawCount = inp.value.trim();
        const count = rawCount === '' ? 0 : Number(rawCount);
        if (!Number.isSafeInteger(count) || count < 0) {
          valid = false;
          return;
        }
        total += Number(inp.dataset.denom) * count;
      });
      return { total, valid: valid && Number.isSafeInteger(total) };
    };

    const syncTargetAmountFromCashCount = () => {
      const cashCount = getCashCount();
      txAmountInput.value = cashCount.valid ? String(cashCount.total) : '';
      validateTransaction();
    };

    // --- Validation logic ---
    const getTransactionIssue = () => {
      const txType      = txTypeSelect ? txTypeSelect.value : 'Deposit';
      const targetAmt   = Number(txAmountInput.value) || 0;
      const activeLoans = Array.isArray(profile.activeLoans) ? profile.activeLoans : [];
      const loanIdx     = parseInt(container.querySelector('#teller-loan-select')?.value);
      const selectedLoan = !isNaN(loanIdx) ? activeLoans[loanIdx] : activeLoans[0];

      const cashCount = getCashCount();
      if (!cashCount.valid) return 'Denomination counts must be whole, non-negative numbers.';
      if (targetAmt <= 0) return 'Enter a target amount greater than zero.';

      // Denomination physical count must match exactly
      if (targetAmt !== cashCount.total) return 'The transaction amount must match the denomination total.';

      if (txType === 'Withdrawal') {
        if (profile.savingsBalance < targetAmt)
          return `Insufficient funds: only ${Formatter.money(profile.savingsBalance)} available.`;
        if (assignedTill && assignedTill.balance < targetAmt)
          return `Till Cash Shortfall: Drawer ${assignedTill.tellerId} only holds ${Formatter.money(assignedTill.balance)} float. Request replenishment from FOSA Supervisor.`;
      }

      if (currentUser?.singleApprovalLimit > 0 && targetAmt > currentUser.singleApprovalLimit && !canReadAll) {
        return `Amount exceeds teller limit of ${Formatter.money(currentUser.singleApprovalLimit)}. Supervisor authorization required.`;
      }

      if (txType === 'Loan Payment') {
        if (activeLoans.length === 0) return 'No active loan facilities for this member.';
        if (!selectedLoan)           return 'Select a valid active loan facility.';
        if (selectedLoan.outstandingBalance < targetAmt)
          return `Repayment of ${Formatter.money(targetAmt)} exceeds outstanding balance of ${Formatter.money(selectedLoan.outstandingBalance)}.`;
      }

      if (txType === 'Loan Disbursement' && activeLoans.length === 0)
        return 'No active loan accounts to disburse against.';

      return null; // all clear
    };

    const validateTransaction = () => {
      const currency = CURRENCIES[currencySelect.value] || CURRENCIES.UGX;
      const cashCount = getCashCount();
      const calcTotal = cashCount.total;

      const targetAmt = Number(txAmountInput.value) || 0;
      const issue = getTransactionIssue();

      calculatedTotalEl.textContent = currency.symbol + ' ' + calcTotal.toLocaleString();

      if (!issue) {
        postBtn.disabled = false;
        postBtn.style.opacity = '1';
        postBtn.style.cursor = 'pointer';
        calculatedTotalEl.style.color = 'var(--accent-emerald)';
        validationMsg.textContent = '✓ Denominations match. Ready to post.';
        validationMsg.style.color = 'var(--accent-emerald)';
      } else {
        postBtn.disabled = true;
        postBtn.style.opacity = '0.5';
        postBtn.style.cursor = 'not-allowed';
        calculatedTotalEl.style.color = (targetAmt > 0 && calcTotal > targetAmt) ? 'var(--accent-rose)' : 'var(--accent-cyan)';
        validationMsg.textContent = issue;
        validationMsg.style.color = 'var(--accent-rose)';
      }
    };

    // --- Sync transaction type across buttons and select ---
    const ALL_BTN_COLORS = ['btn-emerald', 'btn-rose', 'btn-cyan', 'btn-amber', 'btn-indigo', 'btn-orange', 'btn-primary'];

    const syncTransactionType = (nextType) => {
      const def = TX_TYPES.find(t => t.type === nextType) || TX_TYPES[0];

      txTypeSelect.value = def.type;
      if (txWorkspaceTitle) txWorkspaceTitle.textContent = `${def.label} — Denomination Desk`;

      // Toggle loan select visibility
      const isLoan = def.type === 'Loan Payment' || def.type === 'Loan Disbursement';
      if (loanSelectGroup) loanSelectGroup.style.display = isLoan ? 'block' : 'none';

      // Highlight the active button — strip ALL color classes first, then apply correct one
      initTxBtns.forEach(b => {
        const isActive = b.dataset.type === def.type;
        // Remove every possible color class cleanly
        ALL_BTN_COLORS.forEach(cls => b.classList.remove(cls));
        if (isActive) {
          const activeColor = b.dataset.color || 'btn-emerald';
          b.classList.remove('btn-outline');
          b.classList.add(activeColor);
          b.style.fontWeight = '700';
        } else {
          b.classList.add('btn-outline');
          b.style.fontWeight = '600';
        }
      });

      // Reset inputs
      txAmountInput.value = '0';
      container.querySelectorAll('.tx-denom').forEach(inp => inp.value = '0');
      validateTransaction();
    };

    // --- Wire up init buttons ---
    initTxBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (!type) return;
        txWorkspace.style.display = 'block';
        txWorkspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        syncTransactionType(type);
      });
    });

    // --- Wire up the type select (in case user changes manually) ---
    txTypeSelect.addEventListener('change', e => {
      txWorkspace.style.display = 'block';
      syncTransactionType(e.target.value);
    });

    // --- Wire up currency change ---
    currencySelect.addEventListener('change', renderDenominations);

    // --- Initial denomination render ---
    renderDenominations();

    // --- Confirmation modal helpers ---
    const getSummaryRows = () => {
      const txType = txTypeSelect.value;
      const amount = Number(txAmountInput.value) || 0;
      const def = TX_TYPES.find(t => t.type === txType) || TX_TYPES[0];
      const currency = CURRENCIES[currencySelect.value] || CURRENCIES.UGX;
      let calcTotal = 0;
      container.querySelectorAll('.tx-denom').forEach(inp => {
        calcTotal += Number(inp.dataset.denom) * (parseInt(inp.value) || 0);
      });

      const loanIdx = parseInt(container.querySelector('#teller-loan-select')?.value);
      const selectedLoan = (!isNaN(loanIdx) && profile.activeLoans[loanIdx]) ? profile.activeLoans[loanIdx] : null;

      const rows = [
        { label: 'Transaction', value: def.label },
        { label: 'Amount', value: `${currency.symbol} ${Formatter.money(amount)}` },
        { label: 'Account Name', value: profile.name },
        { label: 'Account Number', value: profile.accountNumber || profile.id || 'N/A' }
      ];

      return rows;
    };

    const openPostConfirmation = () => {
      const rows = getSummaryRows();
      confirmMemberName.textContent = profile.name;
      confirmSummary.innerHTML = rows.map(r => `
        <div style="padding: 0.7rem 0.8rem; border: 1px solid rgba(148,163,184,0.18); border-radius: 10px; background: rgba(15,23,42,0.02);">
          <div style="font-size: 0.68rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.25rem;">${r.label}</div>
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); word-break: break-word;">${r.value}</div>
        </div>
      `).join('');
      if (confirmModal) confirmModal.style.display = 'flex';
    };

    const closePostConfirmation = () => {
      if (confirmModal) confirmModal.style.display = 'none';
    };

    // --- POST BUTTON ---
    postBtn.addEventListener('click', () => {
      const txType = txTypeSelect.value;
      const amount = Number(txAmountInput.value);
      const issue  = getTransactionIssue();

      if (amount <= 0 || issue) {
        App.showToast(issue || 'Transaction validation failed.', 'danger');
        return;
      }

      openPostConfirmation();
    });

    if (confirmCancel) {
      confirmCancel.addEventListener('click', closePostConfirmation);
    }

    if (confirmPost) {
      confirmPost.addEventListener('click', () => {
        const txType = txTypeSelect.value;
        const amount = Number(txAmountInput.value);
        const issue  = getTransactionIssue();

        if (amount <= 0 || issue) {
          closePostConfirmation();
          App.showToast(issue || 'Transaction validation failed.', 'danger');
          return;
        }

        const def = TX_TYPES.find(t => t.type === txType) || TX_TYPES[0];
        const loanIdx = parseInt(container.querySelector('#teller-loan-select')?.value);
        const loanId  = (!isNaN(loanIdx) && profile.activeLoans[loanIdx]) ? profile.activeLoans[loanIdx].loanId : null;

        const result = CoreBankingEngine.executeTransaction(state, {
          type: `Teller ${txType}`,
          memberId: profile.id,
          loanId,
          amount,
          channel: 'Branch FOSA Counter',
          debitGL: def.debitGL,
          creditGL: def.creditGL,
          description: `FOSA Teller ${txType} via Denomination Desk`
        });

        closePostConfirmation();

        if (!result) {
          App.showToast('Transaction rejected by core banking engine. Check permissions or balance.', 'danger');
          return;
        }

        const savingsEl = container.querySelector('#teller-savings-balance');
        if (savingsEl) {
          const updatedMember = store.state.members.find(m => m.id === profile.id);
          if (updatedMember) savingsEl.textContent = Formatter.money(updatedMember.savingsBalance);
        }

        const freshTill = store.getCurrentTellerTill ? store.getCurrentTellerTill(store.state) : null;
        const headerFloat = container.querySelector('#teller-header-float-badge');
        if (headerFloat && freshTill) {
          headerFloat.textContent = `FLOAT: ${Formatter.money(freshTill.balance)}`;
        }

        App.showToast(`✓ ${def.label} of ${Formatter.money(amount)} posted — GL Dr ${def.debitGL} / Cr ${def.creditGL}.`, 'success');

        txAmountInput.value = '0';
        container.querySelectorAll('.tx-denom').forEach(inp => inp.value = '0');
        validateTransaction();
      });
    }
  }
};

window.TellerDeskView = TellerDeskView;
window.MemberPortalView = TellerDeskView;
window.CounterOperationsView = TellerDeskView;
