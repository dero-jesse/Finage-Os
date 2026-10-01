/**
 * Finage OS v3 - Layer 2: Front Office / Branch Manager View
 *
 * Responsibilities:
 *   - Member KYC onboarding & account establishment
 *   - Approval of transactions exceeding teller authority limit
 *   - Till float monitoring (read-only — cash posting is Teller's authority)
 *   - EOD vault reconciliation & cash sheet submission
 *
 * Cash transaction authority: Teller Desk only (TellerDeskView)
 */

const BranchView = {
  render(container, state) {
    const currentBranch = state.branches.find(b => b.id === state.selectedBranchId) || state.branches[0];
    const totalTillCash = currentBranch.tillBalances.reduce((sum, t) => sum + t.balance, 0);
    const totalBranchCash = currentBranch.cashInVault + totalTillCash;
    const vaultUtilization = (currentBranch.cashInVault / currentBranch.vaultLimit) * 100;

    // Approval queue: workflow tasks needing branch manager sign-off
    const pendingApprovals = (state.workflowTasks || []).filter(t =>
      t.approverRole === 'Branch/Teller' ||
      t.type === 'High-Value Withdrawal Override' ||
      t.makerCheckerStatus.toLowerCase().includes('pending manager') ||
      t.makerCheckerStatus.toLowerCase().includes('pending approval')
    );

    // tellerCashLimit is set by the Branch Manager per-branch
    const tellerCashLimit = currentBranch.tellerCashLimit || 30000;

    const denomConfigs = [
      { id: 'denom-50k', label: '50,000 Notes', value: 50000 },
      { id: 'denom-20k', label: '20,000 Notes', value: 20000 },
      { id: 'denom-10k', label: '10,000 Notes', value: 10000 },
      { id: 'denom-5k',  label: '5,000 Notes',  value: 5000 },
      { id: 'denom-2k',  label: '2,000 Notes',  value: 2000 },
      { id: 'denom-1k',  label: '1,000 Notes',  value: 1000 },
      { id: 'denom-500', label: '500 Coins',    value: 500 },
      { id: 'denom-200', label: '200 Coins',    value: 200 },
      { id: 'denom-100', label: '100 Coins',    value: 100 },
      { id: 'denom-50',  label: '50 Coins',     value: 50 }
    ];

    let rem = currentBranch.cashInVault || 0;
    const denomItems = denomConfigs.map(d => {
      const count = Math.floor(rem / d.value);
      rem -= count * d.value;
      return { ...d, count, subTotal: count * d.value };
    });

    const branchActions = `
      <div class="form-group" style="margin: 0; min-width: 220px;">
        <select id="branch-select" class="form-control">
          ${state.branches.map(b => `
            <option value="${b.id}" ${b.id === currentBranch.id ? 'selected' : ''}>
              ${b.name} (${b.code})
            </option>
          `).join('')}
        </select>
      </div>
      <button id="btn-submit-eod-reconciliation" class="btn btn-primary btn-sm">
        Submit Cash Sheet
      </button>
    `;

    container.innerHTML = `
      <div class="workspace-module">
        <div class="workspace-toolbar">
          <div class="workspace-breadcrumb" data-label="FOSA">Overview</div>
          <div class="workspace-actions">${branchActions}</div>
        </div>

        <div class="metric-strip">
          <div class="metric-pill">
            <span class="metric-label">Branch cash</span>
            <span class="metric-value">${Formatter.money(totalBranchCash)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Vault custody</span>
            <span class="metric-value">${Formatter.money(currentBranch.cashInVault)}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Approvals</span>
            <span class="metric-value">${pendingApprovals.length}</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">Reconciler</span>
            <span class="metric-value">${currentBranch.reconciliationDiscrepancy === 0 ? 'Clean' : 'Review'}</span>
          </div>
        </div>

        <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Branch Cash-in-Hand</span>
          </div>
          <div class="stat-value">${Formatter.money(totalBranchCash)}</div>
          <div class="stat-footer">
            <span>Vault + ${currentBranch.tellerCount} Tills</span>
            <span class="badge">GL 1010</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Physical Vault Custody</span>
          </div>
          <div class="stat-value">${Formatter.money(currentBranch.cashInVault)}</div>
          <div class="stat-footer">
            <span>Limit: ${Formatter.money(currentBranch.vaultLimit)}</span>
            <span class="stat-trend">${vaultUtilization.toFixed(0)}% Used</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Pending Approvals</span>
          </div>
          <div class="stat-value">${pendingApprovals.length}</div>
          <div class="stat-footer">
            <span>Above Teller Limit (${Formatter.money(tellerCashLimit)})</span>
            <span class="badge">${pendingApprovals.length > 0 ? 'Action Required' : 'All Clear'}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-title">Recon Discrepancy</span>
          </div>
          <div class="stat-value">
            ${currentBranch.reconciliationDiscrepancy === 0 ? 'Balanced' : Formatter.money(currentBranch.reconciliationDiscrepancy)}
          </div>
          <div class="stat-footer">
            <span>Last: ${Formatter.dateTime(currentBranch.lastReconciledAt)}</span>
            <span class="badge">${currentBranch.reconciliationDiscrepancy === 0 ? 'Clean' : 'Investigate'}</span>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="panel-grid">

        <!-- LEFT: Approval Queue + KYC Wizard -->
        <div class="glass-panel col-7">

          <!-- ===== APPROVAL QUEUE ===== -->
          <div class="panel-header">
            <div class="panel-title-wrap">
              <span class="panel-title">Approval Queue</span>
            </div>
            <span class="badge ${pendingApprovals.length > 0 ? 'badge-rose' : 'badge-emerald'}">
              ${pendingApprovals.length} Pending
            </span>
          </div>

          ${pendingApprovals.length === 0 ? `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim);">
              <div style="font-weight: 700; color: var(--accent-green-dark); margin-bottom: 0.25rem;">[NO PENDING APPROVALS]</div>
              <div style="font-size: 0.82rem;">All teller transactions are within daily authorization limits.</div>
            </div>
          ` : `
            <div class="table-responsive" style="margin-bottom: 1.5rem;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Type</th>
                    <th>Requested By</th>
                    <th>Amount</th>
                    <th>Priority</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingApprovals.map(wf => `
                    <tr>
                      <td class="cell-mono">${wf.id}</td>
                      <td style="font-size: 0.82rem; max-width: 160px;">${wf.type}</td>
                      <td style="font-size: 0.8rem; color: var(--text-dim);">${wf.requestedBy}</td>
                      <td class="cell-mono" style="color: var(--accent-green-dark); font-weight: 700;">${Formatter.money(wf.amount)}</td>
                      <td><span class="badge">${wf.priority}</span></td>
                      <td style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-emerald btn-sm btn-approve-wf" data-id="${wf.id}" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">
                          Approve
                        </button>
                        <button class="btn btn-rose btn-sm btn-reject-wf" data-id="${wf.id}" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">
                          Reject
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="6" style="background: var(--accent-green-light); padding: 0.5rem 1rem;">
                        <div style="font-size: 0.78rem; color: var(--text-dim); display: flex; gap: 2rem; flex-wrap: wrap;">
                          <span><strong style="color: var(--text-muted);">Status:</strong> ${wf.makerCheckerStatus}</span>
                          <span><strong style="color: var(--text-muted);">Liquidity:</strong> ${wf.liquidityImpactCheck}</span>
                          <span><strong style="color: var(--text-muted);">Step:</strong> ${wf.currentStep}</span>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}

          <!-- Authority Notice -->
          <div style="background: var(--accent-green-light); border: 1px solid var(--accent-green); padding: 0.75rem 1rem; margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 0.75rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; flex: 1;">
              <strong style="color: var(--accent-green-dark); text-transform: uppercase;">[NOTICE] Teller-only posting.</strong>
              Counter cash is posted at the teller desk. Transactions above the limit are routed for review.
              <div style="margin-top: 0.6rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-size: 0.78rem;">Limit for <strong>${currentBranch.name}:</strong></span>
                <span style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-green-dark); font-size: 1rem;" id="teller-limit-display">${Formatter.money(tellerCashLimit)}</span>
                <input type="number" id="inp-teller-limit" class="form-control" value="${tellerCashLimit}" min="1000" step="1000"
                  style="width: 130px; padding: 0.3rem 0.5rem; font-size: 0.82rem; font-family: var(--font-mono); font-weight: 700;">
                <button id="btn-set-teller-limit" class="btn btn-primary" style="padding: 0.35rem 0.9rem; font-size: 0.78rem; font-weight: 700;">
                  Set Limit
                </button>
              </div>
            </div>
          </div>

          <!-- Separator -->
          <div style="border-top: 1px solid var(--border-subtle); margin-bottom: 1.5rem;"></div>

          <!-- ===== KYC ONBOARDING WIZARD ===== -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="font-size: 0.9rem; font-weight: 700; color: var(--accent-green-dark); text-transform: uppercase;">Member Onboarding</span>
            <div class="wizard-indicators" style="display: flex; gap: 0.5rem;">
              <span class="badge" id="wiz-step-1">Step 1</span>
              <span class="badge" id="wiz-step-2">Step 2</span>
              <span class="badge" id="wiz-step-3">Step 3</span>
            </div>
          </div>

          <!-- Step 1: Personal Info -->
          <div id="kyc-step-1" class="wizard-step">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label class="form-label">Full Legal Name</label>
                <input type="text" id="new-member-name" class="form-control" placeholder="e.g. John Kamau Doe">
              </div>
              <div>
                <label class="form-label">National ID / Passport No.</label>
                <input type="text" id="new-member-id" class="form-control" placeholder="ID Number">
              </div>
              <div>
                <label class="form-label">Mobile Phone</label>
                <input type="text" id="new-member-phone" class="form-control" placeholder="+254 7XX XXX XXX">
              </div>
              <div>
                <label class="form-label">Next of Kin</label>
                <input type="text" id="new-member-kin" class="form-control" placeholder="Full Name">
              </div>
              <div style="grid-column: span 2;">
                <label class="form-label">Beneficiaries (comma-separated)</label>
                <input type="text" id="new-member-benefactors" class="form-control" placeholder="e.g. Jane Doe (Spouse), Tim Doe (Son)">
              </div>
              <div style="display: flex; gap: 1rem; grid-column: span 2;">
                <button id="btn-scan-biometrics" class="btn btn-outline" style="flex: 1;">
                  Capture Biometrics
                </button>
                <button id="btn-capture-signature" class="btn btn-outline" style="flex: 1;">
                  Digital Signature
                </button>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
              <button id="btn-wiz-next-1" class="btn btn-primary">Account Setup ➔</button>
            </div>
          </div>

          <!-- Step 2: Account Type -->
          <div id="kyc-step-2" class="wizard-step" style="display: none;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Account Type (Standard SACCO Tree)</label>
                <select id="new-account-type" class="form-control">
                  <option value="savings">FOSA Savings / Demand Deposit Account (GL 2010)</option>
                  <option value="fixed">Fixed Term Deposit Account (GL 2020)</option>
                  <option value="shares">Member Share Capital Equity (GL 3010)</option>
                  <option value="loan">Credit Facility / Loan Account (GL 1200)</option>
                </select>
              </div>
              <div id="sub-form-savings" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label class="form-label">Initial Deposit (${Formatter.currencySymbol}) — Posted by Teller</label>
                    <input type="number" id="new-member-deposit" class="form-control" value="0" min="0">
                    <span style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.25rem; display: block;">
                      ⓘ Teller will post the physical cash at counter
                    </span>
                  </div>
                  <div>
                    <label class="form-label">Primary Financial Goal</label>
                    <select id="new-savings-goal" class="form-control">
                      <option value="general">General Savings</option>
                      <option value="emergency">Emergency Fund</option>
                      <option value="asset">Asset Accumulation</option>
                      <option value="retirement">Retirement Planning</option>
                    </select>
                  </div>
                </div>
              </div>
              <div id="sub-form-loan" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label class="form-label">Requested Principal (${Formatter.currencySymbol})</label>
                    <input type="number" id="new-loan-amount" class="form-control" value="5000" min="100">
                  </div>
                  <div>
                    <label class="form-label">Credit Purpose</label>
                    <select id="new-loan-purpose" class="form-control">
                      <option value="business">Business / Working Capital</option>
                      <option value="asset_finance">Asset Finance</option>
                      <option value="emergency">Emergency / Medical</option>
                      <option value="education">Education</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
              <button id="btn-wiz-prev-2" class="btn btn-outline">⬅ Bio-Data</button>
              <button id="btn-wiz-next-2" class="btn btn-primary">Review &amp; Consents ➔</button>
            </div>
          </div>

          <!-- Step 3: Consent -->
          <div id="kyc-step-3" class="wizard-step" style="display: none;">
            <div style="background: var(--bg-surface); padding: 1rem; border-radius: 4px; max-height: 120px; overflow-y: auto; font-size: 0.75rem; color: var(--text-muted); border: 1px solid var(--border-subtle); margin-bottom: 1rem;">
              <p><strong>Finage OS — Standard Account &amp; FOSA Operating Agreement</strong></p>
              <p>By creating this account, the applicant agrees to adhere to statutory requirements under the Cooperative Societies Act. The applicant authorizes Finage OS to collect, retain, and process biometric and biographical data for KYC and AML/CFT compliance. Deposits are insured up to statutory limits.</p>
              <p>Credit Facilities: The applicant acknowledges that the institution reserves the right to levy standard interest, arrears, and exercise set-off against savings ledgers in the event of default.</p>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1.5rem;">
              <input type="checkbox" id="kyc-consent-checkbox" style="width: 18px; height: 18px; margin-top: 2px;">
              <label for="kyc-consent-checkbox" style="font-size: 0.85rem; color: #fff; user-select: none;">
                I, the Branch Officer, confirm that the applicant has physically signed the mandate card, provided biometrics, and explicitly consented to the Terms &amp; Conditions above.
              </label>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <button id="btn-wiz-prev-3" class="btn btn-outline">⬅ Accounts</button>
              <button id="btn-create-member" class="btn btn-emerald" style="opacity: 0.5; cursor: not-allowed;" disabled>
                Authorize &amp; Open Account
              </button>
            </div>
          </div>

        </div>

        <!-- RIGHT: Till Float Monitor + Vault Count Sheet -->
        <div class="col-5" style="display: flex; flex-direction: column; gap: 1.5rem;">

          <!-- Teller Float Monitor (read-only) -->
          <div class="glass-panel">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <span class="panel-title">Teller Float Monitor</span>
              </div>
              <span class="badge badge-muted">Read-Only · Cash Authority: Teller</span>
            </div>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Teller</th>
                    <th>Float Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentBranch.tillBalances.map((t, idx) => `
                    <tr>
                      <td>
                        <div style="font-weight: 600; font-size: 0.85rem;">${t.tellerName}</div>
                        <div class="cell-mono" style="font-size: 0.72rem; color: var(--text-dim);">${t.tellerId}</div>
                      </td>
                      <td class="cell-mono" style="font-weight: 700; color: var(--accent-cyan);">${Formatter.money(t.balance)}</td>
                      <td><span class="badge ${t.status === 'Reconciled' ? 'badge-emerald' : 'badge-amber'}">${t.status}</span></td>
                      <td>
                        <div class="inline-edit-group" id="teller-edit-${idx}" style="display:none; gap:0.5rem;">
                          <input type="number" class="form-control form-control-sm" id="teller-input-${idx}" value="${t.balance}" style="width:90px;">
                          <button class="btn btn-emerald btn-sm btn-save-teller" data-idx="${idx}">Save</button>
                          <button class="btn btn-outline btn-sm btn-cancel-teller" data-idx="${idx}">✕</button>
                        </div>
                        <button class="btn btn-outline btn-sm btn-edit-teller-trigger" data-idx="${idx}" id="teller-trigger-${idx}" style="font-size: 0.72rem;">Update Count</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); font-size: 0.82rem;">
              <span style="color: var(--text-muted);">Total Float Across ${currentBranch.tillBalances.length} Drawers</span>
              <span style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-cyan);">${Formatter.money(totalTillCash)}</span>
            </div>
          </div>

          <!-- Vault Denomination Count Sheet -->
          <div class="glass-panel">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <span class="panel-title">Vault Denomination Sheet</span>
              </div>
              <span class="badge badge-cyan">Physical Count</span>
            </div>

            <div class="vault-reconcile-card">
              <div class="denomination-grid">
                ${denomItems.map(d => `
                  <div class="denom-box">
                    <span class="denom-val">${Formatter.currencySymbol}${d.label}</span>
                    <input type="number" id="${d.id}" class="denom-input" data-value="${d.value}" value="${d.count}" min="0">
                    <span class="bucket-sub text-right" id="${d.id}-sub">${Formatter.money(d.subTotal)}</span>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-top: 1px solid var(--border-subtle); margin-top: 0.5rem;">
                <span style="font-weight: 700; color: #fff;">Calculated Vault Cash:</span>
                <span id="denom-total-val" style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan);">
                  ${Formatter.money(currentBranch.cashInVault)}
                </span>
              </div>

              <button id="btn-save-vault-count" class="btn btn-emerald btn-lg" style="width: 100%; margin-top: 0.5rem;">
                Confirm Vault Physical Count
              </button>
            </div>
          </div>

        </div>
      </div>
      </div>
    `;

    this.bindEvents(container, state, currentBranch, pendingApprovals, denomConfigs);
  },

  bindEvents(container, state, currentBranch, pendingApprovals, denomConfigs = []) {

    // --- Branch selector ---
    container.querySelector('#branch-select')?.addEventListener('change', e => {
      store.setSelectedBranch(e.target.value);
    });

    // --- Vault denomination counter ---
    const updateDenomTotal = () => {
      let total = 0;
      denomConfigs.forEach(d => {
        const inp = container.querySelector('#' + d.id);
        const count = Math.max(0, parseInt(inp?.value, 10) || 0);
        const sub = count * d.value;
        const subEl = container.querySelector('#' + d.id + '-sub');
        if (subEl) subEl.textContent = Formatter.money(sub);
        total += sub;
      });
      const totalEl = container.querySelector('#denom-total-val');
      if (totalEl) totalEl.textContent = Formatter.money(total);
      return total;
    };

    container.querySelectorAll('.denom-input').forEach(inp => inp.addEventListener('input', updateDenomTotal));

    container.querySelector('#btn-save-vault-count')?.addEventListener('click', () => {
      const total = updateDenomTotal();
      currentBranch.cashInVault = total;
      store.submitBranchReconciliation(currentBranch.id, total, null, 'Vault Denomination Verification');
      store.save();
      App.showToast(`Vault count of ${Formatter.money(total)} confirmed for ${currentBranch.name}.`, 'success');
    });

    container.querySelector('#btn-submit-eod-reconciliation')?.addEventListener('click', () => {
      const total = updateDenomTotal();
      currentBranch.cashInVault = total;
      store.submitBranchReconciliation(currentBranch.id, total, null, 'EOD Complete Submission');
      store.save();
      App.showToast(`EOD Cash Position for ${currentBranch.name} transmitted to Central Treasury.`, 'success');
    });

    // --- Approval Queue ---
    container.querySelectorAll('.btn-approve-wf').forEach(btn => {
      btn.addEventListener('click', () => {
        const wfId = btn.dataset.id;
        const wf = state.workflowTasks.find(t => t.id === wfId);
        if (!wf) return;

        wf.makerCheckerStatus = 'Approved — Branch Manager';
        wf.history = wf.history || [];
        wf.history.push({
          step: 'Branch Manager Authorization',
          user: store.getCurrentUser()?.name || 'Branch Manager',
          action: 'Approved',
          timestamp: new Date().toISOString()
        });
        store.saveQuiet();
        App.showToast(`✓ ${wf.type} (${Formatter.money(wf.amount)}) approved. Teller may proceed.`, 'success');

        // Remove row from queue visually
        const row = btn.closest('tr');
        const detailRow = row?.nextElementSibling;
        row?.remove();
        detailRow?.remove();

        // Update badge count
        const badge = container.querySelector('.panel-header .badge');
        if (badge) {
          const remaining = container.querySelectorAll('.btn-approve-wf').length;
          badge.textContent = `${remaining} Pending`;
          badge.className = `badge ${remaining > 0 ? 'badge-rose' : 'badge-emerald'}`;
        }
      });
    });

    container.querySelectorAll('.btn-reject-wf').forEach(btn => {
      btn.addEventListener('click', () => {
        const wfId = btn.dataset.id;
        const wf = state.workflowTasks.find(t => t.id === wfId);
        if (!wf) return;

        wf.makerCheckerStatus = 'Rejected — Branch Manager';
        wf.history = wf.history || [];
        wf.history.push({
          step: 'Branch Manager Authorization',
          user: store.getCurrentUser()?.name || 'Branch Manager',
          action: 'Rejected',
          timestamp: new Date().toISOString()
        });
        store.saveQuiet();
        App.showToast(`✗ ${wf.type} rejected. Teller notified.`, 'warning');

        const row = btn.closest('tr');
        const detailRow = row?.nextElementSibling;
        row?.remove();
        detailRow?.remove();
      });
    });

    // --- Till float count update ---
    container.querySelectorAll('.btn-edit-teller-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        btn.style.display = 'none';
        container.querySelector('#teller-edit-' + idx).style.display = 'flex';
      });
    });

    container.querySelectorAll('.btn-cancel-teller').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        container.querySelector('#teller-edit-' + idx).style.display = 'none';
        container.querySelector('#teller-trigger-' + idx).style.display = 'inline-block';
      });
    });

    container.querySelectorAll('.btn-save-teller').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const newBalance = Number(container.querySelector('#teller-input-' + idx).value);
        if (isNaN(newBalance) || newBalance < 0) {
          App.showToast('Enter a valid non-negative balance.', 'warning');
          return;
        }
        currentBranch.tillBalances[idx].balance = newBalance;
        currentBranch.tillBalances[idx].status = 'Reconciled';
        store.save();
        App.showToast(`Till updated for ${currentBranch.tillBalances[idx].tellerName}.`, 'success');

        const editGroup = container.querySelector('#teller-edit-' + idx);
        const trigger = container.querySelector('#teller-trigger-' + idx);
        if (editGroup) editGroup.style.display = 'none';
        if (trigger) trigger.style.display = 'inline-block';

        const row = trigger?.closest('tr');
        if (row) {
          const cells = row.querySelectorAll('td');
          if (cells[1]) cells[1].textContent = Formatter.money(newBalance);
          if (cells[2]) cells[2].innerHTML = `<span class="badge badge-emerald">Reconciled</span>`;
        }
      });
    });

    // --- KYC Wizard ---
    const step1 = container.querySelector('#kyc-step-1');
    const step2 = container.querySelector('#kyc-step-2');
    const step3 = container.querySelector('#kyc-step-3');
    const ind1 = container.querySelector('#wiz-step-1');
    const ind2 = container.querySelector('#wiz-step-2');
    const ind3 = container.querySelector('#wiz-step-3');
    const accTypeSelect = container.querySelector('#new-account-type');

    container.querySelector('#btn-scan-biometrics')?.addEventListener('click', e => {
      e.currentTarget.innerHTML = '✅ Biometrics Captured';
      e.currentTarget.classList.replace('btn-outline', 'btn-emerald');
      e.currentTarget.style.pointerEvents = 'none';
    });

    container.querySelector('#btn-capture-signature')?.addEventListener('click', e => {
      e.currentTarget.innerHTML = '✅ Signature Verified';
      e.currentTarget.classList.replace('btn-outline', 'btn-emerald');
      e.currentTarget.style.pointerEvents = 'none';
    });

    container.querySelector('#btn-wiz-next-1')?.addEventListener('click', () => {
      const name = container.querySelector('#new-member-name').value.trim();
      const id = container.querySelector('#new-member-id').value.trim();
      if (!name || !id) {
        App.showToast('Full Name and National ID are required.', 'danger');
        return;
      }
      step1.style.display = 'none';
      step2.style.display = 'block';
      ind1.className = 'badge badge-muted';
      ind2.className = 'badge badge-emerald';
    });

    container.querySelector('#btn-wiz-prev-2')?.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      ind2.className = 'badge badge-muted';
      ind1.className = 'badge badge-emerald';
    });

    accTypeSelect?.addEventListener('change', e => {
      container.querySelector('#sub-form-savings').style.display = e.target.value === 'savings' ? 'block' : 'none';
      container.querySelector('#sub-form-loan').style.display = e.target.value === 'loan' ? 'block' : 'none';
    });

    container.querySelector('#btn-wiz-next-2')?.addEventListener('click', () => {
      step2.style.display = 'none';
      step3.style.display = 'block';
      ind2.className = 'badge badge-muted';
      ind3.className = 'badge badge-emerald';
    });

    container.querySelector('#btn-wiz-prev-3')?.addEventListener('click', () => {
      step3.style.display = 'none';
      step2.style.display = 'block';
      ind3.className = 'badge badge-muted';
      ind2.className = 'badge badge-emerald';
    });

    const consentCb = container.querySelector('#kyc-consent-checkbox');
    const finalBtn = container.querySelector('#btn-create-member');

    consentCb?.addEventListener('change', e => {
      finalBtn.disabled = !e.target.checked;
      finalBtn.style.opacity = e.target.checked ? '1' : '0.5';
      finalBtn.style.cursor = e.target.checked ? 'pointer' : 'not-allowed';
    });

    finalBtn?.addEventListener('click', () => {
      const name = container.querySelector('#new-member-name').value.trim();
      const id = container.querySelector('#new-member-id').value.trim();
      const phone = container.querySelector('#new-member-phone').value.trim();
      const kin = container.querySelector('#new-member-kin').value.trim();
      const accType = accTypeSelect.value;
      const deposit = Number(container.querySelector('#new-member-deposit').value) || 0;

      const newMember = {
        id: `MEM-${Math.floor(2000 + Math.random() * 7000)}`,
        name, nationalId: id, phone,
        nextOfKin: kin,
        branchId: currentBranch.id,
        branchName: currentBranch.name,
        kycStatus: 'Verified',
        riskSegment: 'Standard Member',
        relationshipScore: accType === 'savings' ? 80 : 70,
        occupation: 'Not Specified',
        employer: 'Not Specified',
        savingsBalance: 0,
        fixedDepositBalance: 0,
        shareCapital: 0,
        activeLoans: [],
        guarantorCommitments: []
      };

      state.members.push(newMember);

      if ((accType === 'savings' || accType === 'fixed' || accType === 'shares') && deposit > 0) {
        let debitGL = '1010';
        let creditGL = '2010';
        let typeName = 'Member Deposit';

        if (accType === 'fixed') {
          creditGL = '2020';
          typeName = 'Fixed Term Placement';
        } else if (accType === 'shares') {
          creditGL = '3010';
          typeName = 'Share Capital Purchase';
        }

        CoreBankingEngine.executeTransaction(state, {
          type: typeName,
          memberId: newMember.id,
          amount: deposit,
          channel: 'Branch FOSA Counter',
          debitGL,
          creditGL,
          description: `Opening ${accType} deposit for ${name} at ${currentBranch.name}`
        });

        App.showToast(`Account established for ${name}. Opening deposit of ${Formatter.money(deposit)} posted to GL (Dr ${debitGL} / Cr ${creditGL}).`, 'success');
      } else if (accType === 'loan') {
        const loanAmt = Number(container.querySelector('#new-loan-amount')?.value) || 0;
        const purpose = container.querySelector('#new-loan-purpose')?.value || 'Working Capital';
        newMember.activeLoans.push({
          loanId: `LN-${Math.floor(6000 + Math.random() * 3000)}`,
          product: 'Asset / Working Capital Facility',
          purpose,
          principal: loanAmt,
          outstandingBalance: loanAmt,
          monthlyInstallment: Math.round(loanAmt / 12),
          interestRate: 14.5,
          npaClassification: 'Normal (Performing)',
          daysInArrears: 0,
          nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        });
        App.showToast(`Loan account established for ${name} (${Formatter.money(loanAmt)}). Credit team will complete disbursement.`, 'success');
      } else {
        App.showToast(`Account successfully opened for ${newMember.name} (${newMember.id}).`, 'success');
      }

      store.save();
    });
  }
};

window.BranchView = BranchView;
