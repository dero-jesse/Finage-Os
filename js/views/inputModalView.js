/**
 * Finage OS v3 - Universal Data Input & Ingestion Center
 * Multi-tabbed modal and form center for Core Banking Transactions, Loan Pipeline, DFI Drawdowns, OpEx Schedules, and Bulk Ingestion
 */

const InputModalView = {
  activeTab: 'members', // 'members' | 'transactions' | 'loans' | 'dfi' | 'opex' | 'bulk'

  getMemberAccounts(state) {
    return (state.members || []).filter(member => !RIMEngine.isStaffProfile(member));
  },

  renderModal(container, state) {
    const tabDefinitions = [
      { id: 'members', label: '0. New Member' },
      { id: 'transactions', label: '1. Transactions' },
      { id: 'loans', label: '2. Loans' },
      { id: 'dfi', label: '3. DFI' },
      { id: 'opex', label: '4. Opex' },
      { id: 'bulk', label: '5. CSV' },
      { id: 'journal', label: '6. GL Journal' }
    ].filter(tab => App.canUseInputTab(tab.id, state));
    if (!tabDefinitions.some(tab => tab.id === this.activeTab)) {
      this.activeTab = tabDefinitions[0]?.id || 'transactions';
    }

    container.innerHTML = `
      <div class="modal-backdrop" id="universal-input-modal">
        <div class="modal-container" style="max-width: 780px;">
          <!-- Modal Header -->
          <div class="modal-header">
            <div>
              <div class="modal-title">
                Data Hub
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">
                Posting and controls
              </span>
            </div>
            <button class="modal-close" id="btn-close-input-modal" title="Close modal" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 0.3rem 0.6rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
              ✕ Close
            </button>
          </div>

          <!-- Modal Navigation Tabs -->
          <div style="display: flex; align-items: center; border-bottom: 1px solid var(--border-subtle); padding: 0 1.5rem; background: #f8fafc; overflow-x: auto; gap: 0.5rem;">
            ${tabDefinitions.map(tab => `
              <button class="input-tab-btn ${this.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
                ${tab.label}
              </button>
            `).join('')}
          </div>

          <!-- Modal Body with Dynamic Tab Content -->
          <div class="modal-body" id="input-modal-tab-body">
            ${this.renderActiveTab(state)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  renderActiveTab(state) {
    if (!App.canUseInputTab(this.activeTab, state)) return '';
    switch (this.activeTab) {
      case 'members':
        return this.renderMemberTab(state);
      case 'loans':
        return this.renderLoanTab(state);
      case 'dfi':
        return this.renderDFITab(state);
      case 'opex':
        return this.renderOpExTab(state);
      case 'bulk':
        return this.renderBulkTab(state);
      case 'journal':
        return this.renderJournalTab(state);
      case 'transactions':
      default:
        return this.renderTransactionTab(state);
    }
  },

  // --- TAB 0: New Member Onboarding Form ---
  renderMemberTab(state) {
    return `
      <form id="form-new-member" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Full Name</label>
            <input type="text" id="inp-member-name" class="form-control" placeholder="e.g. John Doe" required>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">National ID / Passport</label>
            <input type="text" id="inp-member-id" class="form-control" placeholder="e.g. 12345678" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Phone Number</label>
            <input type="text" id="inp-member-phone" class="form-control" placeholder="+254 7..." required>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Email Address (Optional)</label>
            <input type="email" id="inp-member-email" class="form-control" placeholder="john@example.com">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Next of Kin / Beneficiary</label>
            <input type="text" id="inp-member-kin" class="form-control" placeholder="Full name & relation" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Branch Assignment</label>
            <select id="inp-member-branch" class="form-control">
              ${state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Occupation</label>
            <input type="text" id="inp-member-occ" class="form-control" placeholder="e.g. Teacher" required>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Employer</label>
            <input type="text" id="inp-member-emp" class="form-control" placeholder="e.g. TSC" required>
          </div>
        </div>

        <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
          <span style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; display: block;">
            Opening Setup
          </span>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: end;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Primary Account Type</label>
              <select id="inp-member-acc-type" class="form-control">
                <option value="savings">FOSA Savings / Demand Account (GL 2010)</option>
                <option value="fixed">Fixed Term Deposit Account (GL 2020)</option>
                <option value="shares">Member Share Capital Equity (GL 3010)</option>
              </select>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.65rem 0.85rem; background: rgba(6,182,212,0.07); border: 1px solid rgba(6,182,212,0.25); border-radius: var(--radius-sm);">
              <span style="font-size: 1.1rem; line-height: 1; flex-shrink: 0;">🏧</span>
              <div style="font-size: 0.75rem; color: var(--text-dim); line-height: 1.45;">
                <strong style="color: var(--accent-cyan); display: block; margin-bottom: 0.15rem;">Opening Deposit — Teller Desk</strong>
                After registration, direct the member to the <strong>Teller Desk</strong>.
                The teller counts physical bills on the denomination board and posts the Member Deposit
                (Dr 1010 Till / Cr 2010 Savings). FOSA does not enter cash amounts.
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            Register & Onboard Member
          </button>
        </div>
      </form>
    `;
  },

  // --- TAB 1: Member Transactions Form ---
  renderTransactionTab(state) {
    return `
      <form id="form-member-tx" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Member Account</label>
            <select id="inp-tx-member" class="form-control">
              ${this.getMemberAccounts(state).map(m => `
                <option value="${m.id}" ${m.id === state.selectedMemberId ? 'selected' : ''}>
                  ${m.name} (${m.id})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Transaction Type</label>
            <select id="inp-tx-category" class="form-control">
              <option value="Member Deposit">Member Savings Deposit (Cr 2010 · Liability)</option>
              <option value="Member Withdrawal">Member Cash Withdrawal (Dr 2010 · Liability)</option>
              <option value="Loan Repayment">Loan Principal Repayment (Cr 1200 · Asset)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Transaction Amount (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-tx-amount" class="form-control" value="15000" min="0.01" step="any" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Delivery Channel</label>
            <select id="inp-tx-channel" class="form-control">
              <option value="Branch FOSA Counter">Branch FOSA Counter (Physical Cash)</option>
            </select>
          </div>
        </div>

        <div id="tx-loan-field" class="form-group" style="margin:0;display:none;">
          <label class="form-label">Loan being repaid</label>
          <select id="inp-tx-loan" class="form-control" disabled></select>
        </div>

        <!-- Real-Time GL Impact Preview Box -->
        <div style="background: var(--accent-aqua-subtle); border: 1px solid rgba(20, 184, 166, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.725rem; font-weight: 700; color: var(--accent-aqua); text-transform: uppercase; letter-spacing: 0.04em;">
            GL Impact:
          </span>
          <div id="gl-preview-text" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-top: 0.35rem;">
            Dr 1010 Branch Vault & Till Cash $15,000 / Cr 2010 Member Demand Deposits $15,000
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label">Reference / Description</label>
          <input type="text" id="inp-tx-desc" class="form-control" placeholder="e.g. Counter deposit by member / slip #89102">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            Post Real-Time Transaction
          </button>
        </div>
      </form>
    `;
  },

  // --- TAB 2: Loan Origination Form ---
  renderLoanTab(state) {
    const pacing = PacingEngine.getPacingAnalysis(state);
    const loanProducts = state.loanProducts || [];
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    return `
      <form id="form-loan-app" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Applicant Member</label>
            <select id="inp-loan-member" class="form-control">
              ${this.getMemberAccounts(state).map(m => `
                <option value="${m.id}">
                  ${m.name} (${m.id} • ${m.riskSegment})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Loan Product</label>
            <select id="inp-loan-product" class="form-control">
              ${loanProducts.map(product => `
                <option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${Number(product.annualInterestRate).toFixed(2)}% p.a. · ${product.repaymentMethod === 'flat' ? 'Flat' : 'Reducing balance'}${product.rateConfigured === false ? ' · rate confirmation required' : ''})</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label">Loan purpose</label>
          <textarea id="inp-loan-purpose" class="form-control" rows="2" maxlength="500" required></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Requested Principal (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-loan-amount" class="form-control" value="85000" min="0.01" step="any" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Loan Term</label>
            <select id="inp-loan-term" class="form-control">
              <option value="12">12 Months (1 Year)</option>
              <option value="24">24 Months (2 Years)</option>
              <option value="36">36 Months (3 Years)</option>
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Urgency Level</label>
            <select id="inp-loan-urgency" class="form-control">
              <option value="High">High Urgency</option>
              <option value="Medium" selected>Medium Urgency</option>
              <option value="Low">Low Urgency</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Assigned Branch</label>
            <select id="inp-loan-branch" class="form-control">
              ${state.branches.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Digital Guarantor Member</label>
            <select id="inp-loan-guarantor" class="form-control">
              <option value="">No guarantor recorded</option>
              ${this.getMemberAccounts(state).map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} (${Formatter.money(m.shareCapital)} Shares)</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Pacing Headroom Check Banner -->
        <div style="background: var(--accent-orange-subtle); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.725rem; font-weight: 700; color: #c2410c; text-transform: uppercase;">
            Disbursement Pacing Headroom Validation:
          </span>
          <div style="font-size: 0.825rem; color: var(--text-main); margin-top: 0.25rem;">
            Current Available Headroom: <strong>${Formatter.money(pacing.safeHeadroomTarget)}</strong> (maintaining 20% target buffer).
            New application will be scored and automatically placed into the Maker-Checker workflow.
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            Submit to Credit Workflow Queue
          </button>
        </div>
      </form>
    `;
  },

  // --- TAB 3: DFI Borrowing & Drawdown Form ---
  renderDFITab(state) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Sub-Form 1: Log Drawdown on Existing Facility -->
        <form id="form-dfi-drawdown" style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.15rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
            Option A: Record Drawdown on Approved DFI Credit Line
          </span>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Select Facility</label>
              <select id="inp-drawdown-facility" class="form-control">
                ${state.externalFacilities.map(f => `
                  <option value="${f.id}">
                    ${f.lender} (Avail: ${Formatter.money(f.availableToDraw, true)})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label">Drawdown Amount (${Formatter.currencySymbol})</label>
              <input type="number" id="inp-drawdown-amount" class="form-control" value="500000" min="0.01" step="any" required>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label">Destination Bank Account</label>
              <select id="inp-drawdown-bank" class="form-control">
                ${state.bankAccounts.map(b => `<option value="${b.id}">${b.institution} (${b.accountName})</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
            <span style="font-size: 0.75rem; color: var(--text-dim);">
              Instant GL: Dr 1020 Commercial Bank / Cr 2200 External DFI Borrowing
            </span>
            <button type="submit" class="btn btn-primary btn-sm">
              Execute Drawdown & Credit Cash
            </button>
          </div>
        </form>

        <!-- Sub-Form 2: Register New Facility -->
        <form id="form-new-facility" style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.15rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
            Option B: Register New External Credit / DFI Line
          </span>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Lender / DFI Entity</label>
              <input type="text" id="inp-fac-lender" class="form-control" placeholder="e.g. European Investment Bank (EIB)" required>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label">Facility Type</label>
              <input type="text" id="inp-fac-type" class="form-control" placeholder="e.g. Agri-Green Senior Line" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Commitment (${Formatter.currencySymbol})</label>
              <input type="number" id="inp-fac-commitment" class="form-control" value="2000000" min="0.01" step="any" required>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label">Interest Rate (% p.a.)</label>
              <input type="number" id="inp-fac-rate" class="form-control" value="6.8" step="0.1" required>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label">Next Amortization Date</label>
              <input type="date" id="inp-fac-date" class="form-control" value="2026-11-15">
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
            <button type="submit" class="btn btn-secondary btn-sm">
              Register Facility in Store
            </button>
          </div>
        </form>
      </div>
    `;
  },

  // --- TAB 4: OpEx Schedule Form ---
  renderOpExTab(state) {
    return `
      <form id="form-add-opex" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Operating Expense Category</label>
            <input type="text" id="inp-opex-cat" class="form-control" placeholder="e.g. Cloud Server Hosting & Core MIS License" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Monthly Outflow Amount (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-opex-amount" class="form-control" value="25000" min="0.01" step="any" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Due Day of Month (1 - 31)</label>
            <input type="number" id="inp-opex-day" class="form-control" value="15" min="1" max="31" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Cost Center / Department</label>
            <select id="inp-opex-dept" class="form-control">
              <option value="ICT & Digital Infrastructure">ICT & Digital Infrastructure</option>
              <option value="Human Resources & Payroll">Human Resources & Payroll</option>
              <option value="Branch Operations & Admin">Branch Operations & Admin</option>
              <option value="Compliance & Audit">Compliance & Audit</option>
            </select>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.35rem;">
            Current Active Monthly OpEx Schedule:
          </span>
          <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.775rem; color: var(--text-dim);">
            ${state.operatingExpenses.map(o => `
              <div style="display: flex; justify-content: space-between;">
                <span>• ${o.category} (Due Day ${o.dueDayOfMonth})</span>
                <span class="cell-mono" style="color: var(--text-main); font-weight: 600;">${Formatter.money(o.monthlyAmount)}/mo</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            Save OpEx Schedule Line
          </button>
        </div>
      </form>

      <form id="form-settle-expense" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-subtle);">
        <div>
          <h3 style="margin: 0 0 .35rem; font-size: .95rem; font-weight: 700; color: var(--text-main);">Disburse & Settle Operating Expense</h3>
          <p style="margin: 0; color: var(--text-dim); font-size: .78rem;">Generate an official payment voucher and execute real-time double-entry posting to the General Ledger.</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Payee / Vendor Name</label>
            <input type="text" id="inp-settle-payee" class="form-control" placeholder="e.g. UMEME Electricity / Office Supplies" required>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Invoice / Bill Reference</label>
            <input type="text" id="inp-settle-invoice" class="form-control" placeholder="e.g. INV-2026-091" required>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Expense Account (Debit)</label>
            <select id="inp-settle-expense-gl" class="form-control" required>
              ${(state.generalLedger || []).filter(g => (g.category || g.type || '').toLowerCase().includes('expense') || String(g.code).startsWith('5')).map(g => `<option value="${g.code}">${g.code} · ${g.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Funding Account (Credit)</label>
            <select id="inp-settle-funding-gl" class="form-control" required>
              <option value="1020">1020 · Commercial Bank Clearing</option>
              <option value="1010">1010 · Branch Cash Vault</option>
              <option value="1040">1040 · Mobile Float Wallet</option>
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Amount (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-settle-amount" class="form-control" min="0.01" step="any" required>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Payment Method</label>
            <select id="inp-settle-method" class="form-control">
              <option value="Bank Transfer">Bank Transfer (EFT/RTGS)</option>
              <option value="Cash Voucher">Cash Voucher</option>
              <option value="Corporate Mobile Float">Corporate Mobile Float</option>
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Payment Description / Purpose</label>
            <input type="text" id="inp-settle-desc" class="form-control" placeholder="e.g. Branch operational utilities settlement" required>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="submit" class="btn btn-primary" id="btn-submit-settle-expense">
            Disburse & Issue Voucher
          </button>
        </div>
      </form>
    `;
  },

  renderJournalTab(state) {
    const accounts = (state.generalLedger || []).slice().sort((left, right) => String(left.code).localeCompare(String(right.code)));
    const journals = (state.transactions || [])
      .filter(transaction => transaction.type === 'Manual GL Journal' && transaction.status === 'Completed')
      .slice()
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
    const selectedJournal = journals[0];
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const accountOptions = selectedCode => accounts.map(account =>
      `<option value="${escapeHtml(account.code)}" ${account.code === selectedCode ? 'selected' : ''}>${escapeHtml(account.code)} · ${escapeHtml(account.name)} (${escapeHtml(account.category || account.type || 'Unclassified')})</option>`
    ).join('');
    const options = accountOptions('');
    const journalOptions = journals.map(journal => `
      <option value="${escapeHtml(journal.id)}"
        data-debit="${escapeHtml(journal.glDebit)}"
        data-credit="${escapeHtml(journal.glCredit)}"
        data-amount="${escapeHtml(journal.amount)}"
        data-description="${escapeHtml(journal.details || '')}"
        ${journal.id === selectedJournal?.id ? 'selected' : ''}>
        ${escapeHtml(journal.id)} · ${escapeHtml(journal.date || '')} · ${Formatter.money(journal.amount)}
      </option>
    `).join('');
    return `
      <form id="form-gl-journal" style="display:flex;flex-direction:column;gap:1rem;">
        <p style="margin:0;color:var(--text-dim);font-size:.78rem;">Post a balanced debit and credit between any two accounts in this organization’s chart.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.85rem;">
          <label class="form-label">Debit account<select name="debitCode" class="form-control" required>${options}</select></label>
          <label class="form-label">Credit account<select name="creditCode" class="form-control" required>${options}</select></label>
          <label class="form-label">Amount<input name="amount" type="number" min="0.01" step="any" class="form-control" required></label>
          <label class="form-label">Journal description<input name="description" class="form-control" maxlength="180" required></label>
        </div>
        <div id="gl-journal-error" role="alert" style="display:none;color:var(--accent-rose);font-size:.78rem;font-weight:700;"></div>
        <div style="display:flex;justify-content:flex-end;">
          <button type="submit" class="btn btn-primary" ${accounts.length < 2 ? 'disabled' : ''}>Post Balanced Journal</button>
        </div>
      </form>
      <section style="display:flex;flex-direction:column;gap:1rem;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--border-subtle);">
        <div>
          <h3 style="margin:0 0 .35rem;font-size:.95rem;">Correct a posted manual journal</h3>
          <p style="margin:0;color:var(--text-dim);font-size:.78rem;">This updates the selected manual journal and its GL balances. The original values are recorded in the audit trail.</p>
        </div>
        ${journals.length ? `
          <form id="form-correct-gl-journal" style="display:flex;flex-direction:column;gap:1rem;">
            <label class="form-label">Posted journal<select name="transactionId" class="form-control" required>${journalOptions}</select></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.85rem;">
              <label class="form-label">Debit account<select name="debitCode" class="form-control" required>${accountOptions(selectedJournal.glDebit)}</select></label>
              <label class="form-label">Credit account<select name="creditCode" class="form-control" required>${accountOptions(selectedJournal.glCredit)}</select></label>
              <label class="form-label">Amount<input name="amount" type="number" min="0.01" step="any" class="form-control" value="${escapeHtml(selectedJournal.amount)}" required></label>
              <label class="form-label">Journal description<input name="description" class="form-control" maxlength="180" value="${escapeHtml(selectedJournal.details || '')}" required></label>
              <label class="form-label">Correction reason<input name="reason" class="form-control" maxlength="300" placeholder="Explain what was wrong" required></label>
            </div>
            <div id="gl-journal-correction-error" role="alert" style="display:none;color:var(--accent-rose);font-size:.78rem;font-weight:700;"></div>
            <div style="display:flex;justify-content:flex-end;">
              <button type="submit" class="btn btn-secondary" ${accounts.length < 2 ? 'disabled' : ''}>Save Journal Correction</button>
            </div>
          </form>
        ` : '<p style="margin:0;color:var(--text-dim);font-size:.8rem;">No completed manual GL journals are available to correct.</p>'}
      </section>
    `;
  },

  // --- TAB 5: Bulk CSV Ingestion Simulator ---
  renderBulkTab(state) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.825rem; font-weight: 600; color: var(--text-main);">
            Core Banking Batch Transaction Ingestion Stream
          </span>
        </div>

        <div class="form-group" style="margin: 0;">
          <label class="form-label">CSV Batch Records (Comma-Separated: Type, MemberID, Amount, Channel, Description)</label>
          <textarea id="inp-bulk-csv" class="form-control" rows="8" style="font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.4;" placeholder="Member Deposit,MEM-1001,45000,M-Pesa B2C/C2B,Agri Produce Sales Payout&#10;Loan Repayment,MEM-1002,14200,Branch FOSA Counter,Monthly Term Installment&#10;Share Capital Purchase,MEM-1003,20000,Commercial Bank Transfer,SACCO Equity Share Purchase"></textarea>
        </div>

        <div style="background: var(--accent-aqua-subtle); border: 1px solid rgba(20, 184, 166, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-aqua);">
            Zero-Batch Processing Guarantee:
          </span>
          <div style="font-size: 0.775rem; color: var(--text-dim); margin-top: 0.25rem;">
            All ingested records are immediately posted to the General Ledger and audit trail without locking transaction queues or requiring batch window shutdowns.
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button id="btn-process-bulk-csv" class="btn btn-primary">
            Process & Post Batch Stream
          </button>
        </div>
      </div>
    `;
  },

  bindEvents(container, state) {
    const modal = container.querySelector('#universal-input-modal');
    if (!modal) return;

    // Open / Close triggers
    const closeBtns = container.querySelectorAll('.modal-close, .btn-close-modal');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    });

    // Tab buttons
    const tabBtns = container.querySelectorAll('.input-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabBody = container.querySelector('#input-modal-tab-body');
        if (tabBody) {
          tabBody.innerHTML = this.renderActiveTab(state);
          this.bindTabSpecificEvents(container, state);
        }
      });
    });

    this.bindTabSpecificEvents(container, state);
  },

  bindTabSpecificEvents(container, state) {
    const modal = container.querySelector('#universal-input-modal');

    const journalForm = container.querySelector('#form-gl-journal');
    if (journalForm) {
      journalForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(journalForm);
        const debitCode = String(formData.get('debitCode') || '');
        const creditCode = String(formData.get('creditCode') || '');
        const amount = Number(formData.get('amount'));
        const description = String(formData.get('description') || '').trim();
        const errorEl = container.querySelector('#gl-journal-error');
        errorEl.style.display = 'none';
        if (debitCode === creditCode) {
          errorEl.textContent = 'Choose two different GL accounts for the debit and credit.';
          errorEl.style.display = 'block';
          return;
        }
        const submitButton = journalForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = 'Posting transaction…';
        journalForm.dataset.idempotencyKey ||= crypto.randomUUID();
        try {
          const result = await Platform.postFinancialTransaction({
            type: 'Manual GL Journal',
            amount,
            channel: 'Treasury Journal',
            description,
            legs: [
              { glCode: debitCode, type: 'Debit', amount },
              { glCode: creditCode, type: 'Credit', amount }
            ],
            idempotencyKey: journalForm.dataset.idempotencyKey
          });
          delete journalForm.dataset.idempotencyKey;
          App.showToast(result.refreshError
            ? `Journal ${result.transaction.id} was accepted by Supabase; refreshed balances could not be loaded: ${result.refreshError.message}`
            : `Balanced GL journal ${result.transaction.id} posted to Supabase.`, result.refreshError ? 'warning' : 'success');
          modal.classList.remove('active');
        } catch (error) {
          errorEl.textContent = error.message || 'Journal was not accepted by Supabase.';
          errorEl.style.display = 'block';
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
    }

    const correctionForm = container.querySelector('#form-correct-gl-journal');
    if (correctionForm) {
      const correctionError = container.querySelector('#gl-journal-correction-error');
      const journalSelect = correctionForm.elements.transactionId;
      const updateCorrectionFields = () => {
        const option = journalSelect.selectedOptions[0];
        correctionForm.elements.debitCode.value = option?.dataset.debit || '';
        correctionForm.elements.creditCode.value = option?.dataset.credit || '';
        correctionForm.elements.amount.value = option?.dataset.amount || '';
        correctionForm.elements.description.value = option?.dataset.description || '';
      };
      journalSelect.addEventListener('change', updateCorrectionFields);
      correctionForm.addEventListener('submit', async event => {
        event.preventDefault();
        correctionError.style.display = 'none';
        const formData = new FormData(correctionForm);
        const debitCode = String(formData.get('debitCode') || '');
        const creditCode = String(formData.get('creditCode') || '');
        if (debitCode === creditCode) {
          correctionError.textContent = 'Choose two different GL accounts for the debit and credit.';
          correctionError.style.display = 'block';
          return;
        }
        const submitButton = correctionForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = 'Posting transaction…';
        try {
          const result = await Platform.updateManualGLJournal({
            transactionId: String(formData.get('transactionId') || ''),
            debitCode,
            creditCode,
            amount: Number(formData.get('amount')),
            description: String(formData.get('description') || '').trim(),
            reason: String(formData.get('reason') || '').trim()
          });
          App.showToast(result.refreshError
            ? `Journal ${result.transaction.id} was corrected, but refreshed balances could not be loaded: ${result.refreshError.message}`
            : `Journal ${result.transaction.id} corrected. The previous values were recorded in the audit trail.`,
          result.refreshError ? 'warning' : 'success');
          modal.classList.remove('active');
        } catch (error) {
          correctionError.textContent = error.message || 'Journal correction was rejected.';
          correctionError.style.display = 'block';
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
    }

    // TAB 0: Member Onboarding Form
    const memberForm = container.querySelector('#form-new-member');
    if (memberForm) {
      memberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#inp-member-name')?.value;
        const idNumber = container.querySelector('#inp-member-id')?.value;
        const phone = container.querySelector('#inp-member-phone')?.value;
        const email = container.querySelector('#inp-member-email')?.value;
        const kin = container.querySelector('#inp-member-kin')?.value;
        const branchId = container.querySelector('#inp-member-branch')?.value;
        const occ = container.querySelector('#inp-member-occ')?.value;
        const emp = container.querySelector('#inp-member-emp')?.value;
        const accType = container.querySelector('#inp-member-acc-type')?.value || 'savings';

        const branchObj = state.branches.find(b => b.id === branchId) || state.branches[0];
        const submitButton = memberForm.querySelector('[type="submit"]');

        if (accType === 'loan') {
          App.showToast('A loan account cannot be opened during member registration. Submit an application through the Credit workflow.', 'danger');
          return;
        }

        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = 'Registering member…';
        try {
          const member = await store.addMember({
            name,
            nationalId: idNumber,
            phone,
            email,
            nextOfKin: kin,
            branchId,
            branchName: branchObj.name,
            occupation: occ,
            employer: emp
          });
          App.showToast(
            member.refreshError
              ? `Member ${name} (${member.id}) registered. Remote balances need refresh: ${member.refreshError.message}. Direct the member to the Teller Desk for the opening deposit.`
              : `Member ${name} (${member.id}) registered. Direct them to the Teller Desk — teller will count bills and post the opening deposit.`,
            member.refreshError ? 'warning' : 'success'
          );
          modal.classList.remove('active');
        } catch (error) {
          App.showToast(`Member registration failed: ${error.message || 'Unknown error.'}`, 'danger');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
    }

    // TAB 1: Member Transaction Form
    const txForm = container.querySelector('#form-member-tx');
    if (txForm) {
      const catSelect = container.querySelector('#inp-tx-category');
      const amtInput = container.querySelector('#inp-tx-amount');
      const channelSelect = container.querySelector('#inp-tx-channel');
      const previewText = container.querySelector('#gl-preview-text');

      const updateGLPreview = () => {
        const cat = catSelect?.value;
        const amt = Number(amtInput?.value) || 0;
        const ch = channelSelect?.value || '';
        const cashCode = ch.includes('M-Pesa') ? '1040' : (ch.includes('Bank') ? '1020' : '1010');
        const cashName = ch.includes('M-Pesa') ? 'Digital Float Pool' : (ch.includes('Bank') ? 'Commercial Bank Clearing' : 'Branch Vault Cash');

        if (previewText) {
          if (cat === 'Member Deposit') {
            previewText.textContent = `Dr ${cashCode} ${cashName} (Asset) ${Formatter.money(amt)} / Cr 2010 Member Demand Deposits (Liability) ${Formatter.money(amt)}`;
          } else if (cat === 'Member Withdrawal') {
            previewText.textContent = `Dr 2010 Member Demand Deposits (Liability) ${Formatter.money(amt)} / Cr ${cashCode} ${cashName} (Asset) ${Formatter.money(amt)}`;
          } else if (cat === 'Loan Repayment') {
            previewText.textContent = `Dr ${cashCode} ${cashName} (Asset) ${Formatter.money(amt)} / Cr 1200 Gross Loan Portfolio (Asset) ${Formatter.money(amt)}`;
          } else if (cat === 'Share Capital Purchase') {
            previewText.textContent = `Dr ${cashCode} ${cashName} (Asset) ${Formatter.money(amt)} / Cr 3010 Member Share Capital (Equity) ${Formatter.money(amt)}`;
          } else if (cat === 'Fixed Term Placement') {
            previewText.textContent = `Dr 2010 Member Demand Deposits (Liability) ${Formatter.money(amt)} / Cr 2020 Fixed Term Deposits (Liability) ${Formatter.money(amt)}`;
          } else if (cat === 'Dividend Distribution') {
            previewText.textContent = `Dr 3030 Retained Earnings (Equity) ${Formatter.money(amt)} / Cr 2010 Member Demand Deposits (Liability) ${Formatter.money(amt)}`;
          } else if (cat === 'Loan Loss Provision') {
            previewText.textContent = `Dr 5030 Loan Loss Provision Expense (Expense) ${Formatter.money(amt)} / Cr 1250 Loan Loss Reserve (Contra-Asset) ${Formatter.money(amt)}`;
          } else if (cat === 'Fee & Service Charge') {
            previewText.textContent = `Dr 2010 Member Demand Deposits (Liability) ${Formatter.money(amt)} / Cr 4030 Fees & Commission (Income) ${Formatter.money(amt)}`;
          }
        }
      };

      if (catSelect) catSelect.addEventListener('change', updateGLPreview);
      if (amtInput) amtInput.addEventListener('input', updateGLPreview);
      if (channelSelect) channelSelect.addEventListener('change', updateGLPreview);
      const txLoanField = container.querySelector('#tx-loan-field');
      const txLoanSelect = container.querySelector('#inp-tx-loan');
      const updateLoanSelect = () => {
        const member = state.members.find(item => item.id === container.querySelector('#inp-tx-member')?.value);
        const isRepayment = catSelect?.value === 'Loan Repayment';
        if (txLoanField) txLoanField.style.display = isRepayment ? 'block' : 'none';
        if (!txLoanSelect) return;
        txLoanSelect.disabled = !isRepayment || !(member?.activeLoans?.length);
        txLoanSelect.required = isRepayment;
        txLoanSelect.innerHTML = member?.activeLoans?.length
          ? `<option value="">Select a loan</option>${member.activeLoans.map(loan => `<option value="${String(loan.loanId || loan.id).replace(/[&<>"']/g, '')}">${String(loan.product || loan.loanId || loan.id).replace(/[&<>"']/g, '')} · ${Formatter.money(loan.outstandingBalance)}</option>`).join('')}`
          : '<option value="">No active loan</option>';
      };
      catSelect?.addEventListener('change', updateLoanSelect);
      container.querySelector('#inp-tx-member')?.addEventListener('change', updateLoanSelect);
      updateLoanSelect();

      txForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberId = container.querySelector('#inp-tx-member')?.value;
        const category = container.querySelector('#inp-tx-category')?.value;
        const amount = Number(container.querySelector('#inp-tx-amount')?.value);
        const channel = container.querySelector('#inp-tx-channel')?.value;
        const desc = container.querySelector('#inp-tx-desc')?.value;

        const cashCode = channel.includes('M-Pesa') ? '1040' : (channel.includes('Bank') ? '1020' : '1010');
        let debitGL = cashCode;
        let creditGL = '2010';

        if (category === 'Member Withdrawal') {
          debitGL = '2010';
          creditGL = cashCode;
        } else if (category === 'Loan Repayment') {
          debitGL = cashCode;
          creditGL = '1200';
        } else if (category === 'Share Capital Purchase') {
          debitGL = cashCode;
          creditGL = '3010';
        } else if (category === 'Fixed Term Placement') {
          debitGL = '2010';
          creditGL = '2020';
        } else if (category === 'Dividend Distribution') {
          debitGL = '3030';
          creditGL = '2010';
        } else if (category === 'Loan Loss Provision') {
          debitGL = '5030';
          creditGL = '1250';
        } else if (category === 'Fee & Service Charge') {
          debitGL = '2010';
          creditGL = '4030';
        }

        const supportedTypes = ['Member Deposit', 'Member Withdrawal', 'Loan Repayment'];
        if (!supportedTypes.includes(category)) {
          App.showToast('This transaction type does not yet have a deployed online posting service.', 'danger');
          return;
        }
        const submitButton = txForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        const originalLabel = submitButton.textContent;
        submitButton.textContent = 'Posting transaction…';
        txForm.dataset.idempotencyKey ||= crypto.randomUUID();
        try {
          const loanId = category === 'Loan Repayment'
            ? container.querySelector('#inp-tx-loan')?.value
            : null;
          const result = await Platform.postFinancialTransaction({
            type: category, memberId, loanId, amount, channel,
            description: desc || `${category} of ${Formatter.money(amount)}`,
            legs: [
              { glCode: debitGL, type: 'Debit', amount },
              { glCode: creditGL, type: 'Credit', amount }
            ],
            idempotencyKey: txForm.dataset.idempotencyKey
          });
          delete txForm.dataset.idempotencyKey;
          App.showToast(result.refreshError
            ? `${result.transaction.id} was accepted by Supabase; refreshed balances could not be loaded: ${result.refreshError.message}`
            : `Transaction ${result.transaction.id} accepted by Supabase.`,
          result.refreshError ? 'warning' : 'success');
          modal.classList.remove('active');
        } catch (error) {
          App.showToast(error.message || 'Supabase rejected this transaction.', 'danger');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      });
    }

    // TAB 2: Loan Application Form
    const loanForm = container.querySelector('#form-loan-app');
    if (loanForm) {
      loanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberId = container.querySelector('#inp-loan-member')?.value;
        const productId = container.querySelector('#inp-loan-product')?.value;
        const amount = Number(container.querySelector('#inp-loan-amount')?.value);
        const term = container.querySelector('#inp-loan-term')?.value;
        const urgency = container.querySelector('#inp-loan-urgency')?.value;

        try {
          loanForm.dataset.idempotencyKey ||= crypto.randomUUID();
          const accepted = await store.addLoanApplication({
            memberId,
            productId,
            amount,
            term,
            purpose: container.querySelector('#inp-loan-purpose')?.value,
            urgency,
            branch,
            guarantorMemberId: container.querySelector('#inp-loan-guarantor')?.value,
            creditScore: 820
          }, { idempotencyKey: loanForm.dataset.idempotencyKey, notify: false });
          App.showToast(accepted.refreshError
            ? `Supabase accepted loan application ${accepted.result.id}; refresh failed: ${accepted.refreshError.message}`
            : `Supabase accepted loan application ${accepted.result.id}.`, accepted.refreshError ? 'warning' : 'success');
          if (!accepted.refreshError) {
            delete loanForm.dataset.idempotencyKey;
            modal.classList.remove('active');
          }
          store.notify();
        } catch (error) {
          App.showToast(error.message || 'Loan application could not be submitted.', 'danger');
        }
      });
    }

    // TAB 3: DFI Drawdown
    const dfiDrawdownForm = container.querySelector('#form-dfi-drawdown');
    if (dfiDrawdownForm) {
      dfiDrawdownForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const facilityId = container.querySelector('#inp-drawdown-facility')?.value;
        const amount = Number(container.querySelector('#inp-drawdown-amount')?.value);
        try {
          dfiDrawdownForm.dataset.idempotencyKey ||= crypto.randomUUID();
          const outcome = await store.recordDFIDrawdown({ facilityId, amount }, {
            idempotencyKey: dfiDrawdownForm.dataset.idempotencyKey, notify: false
          });
          App.showToast(outcome.refreshError
            ? `Supabase accepted drawdown ${outcome.result.id}; refresh failed: ${outcome.refreshError.message}`
            : `Supabase accepted DFI drawdown ${outcome.result.id}.`, outcome.refreshError ? 'warning' : 'success');
          if (!outcome.refreshError) {
            delete dfiDrawdownForm.dataset.idempotencyKey;
            modal.classList.remove('active');
          }
          store.notify();
        } catch (error) {
          App.showToast(`Drawdown rejected: ${error.message}`, 'danger');
        }
      });
    }

    // TAB 3: New Facility
    const newFacilityForm = container.querySelector('#form-new-facility');
    if (newFacilityForm) {
      newFacilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lender = container.querySelector('#inp-fac-lender')?.value;
        const facilityType = container.querySelector('#inp-fac-type')?.value;
        const commitment = Number(container.querySelector('#inp-fac-commitment')?.value);
        const interestRate = Number(container.querySelector('#inp-fac-rate')?.value);
        const firstRepaymentDate = container.querySelector('#inp-fac-date')?.value;

        try {
        newFacilityForm.dataset.idempotencyKey ||= crypto.randomUUID();
        const result = await store.addExternalFacility({
          lender,
          facilityType,
          commitment,
          interestRate,
          firstRepaymentDate,
          repaymentAmount: commitment * 0.05
        }, { idempotencyKey: newFacilityForm.dataset.idempotencyKey, notify: false });
        App.showToast(result.refreshError ? `Supabase registered facility ${result.result.id}; refresh failed: ${result.refreshError.message}` : `Supabase registered facility ${result.result.id}.`, result.refreshError ? 'warning' : 'success');
        if (!result.refreshError) {
          delete newFacilityForm.dataset.idempotencyKey;
          modal.classList.remove('active');
        }
        store.notify();
        } catch (error) {
          App.showToast(`Facility registration rejected: ${error.message}`, 'danger');
        }
      });
    }

    // TAB 4: OpEx Form
    const opexForm = container.querySelector('#form-add-opex');
    if (opexForm) {
      opexForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = container.querySelector('#inp-opex-cat')?.value;
        const amount = Number(container.querySelector('#inp-opex-amount')?.value);
        const dueDay = Number(container.querySelector('#inp-opex-day')?.value);

        try {
          opexForm.dataset.idempotencyKey ||= crypto.randomUUID();
          const result = await store.addOperatingExpense({ category, amount, dueDay }, {
            idempotencyKey: opexForm.dataset.idempotencyKey, notify: false
          });
          App.showToast(result.refreshError ? `Supabase added expense schedule ${result.result.id}; refresh failed: ${result.refreshError.message}` : `Supabase added expense schedule ${result.result.id}.`, result.refreshError ? 'warning' : 'success');
          if (!result.refreshError) {
            delete opexForm.dataset.idempotencyKey;
            modal.classList.remove('active');
          }
          store.notify();
        } catch (error) {
          App.showToast(`Operating expense schedule rejected: ${error.message}`, 'danger');
        }
      });
    }

    // TAB 4: Settle Expense Form
    const settleForm = container.querySelector('#form-settle-expense');
    if (settleForm) {
      settleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = settleForm.querySelector('#btn-submit-settle-expense');
        const payeeName = container.querySelector('#inp-settle-payee')?.value.trim();
        const invoiceRef = container.querySelector('#inp-settle-invoice')?.value.trim();
        const expenseGL = container.querySelector('#inp-settle-expense-gl')?.value;
        const fundingGL = container.querySelector('#inp-settle-funding-gl')?.value;
        const amount = Number(container.querySelector('#inp-settle-amount')?.value);
        const paymentMethod = container.querySelector('#inp-settle-method')?.value;
        const description = container.querySelector('#inp-settle-desc')?.value.trim();

        if (expenseGL === fundingGL) {
          App.showToast('Debit and credit accounts must be different.', 'danger');
          return;
        }

        submitBtn.disabled = true;
        const origText = submitBtn.textContent;
        submitBtn.textContent = 'Posting transaction…';

        try {
          settleForm.dataset.idempotencyKey ||= crypto.randomUUID();
          const outcome = await Platform.settleExpense({
            payeeName,
            invoiceRef,
            expenseGL,
            fundingGL,
            amount,
            paymentMethod,
            description
          }, { idempotencyKey: settleForm.dataset.idempotencyKey });

          App.showToast(`Expense voucher issued: ${outcome.result?.id || 'Settled'} (${Formatter.money(amount)} paid to ${payeeName}).`, 'success');
          delete settleForm.dataset.idempotencyKey;
          modal.classList.remove('active');
        } catch (error) {
          App.showToast(`Expense settlement rejected: ${error.message}`, 'danger');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
      });
    }

    // TAB 5: Bulk Ingestion
    const bulkTextarea = container.querySelector('#inp-bulk-csv');
    const processBulkBtn = container.querySelector('#btn-process-bulk-csv');
    if (processBulkBtn && bulkTextarea) {
      processBulkBtn.addEventListener('click', async () => {
        const text = bulkTextarea.value.trim();
        if (!text) {
          App.showToast('Please enter or load CSV lines first.', 'warning');
          return;
        }

        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const txList = [];
        for (const line of lines) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            const type = parts[0];
            const memberId = parts[1];
            const amount = Number(parts[2]);
            if (isNaN(amount) || amount <= 0) continue;
            const channel = parts[3] || 'Batch Ingestion';
            const description = parts[4] || 'Core Banking Batch Feed';
            const glPairs = {
              'Member Deposit': { debitGL: '1010', creditGL: '2010' },
              'Teller Deposit': { debitGL: '1010', creditGL: '2010' },
              'Loan Repayment': { debitGL: '1010', creditGL: '1200' },
              'Share Capital Purchase': { debitGL: '1020', creditGL: '3010' }
            };
            const pair = glPairs[type] || { debitGL: '1010', creditGL: '2010' };
            txList.push({
              type,
              memberId,
              amount,
              debitGL: pair.debitGL,
              creditGL: pair.creditGL,
              channel,
              description
            });
          }
        }

        if (txList.length === 0) {
          App.showToast('No valid CSV rows parsed. Check format: Type, MemberID, Amount, Channel, Description', 'danger');
          return;
        }

        processBulkBtn.disabled = true;
        const origLabel = processBulkBtn.textContent;
        processBulkBtn.textContent = 'Posting transaction…';

        try {
          await Platform.batchPostTransactions(txList);
          App.showToast(`Batch accepted: ${txList.length} transactions posted atomically into General Ledger.`, 'success');
          modal.classList.remove('active');
        } catch (error) {
          App.showToast(`Batch posting rejected: ${error.message}`, 'danger');
        } finally {
          processBulkBtn.disabled = false;
          processBulkBtn.textContent = origLabel;
        }
      });
    }
  },

  open(tab = null) {
    if (!window.Platform?.hasOperationalAccess()) {
      App.showToast('Online operational write services are not enabled for this organization.', 'danger');
      return;
    }
    if (!App.canOpenInputHub()) {
      App.showToast('You do not have permission to use the Input Hub.', 'danger');
      return;
    }
    if (tab) this.activeTab = tab;
    const container = document.getElementById('input-modal-mount');
    const allowedTabs = ['members', 'transactions', 'loans', 'dfi', 'opex', 'bulk', 'journal']
      .filter(tab => App.canUseInputTab(tab));
    if (!allowedTabs.includes(this.activeTab)) this.activeTab = allowedTabs[0];
    if (container) this.renderModal(container, store.state);
    const modal = document.getElementById('universal-input-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }
};

window.InputModalView = InputModalView;
