/**
 * Finage OS v3 - Universal Data Input & Ingestion Center
 * Multi-tabbed modal and form center for Core Banking Transactions, Loan Pipeline, DFI Drawdowns, OpEx Schedules, and Bulk Ingestion
 */

const InputModalView = {
  activeTab: 'members', // 'members' | 'transactions' | 'loans' | 'dfi' | 'opex' | 'bulk'

  renderModal(container, state) {
    container.innerHTML = `
      <div class="modal-backdrop" id="universal-input-modal">
        <div class="modal-container" style="max-width: 780px;">
          <!-- Modal Header -->
          <div class="modal-header">
            <div>
              <div class="modal-title">
                Data Ingestion &amp; Input Center
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">
                Real-time posting, automated GL double-entry preview, and validation guardrails
              </span>
            </div>
            <button class="modal-close" id="btn-close-input-modal" title="Close modal" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 0.3rem 0.6rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--text-muted); cursor: pointer;">
              ✕ Close
            </button>
          </div>

          <!-- Modal Navigation Tabs -->
          <div style="display: flex; align-items: center; border-bottom: 1px solid var(--border-subtle); padding: 0 1.5rem; background: #f8fafc; overflow-x: auto; gap: 0.5rem;">
            <button class="input-tab-btn ${this.activeTab === 'members' ? 'active' : ''}" data-tab="members">
              0. New Member
            </button>
            <button class="input-tab-btn ${this.activeTab === 'transactions' ? 'active' : ''}" data-tab="transactions">
              1. Member Transactions
            </button>
            <button class="input-tab-btn ${this.activeTab === 'loans' ? 'active' : ''}" data-tab="loans">
              2. Loan Application
            </button>
            <button class="input-tab-btn ${this.activeTab === 'dfi' ? 'active' : ''}" data-tab="dfi">
              3. DFI / Borrowing Drawdown
            </button>
            <button class="input-tab-btn ${this.activeTab === 'opex' ? 'active' : ''}" data-tab="opex">
              4. OpEx Schedule
            </button>
            <button class="input-tab-btn ${this.activeTab === 'bulk' ? 'active' : ''}" data-tab="bulk">
              5. Bulk CSV Ingestion
            </button>
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
            Initial Account Establish & Double-Entry Funding
          </span>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; align-items: end;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Primary Account Type</label>
              <select id="inp-member-acc-type" class="form-control">
                <option value="savings">FOSA Savings / Demand Account (GL 2010)</option>
                <option value="fixed">Fixed Term Deposit Account (GL 2020)</option>
                <option value="shares">Member Share Capital Equity (GL 3010)</option>
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Initial Opening Deposit (${Formatter.currencySymbol})</label>
              <input type="number" id="inp-member-deposit" class="form-control" value="5000" min="0" step="500">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label">Funding Channel</label>
              <select id="inp-member-channel" class="form-control">
                <option value="Branch FOSA Counter">Branch FOSA Counter</option>
                <option value="M-Pesa B2C/C2B">M-Pesa Mobile Float</option>
              </select>
            </div>
          </div>
          <div style="font-size: 0.725rem; color: var(--text-dim); margin-top: 0.5rem;">
            If opening deposit > 0, an automated Double-Entry GL post (Dr Cash / Cr Selected Account Type) will be posted instantly with zero-batch delay.
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
              ${state.members.map(m => `
                <option value="${m.id}" ${m.id === state.selectedMemberId ? 'selected' : ''}>
                  ${m.name} (${m.id})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Transaction Category (Double-Entry)</label>
            <select id="inp-tx-category" class="form-control">
              <option value="Member Deposit">Member Savings Deposit (Cr 2010 · Liability)</option>
              <option value="Member Withdrawal">Member Cash Withdrawal (Dr 2010 · Liability)</option>
              <option value="Loan Repayment">Loan Principal Repayment (Cr 1200 · Asset)</option>
              <option value="Share Capital Purchase">Member Share Capital (Cr 3010 · Equity)</option>
              <option value="Fixed Term Placement">Fixed Term Deposit Placement (Cr 2020 · Liability)</option>
              <option value="Dividend Distribution">Dividend Distribution (Dr 3030 · Equity / Cr 2010)</option>
              <option value="Loan Loss Provision">NPA Loan Loss Provision (Dr 5030 · Expense / Cr 1250)</option>
              <option value="Fee & Service Charge">Account Service Fee Charge (Cr 4030 · Income)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Transaction Amount (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-tx-amount" class="form-control" value="15000" min="1" step="100" required>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Delivery Channel</label>
            <select id="inp-tx-channel" class="form-control">
              <option value="Branch FOSA Counter">Branch FOSA Counter (Physical Cash)</option>
              <option value="M-Pesa B2C/C2B">M-Pesa Mobile Float (Aggregator)</option>
              <option value="SACCO Agency Banking">SACCO Agency Network Pool</option>
              <option value="Commercial Bank Transfer">Commercial Bank Direct Wire</option>
            </select>
          </div>
        </div>

        <!-- Real-Time GL Impact Preview Box -->
        <div style="background: var(--accent-aqua-subtle); border: 1px solid rgba(20, 184, 166, 0.3); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <span style="font-size: 0.725rem; font-weight: 700; color: var(--accent-aqua); text-transform: uppercase; letter-spacing: 0.04em;">
            Automated Zero-Batch Double-Entry GL Impact:
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

    return `
      <form id="form-loan-app" style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Applicant Member</label>
            <select id="inp-loan-member" class="form-control">
              ${state.members.map(m => `
                <option value="${m.id}">
                  ${m.name} (${m.id} • ${m.riskSegment})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin: 0;">
            <label class="form-label">Loan Product</label>
            <select id="inp-loan-product" class="form-control">
              <option value="Agri Asset Finance">Agri Asset Finance (18.5% Yield)</option>
              <option value="Commercial SME Working Capital">Commercial SME Working Capital (19.0% Yield)</option>
              <option value="Micro-Enterprise Growth Loan">Micro-Enterprise Growth Loan (21.0% Yield)</option>
              <option value="Green Solar SACCO Expansion">Green Solar SACCO Expansion (16.0% Yield)</option>
              <option value="Asset Finance Vehicle Line">Asset Finance Vehicle Line (17.5% Yield)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div class="form-group" style="margin: 0;">
            <label class="form-label">Requested Principal (${Formatter.currencySymbol})</label>
            <input type="number" id="inp-loan-amount" class="form-control" value="85000" min="1000" step="5000" required>
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
              ${state.members.map(m => `<option value="${m.id}">${m.name} ($${m.shareCapital.toLocaleString()} Shares)</option>`).join('')}
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
              <input type="number" id="inp-drawdown-amount" class="form-control" value="500000" min="10000" step="50000" required>
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
              <input type="number" id="inp-fac-commitment" class="form-control" value="2000000" min="10000" step="100000" required>
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
            <input type="number" id="inp-opex-amount" class="form-control" value="25000" min="100" step="500" required>
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
          <button id="btn-load-sample-csv" class="btn btn-secondary btn-sm">
            Load Pre-Formatted Institutional Sample Stream
          </button>
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

    // TAB 0: Member Onboarding Form
    const memberForm = container.querySelector('#form-new-member');
    if (memberForm) {
      memberForm.addEventListener('submit', (e) => {
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
        const deposit = Number(container.querySelector('#inp-member-deposit')?.value) || 0;
        const channel = container.querySelector('#inp-member-channel')?.value || 'Branch FOSA Counter';

        const newId = `MEM-${Math.floor(1000 + Math.random() * 9000)}`;
        const branchObj = state.branches.find(b => b.id === branchId) || state.branches[0];

        const newMember = {
          id: newId,
          name,
          nationalId: idNumber,
          phone,
          email,
          nextOfKin: kin,
          branchId,
          branchName: branchObj.name,
          accountOpenedDate: new Date().toISOString().slice(0, 10),
          kycStatus: 'Verified',
          occupation: occ,
          employer: emp,
          riskSegment: 'Low Risk',
          relationshipScore: 80,
          savingsBalance: 0,
          fixedDepositBalance: 0,
          shareCapital: 0,
          activeLoans: [],
          guarantorCommitments: []
        };

        state.members.push(newMember);

        // If deposit > 0, post via Double-Entry Engine
        if (deposit > 0) {
          const cashCode = channel.includes('M-Pesa') ? '1040' : '1010';
          let creditCode = '2010';
          let typeLabel = 'Member Deposit';
          if (accType === 'fixed') {
            creditCode = '2020';
            typeLabel = 'Fixed Term Placement';
          } else if (accType === 'shares') {
            creditCode = '3010';
            typeLabel = 'Share Capital Purchase';
          }

          CoreBankingEngine.executeTransaction(state, {
            type: typeLabel,
            memberId: newId,
            amount: deposit,
            channel,
            debitGL: cashCode,
            creditGL: creditCode,
            description: `Opening deposit for new member ${name} (${accType})`
          });
        } else {
          store.save();
        }

        App.showToast(`Member ${name} (${newId}) onboarded successfully!`, 'success');
        modal.classList.remove('active');
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

      txForm.addEventListener('submit', (e) => {
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

        const res = CoreBankingEngine.executeTransaction(state, {
          type: category,
          memberId,
          amount,
          channel,
          debitGL,
          creditGL,
          description: desc || `${category} of ${Formatter.money(amount)}`
        });

        if (res) {
          App.showToast(`Transaction posted: ${category} of ${Formatter.money(amount)} processed in real-time.`, 'success');
          modal.classList.remove('active');
        }
      });
    }

    // TAB 2: Loan Application Form
    const loanForm = container.querySelector('#form-loan-app');
    if (loanForm) {
      loanForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const memberId = container.querySelector('#inp-loan-member')?.value;
        const product = container.querySelector('#inp-loan-product')?.value;
        const amount = Number(container.querySelector('#inp-loan-amount')?.value);
        const term = container.querySelector('#inp-loan-term')?.value;
        const urgency = container.querySelector('#inp-loan-urgency')?.value;
        const branch = container.querySelector('#inp-loan-branch')?.value;

        const disbId = store.addLoanApplication({
          memberId,
          product,
          amount,
          term,
          urgency,
          branch,
          interestRate: 18.0,
          creditScore: 820
        });

        App.showToast(`Loan application ${disbId} for ${Formatter.money(amount)} originated and routed to Credit Workflow Inbox.`, 'success');
        modal.classList.remove('active');
      });
    }

    // TAB 3: DFI Drawdown
    const dfiDrawdownForm = container.querySelector('#form-dfi-drawdown');
    if (dfiDrawdownForm) {
      dfiDrawdownForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const facilityId = container.querySelector('#inp-drawdown-facility')?.value;
        const amount = Number(container.querySelector('#inp-drawdown-amount')?.value);
        const destinationBankId = container.querySelector('#inp-drawdown-bank')?.value;

        store.recordDFIDrawdown({
          facilityId,
          amount,
          destinationBankId
        });

        App.showToast(`Drawdown of ${Formatter.money(amount)} executed. Bank clearing liquidity increased.`, 'success');
        modal.classList.remove('active');
      });
    }

    // TAB 3: New Facility
    const newFacilityForm = container.querySelector('#form-new-facility');
    if (newFacilityForm) {
      newFacilityForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const lender = container.querySelector('#inp-fac-lender')?.value;
        const facilityType = container.querySelector('#inp-fac-type')?.value;
        const commitment = Number(container.querySelector('#inp-fac-commitment')?.value);
        const interestRate = Number(container.querySelector('#inp-fac-rate')?.value);
        const firstRepaymentDate = container.querySelector('#inp-fac-date')?.value;

        store.addExternalFacility({
          lender,
          facilityType,
          commitment,
          interestRate,
          firstRepaymentDate,
          repaymentAmount: commitment * 0.05
        });

        App.showToast(`New facility with ${lender} (${Formatter.money(commitment)}) registered.`, 'success');
        modal.classList.remove('active');
      });
    }

    // TAB 4: OpEx Form
    const opexForm = container.querySelector('#form-add-opex');
    if (opexForm) {
      opexForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const category = container.querySelector('#inp-opex-cat')?.value;
        const amount = Number(container.querySelector('#inp-opex-amount')?.value);
        const dueDay = Number(container.querySelector('#inp-opex-day')?.value);

        store.addOperatingExpense({
          category,
          amount,
          dueDay
        });

        App.showToast(`OpEx line "${category}" (${Formatter.money(amount)}/mo) added to cash forecast.`, 'success');
        modal.classList.remove('active');
      });
    }

    // TAB 5: Bulk Ingestion
    const loadSampleBtn = container.querySelector('#btn-load-sample-csv');
    const bulkTextarea = container.querySelector('#inp-bulk-csv');
    if (loadSampleBtn && bulkTextarea) {
      loadSampleBtn.addEventListener('click', () => {
        bulkTextarea.value = `Member Deposit,MEM-1001,45000,M-Pesa B2C/C2B,Agri Harvest Bulk Settlement
Loan Repayment,MEM-1002,14200,Branch FOSA Counter,Monthly Fleet Loan Installment
Share Capital Purchase,MEM-1003,25000,Commercial Bank Transfer,SACCO Equity Share Purchase
Member Deposit,MEM-1004,18000,SACCO Agency Network,Dairy Co-op Milk Payout
Loan Repayment,MEM-1001,9400,M-Pesa B2C/C2B,Agri Expansion Loan Installment`;
      });
    }

    const processBulkBtn = container.querySelector('#btn-process-bulk-csv');
    if (processBulkBtn && bulkTextarea) {
      processBulkBtn.addEventListener('click', () => {
        const text = bulkTextarea.value.trim();
        if (!text) {
          alert('Please enter or load CSV lines first.');
          return;
        }

        const lines = text.split('\n');
        const txList = [];
        lines.forEach(line => {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            txList.push({
              type: parts[0],
              memberId: parts[1],
              amount: Number(parts[2]),
              channel: parts[3] || 'Batch Ingestion',
              description: parts[4] || 'Core Banking Batch Feed'
            });
          }
        });

        if (txList.length > 0) {
          const count = store.ingestBatchTransactions(txList);
          App.showToast(`Batch Ingestion Complete: ${count} transactions posted to GL with zero-batch delay.`, 'success');
          modal.classList.remove('active');
        }
      });
    }
  },

  open() {
    const modal = document.getElementById('universal-input-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }
};

window.InputModalView = InputModalView;
