/**
 * Finage OS — Organisation Setup Wizard
 * Multi-step modal for platform superusers to onboard a new SACCO/MFI.
 * Steps: 1 Organisation Info → 2 Branches → 3 Chart of Accounts → 4 Staff Users → 5 Review & Provision
 */

const SetupWizardView = {
  _step: 1,
  _totalSteps: 5,
  _data: {
    org: {},
    branches: [],
    glAccounts: [],
    staffUsers: [],
    roles: [],
    setupPlan: 'now',
    importMode: 'full',
    importData: null
  },
  _loading: false,
  _provisionedSchema: null,
  _invitationResults: [],

  // ─── Default GL template (standard SACCO COA) ───────────────────────────
  _defaultGL: [
    { code: '1010', name: 'Cash in Hand – Vault', category: 'Asset', type: 'Current', normal: 'Debit',  isContra: false },
    { code: '1020', name: 'Cash in Hand – Teller Tills', category: 'Asset', type: 'Current', normal: 'Debit', isContra: false },
    { code: '1040', name: 'Mobile Money Wallet (M-Pesa/Airtel)', category: 'Asset', type: 'Current', normal: 'Debit', isContra: false },
    { code: '1060', name: 'Bank – Current Account', category: 'Asset', type: 'Current', normal: 'Debit', isContra: false },
    { code: '1080', name: 'T-Bills & Short-Term Investments', category: 'Asset', type: 'Investment', normal: 'Debit', isContra: false },
    { code: '1200', name: 'Loan Portfolio – Gross', category: 'Asset', type: 'Loan', normal: 'Debit', isContra: false },
    { code: '1210', name: 'Loan Loss Provision (Contra)', category: 'Asset', type: 'Contra', normal: 'Credit', isContra: true },
    { code: '2010', name: 'Member Savings Deposits', category: 'Liability', type: 'Deposit', normal: 'Credit', isContra: false },
    { code: '2020', name: 'Fixed Deposit Accounts', category: 'Liability', type: 'Deposit', normal: 'Credit', isContra: false },
    { code: '2030', name: 'DFI Borrowings (External Lines)', category: 'Liability', type: 'Borrowing', normal: 'Credit', isContra: false },
    { code: '3010', name: 'Share Capital', category: 'Equity', type: 'Capital', normal: 'Credit', isContra: false },
    { code: '3020', name: 'Retained Surplus', category: 'Equity', type: 'Capital', normal: 'Credit', isContra: false },
    { code: '4010', name: 'Interest Income – Loans', category: 'Income', type: 'Revenue', normal: 'Credit', isContra: false },
    { code: '4020', name: 'Fee & Commission Income', category: 'Income', type: 'Revenue', normal: 'Credit', isContra: false },
    { code: '5010', name: 'Interest Expense – Deposits', category: 'Expense', type: 'Interest', normal: 'Debit', isContra: false },
    { code: '5020', name: 'Staff Costs', category: 'Expense', type: 'Operating', normal: 'Debit', isContra: false },
    { code: '5030', name: 'Loan Loss Expense (Provision Charge)', category: 'Expense', type: 'Provision', normal: 'Debit', isContra: false },
  ],

  // ─── Default Roles ───────────────────────────────────────────────────────
  _defaultRoles: [
    { id: 'ROLE-ADMIN',        name: 'System Administrator',            category: 'board',        permissions: ['READ_ALL_MODULES','MANAGE_USERS','REPORTS_ACCESS','POLICY_THRESHOLD_CONFIG','BOARD_ESCALATION_APPROVE','GOVERNANCE_OVERVIEW'] },
    { id: 'ROLE-BRANCH-MGR',  name: 'Branch Manager / FOSA Supervisor', category: 'front-office', permissions: ['VAULT_RECONCILE','APPROVE_BRANCH_LOAN_TIER1','TELLER_LIMIT_OVERRIDE','AUDIT_TELLER_ACTIVITY','REPORTS_ACCESS'] },
    { id: 'ROLE-TELLER',       name: 'Teller Desk Officer',             category: 'teller',       permissions: ['POST_COUNTER_TX','VIEW_MEMBER_BALANCE','MANAGE_ASSIGNED_TILL'] },
    { id: 'ROLE-CREDIT-MAKER', name: 'Credit Origination Officer',      category: 'credit',       permissions: ['ORIGINATE_LOAN_APP','KYC_RISK_SCORING','VIEW_PAR_METRICS'] },
    { id: 'ROLE-CREDIT-CHECKER','name': 'Head of Credit / Checker',     category: 'credit',       permissions: ['APPROVE_CREDIT_FACILITY','PACING_RELEASE_AUTHORIZE','OVERRIDE_NPA_PROVISION'] },
    { id: 'ROLE-TREASURY',     name: 'Treasury & Liquidity Officer',    category: 'treasury',     permissions: ['EXECUTE_DFI_DRAWDOWN','RECONCILE_BANKS','PLACE_TBILLS','MODIFY_GL_JOURNAL','REPORTS_ACCESS'] },
    { id: 'ROLE-AUDITOR',      name: 'Internal Auditor',                category: 'board',        permissions: ['VIEW_AUDIT_LOGS','EXPORT_SASRA_RETURNS','READ_ALL_MODULES','REPORTS_ACCESS'] },
  ],

  open() {
    this._step = 1;
    this._data = {
      org: {},
      branches: [{ id: 'br-01', name: 'Head Office', code: 'HQ', tellerCount: 2, vaultLimit: 50000000, tellerCashLimit: 2000000 }],
      glAccounts: [...this._defaultGL],
      staffUsers: [],
      roles: [...this._defaultRoles],
      setupPlan: 'now',
      importMode: 'full',
      importData: { organization: {}, branches: [], members: [], loans: [], transactions: [], glAccounts: [], openingBalances: [], migrationRecords: [], sourceFiles: [], errors: [], sheets: [] }
    };
    this._provisionedSchema = null;
    this._invitationResults = [];
    this._render();
  },

  _render() {
    let overlay = document.getElementById('setup-wizard-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'setup-wizard-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = this._buildOverlay();
    this._bindEvents(overlay);
  },

  _buildOverlay() {
    const stepTitles = ['Organisation Info', 'Branches', 'Chart of Accounts', 'Staff Users', 'Review & Provision'];
    const stepIcons  = ['🏦', '🏢', '📊', '👥', '🚀'];

    const progressDots = stepTitles.map((t, i) => {
      const num = i + 1;
      const active  = num === this._step ? 'background: linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 4px 12px rgba(16,185,129,0.4);' : '';
      const done    = num < this._step  ? 'background:#d1fae5; color:#065f46; border-color:#6ee7b7;' : '';
      const future  = num > this._step  ? 'background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0;' : '';
      return `
        <button type="button" data-wizard-step="${num}" aria-label="${num < this._step ? `Return to ${t}` : t}" ${num >= this._step ? 'disabled' : ''} style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;border:0;background:transparent;padding:0;cursor:${num < this._step ? 'pointer' : 'default'};">
          <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;border:2px solid;transition:all .3s;${active||done||future}">${num < this._step ? '✓' : num}</div>
          <span style="font-size:0.58rem;color:${num===this._step?'#059669':num<this._step?'#065f46':'#94a3b8'};font-weight:${num===this._step?'700':'500'};text-align:center;line-height:1.2;">${t}</span>
        </button>
        ${i < stepTitles.length - 1 ? '<div style="flex:1;height:2px;background:' + (num < this._step ? '#6ee7b7' : '#e2e8f0') + ';margin-top:-18px;"></div>' : ''}
      `;
    }).join('');

    return `
      <div style="position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;">
        <div style="background:#fff;border-radius:24px;box-shadow:0 40px 100px rgba(0,0,0,0.2);width:100%;max-width:780px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">
          
          <!-- Header -->
          <div style="padding:1.5rem 2rem 1rem;border-bottom:1px solid #f1f5f9;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;">
              <div>
                <div style="font-size:0.65rem;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:.1em;">Platform Superuser</div>
                <h2 style="margin:0;font-size:1.35rem;font-weight:800;color:#064e3b;letter-spacing:-.03em;">${stepIcons[this._step-1]} ${stepTitles[this._step-1]}</h2>
              </div>
              <button id="wizard-close" style="background:none;border:none;cursor:pointer;font-size:1.4rem;color:#94a3b8;padding:4px;border-radius:8px;line-height:1;">✕</button>
            </div>
            <!-- Progress -->
            <div style="display:flex;align-items:center;gap:0;">${progressDots}</div>
          </div>

          <!-- Step Content -->
          <div id="wizard-step-content" style="flex:1;overflow-y:auto;padding:1.5rem 2rem;">
            ${this._buildStepContent()}
          </div>

          <!-- Footer -->
          <div style="padding:1rem 2rem;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:1rem;background:#fafafa;">
            <div></div>
            <div style="display:flex;gap:.75rem;">
              ${this._step > 1 ? `<button id="wizard-back" style="padding:.6rem 1.4rem;border-radius:10px;border:2px solid #e2e8f0;background:#fff;font-weight:700;font-size:.82rem;cursor:pointer;color:#475569;">← Previous Step</button>` : ''}
              ${this._step < this._totalSteps
                ? `<button id="wizard-next" style="padding:.7rem 2rem;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:800;font-size:.85rem;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.35);">Next →</button>`
                : `<button id="wizard-provision" style="padding:.7rem 2rem;border-radius:12px;border:none;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-weight:800;font-size:.85rem;cursor:pointer;box-shadow:0 4px 14px rgba(124,58,237,0.35);" ${this._loading?'disabled':''}>🚀 ${this._loading ? 'Provisioning...' : 'Provision Organisation'}</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _buildStepContent() {
    switch (this._step) {
      case 1: return this._buildStep1();
      case 2: return this._buildStep2();
      case 3: return this._buildStep3();
      case 4: return this._buildStep4();
      case 5: return this._buildStep5();
      default: return '';
    }
  },

  _escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  },

  // Step 1: Organisation Info
  _buildStep1() {
    const o = this._data.org;
    const input = (id, label, type, placeholder, val, extra='') =>
      `<div class="form-group"><label class="form-label" style="font-size:.7rem;letter-spacing:.06em;">${label}</label><input type="${type}" id="${id}" class="form-control" placeholder="${placeholder}" value="${this._escapeHtml(val || '')}" ${extra}></div>`;
    const select = (id, label, options, val) =>
      `<div class="form-group"><label class="form-label" style="font-size:.7rem;letter-spacing:.06em;">${label}</label><select id="${id}" class="form-control">${options.map(op => `<option value="${op.v}" ${op.v===val?'selected':''}>${op.l}</option>`).join('')}</select></div>`;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        ${input('wiz-org-id',   'Org ID (unique slug, no spaces)', 'text', 'org_finage_ug', o.id, 'style="font-family:monospace;"')}
        ${input('wiz-org-name', 'Full Legal Name', 'text', 'Finage Apex SACCO Ltd', o.name)}
        ${select('wiz-org-type', 'Institution Type', [
          {v:'SACCO', l:'SACCO (Savings & Credit Co-op)'}, {v:'MFI', l:'Microfinance Institution'}, {v:'Bank', l:'Commercial Bank'}
        ], o.type || 'SACCO')}
        ${input('wiz-reg-number', 'Registration Number', 'text', 'REG/XXXXXXXXX/2020', o.regNumber)}
        ${select('wiz-country', 'Country', [
          {v:'UG',l:'Uganda'},{v:'KE',l:'Kenya'},{v:'TZ',l:'Tanzania'},{v:'RW',l:'Rwanda'}
        ], o.country || 'UG')}
        ${select('wiz-currency', 'Base Currency', [
          {v:'UGX',l:'UGX – Uganda Shilling'},{v:'KES',l:'KES – Kenya Shilling'},{v:'TZS',l:'TZS – Tanzania Shilling'},{v:'RWF',l:'RWF – Rwanda Franc'}
        ], o.baseCurrency || 'UGX')}
        ${select('wiz-regulatory-body', 'Regulatory Body', [
          {v:'BOU',l:'BOU – Bank of Uganda'},{v:'CBK',l:'CBK – Central Bank of Kenya'},{v:'BOT',l:'BOT – Bank of Tanzania'},{v:'BNR',l:'BNR – National Bank of Rwanda'},{v:'SASRA',l:'SASRA (Kenya SACCO regulator)'}
        ], o.regulatoryBody || 'BOU')}
        ${input('wiz-financial-year', 'Current Financial Year', 'text', '2026', o.financialYear || '2026')}
        ${input('wiz-min-liquidity', 'Min Liquidity Ratio (%)', 'number', '15', o.minLiquidityRatio || '15')}
        ${input('wiz-owner-name', 'Organisation Owner Name', 'text', 'Organisation Administrator', o.ownerName)}
        ${input('wiz-superuser-email', 'Org Superuser Email', 'email', 'admin@yourorg.co.ug', o.superuserEmail)}
      </div>
    `;
  },

  // Step 2: Branches
  _buildStep2() {
    const setupLater = this._data.setupPlan === 'later';
    const rows = this._data.branches.map((b, i) => `
      <tr>
        <td><input class="form-control form-control-sm" style="font-size:.75rem;" data-field="name" data-idx="${i}" value="${this._escapeHtml(b.name)}"></td>
        <td><input class="form-control form-control-sm" style="font-size:.75rem;font-family:monospace;" data-field="code" data-idx="${i}" value="${this._escapeHtml(b.code)}"></td>
        <td><input type="number" class="form-control form-control-sm" style="font-size:.75rem;" data-field="tellerCount" data-idx="${i}" value="${b.tellerCount||0}"></td>
        <td><input type="number" class="form-control form-control-sm" style="font-size:.75rem;" data-field="vaultLimit" data-idx="${i}" value="${b.vaultLimit||0}"></td>
        <td><input type="number" class="form-control form-control-sm" style="font-size:.75rem;" data-field="tellerCashLimit" data-idx="${i}" value="${b.tellerCashLimit||0}"></td>
        <td><button class="btn btn-sm" style="background:rgba(239,68,68,.08);color:#dc2626;border:none;padding:3px 8px;border-radius:6px;cursor:pointer;" data-remove-branch="${i}">✕</button></td>
      </tr>
    `).join('');

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;">
        <label style="display:flex;gap:.65rem;align-items:flex-start;padding:.85rem;border:2px solid ${setupLater ? '#e2e8f0' : '#10b981'};border-radius:10px;cursor:pointer;">
          <input type="radio" name="wizard-setup-plan" value="now" ${setupLater ? '' : 'checked'}>
          <span><strong style="display:block;color:#064e3b;font-size:.8rem;">Set up now</strong><small style="color:#64748b;">Enter branches manually or import your workbook/CSV.</small></span>
        </label>
        <label style="display:flex;gap:.65rem;align-items:flex-start;padding:.85rem;border:2px solid ${setupLater ? '#10b981' : '#e2e8f0'};border-radius:10px;cursor:pointer;">
          <input type="radio" name="wizard-setup-plan" value="later" ${setupLater ? 'checked' : ''}>
          <span><strong style="display:block;color:#064e3b;font-size:.8rem;">Finish later</strong><small style="color:#64748b;">Provision a Head Office baseline. The organization admin can complete setup after sign-in.</small></span>
        </label>
      </div>
      <div style="margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;">
        <p style="margin:0;font-size:.82rem;color:#475569;">${setupLater ? 'A minimal Head Office branch will be created so the organization can be provisioned.' : 'Define branches manually or upload existing setup and account data.'}</p>
        ${setupLater ? '' : '<button id="btn-add-branch" style="padding:.4rem 1rem;border-radius:8px;border:2px solid #10b981;background:#f0fdf4;color:#059669;font-weight:700;font-size:.75rem;cursor:pointer;">+ Add Branch</button>'}
      </div>
      ${setupLater ? `
        <div style="padding:.7rem .85rem;margin-bottom:.8rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:.78rem;color:#475569;">Head Office · HQ · no teller limits configured</div>
      ` : `
      <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;">
        <table style="width:100%;border-collapse:collapse;font-size:.78rem;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:.5rem .75rem;text-align:left;font-size:.67rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Branch Name</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.67rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Code</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.67rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Tellers</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.67rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Vault Limit</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.67rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Teller Cash Limit</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="branches-tbody">${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:1rem;padding:1rem;border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;">
        <div style="font-size:.82rem;font-weight:800;color:#1e3a8a;margin-bottom:.55rem;">Choose a migration approach</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.75rem;">
          <label style="padding:.7rem;border:1px solid ${this._data.importMode === 'full' ? '#2563eb' : '#cbd5e1'};border-radius:8px;background:#fff;display:flex;gap:.5rem;align-items:flex-start;">
            <input type="radio" name="wizard-import-mode" value="full" ${this._data.importMode === 'full' ? 'checked' : ''}>
            <span><strong style="display:block;font-size:.75rem;color:#1e3a8a;">Full Migration</strong><small style="font-size:.68rem;color:#475569;">Imports supported history and preserves source rows for audit.</small></span>
          </label>
          <label style="padding:.7rem;border:1px solid ${this._data.importMode === 'cutover' ? '#2563eb' : '#cbd5e1'};border-radius:8px;background:#fff;display:flex;gap:.5rem;align-items:flex-start;">
            <input type="radio" name="wizard-import-mode" value="cutover" ${this._data.importMode === 'cutover' ? 'checked' : ''}>
            <span><strong style="display:block;font-size:.75rem;color:#1e3a8a;">Opening-Balance Cutover</strong><small style="font-size:.68rem;color:#475569;">Use member/account balances and GL opening balances; keep detailed history in the old system.</small></span>
          </label>
        </div>
        <div style="font-size:.73rem;color:#475569;margin-bottom:.45rem;">Full Migration workbook sheets: Organization, Branches, Chart of Accounts, GL Opening Balances, Members, Deposit Accounts, Loans, Loan Schedules, Loan Repayments, Transactions, Audit History, Bank Accounts, External Facilities, Investments, Operating Expenses, Teller Tills, and Collateral.</div>
        <div style="font-size:.68rem;color:#64748b;margin-bottom:.65rem;">Members, deposit summaries, loans, transactions, GL, branches, and chart of accounts are mapped to live data. Schedules, repayment details, audit history, collateral, tills, bank accounts, facilities, investments, and expenses are preserved in the organization migration archive for reconciliation; they are not yet wired into every live module.</div>
        <div style="display:flex;gap:.65rem;align-items:end;flex-wrap:wrap;">
          <label style="font-size:.7rem;font-weight:700;color:#475569;">CSV data type
            <select id="wizard-csv-type" class="form-control" style="min-width:180px;margin-top:.25rem;">
              <option value="branches">Branches</option><option value="organization">Organization profile</option><option value="chartOfAccounts">Chart of accounts</option><option value="openingBalances">GL opening balances</option><option value="members">Members</option><option value="depositAccounts">Deposit accounts</option><option value="loans">Loans</option><option value="loanSchedules">Loan schedules</option><option value="loanRepayments">Loan repayments</option><option value="transactions">Transactions</option><option value="auditHistory">Audit history</option><option value="bankAccounts">Bank accounts</option><option value="externalFacilities">External facilities</option><option value="investments">Investments</option><option value="operatingExpenses">Operating expenses</option><option value="tellerTills">Teller tills</option><option value="collateral">Collateral</option>
            </select>
          </label>
          <label style="font-size:.7rem;font-weight:700;color:#475569;">Workbook or CSV
            <input id="wizard-import-file" type="file" class="form-control" accept=".xlsx,.xls,.csv" style="max-width:320px;margin-top:.25rem;">
          </label>
          <button id="wizard-download-template" type="button" class="btn btn-secondary btn-sm">Download workbook template</button>
        </div>
        ${this._buildImportSummary()}
      </div>
      `}
    `;
  },

  _buildImportSummary() {
    const data = this._data.importData || {};
    const counts = [
      ['Branches', data.branches?.length || 0], ['Members', data.members?.length || 0],
      ['Loans', data.loans?.length || 0], ['Transactions', data.transactions?.length || 0],
      ['GL accounts', data.glAccounts?.length || 0], ['Opening balances', data.openingBalances?.length || 0],
      [this._data.importMode === 'full' ? 'Source rows to archive' : 'Cutover source rows', data.migrationRecords?.length || 0]
    ].filter(([, count]) => count > 0);
    if (!counts.length && !data.errors?.length && !Object.keys(data.organization || {}).length) return '';
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const controls = SetupImport.getMigrationControls(data, this._data.glAccounts);
    const glStatus = controls.openingGlUnknownCodes.length
      ? `Unknown GL codes: ${escapeHtml(controls.openingGlUnknownCodes.join(', '))}`
      : `GL debit ${controls.openingGlDebits.toLocaleString()} · credit ${controls.openingGlCredits.toLocaleString()} · variance ${controls.openingGlVariance.toLocaleString()}`;
    return `<div style="margin-top:.7rem;font-size:.72rem;color:#334155;">${counts.map(([label, count]) => `${label}: <strong>${count}</strong>`).join(' · ')}${Object.keys(data.organization || {}).length ? ' · Organization profile imported' : ''}</div>${data.migrationRecords?.length ? `<div style="margin-top:.45rem;padding:.55rem .7rem;background:#fff;border:1px solid #cbd5e1;border-radius:6px;font-size:.68rem;color:#334155;">Reconciliation controls · deposit balances ${controls.depositAccountBalances.toLocaleString()} · loan outstanding ${controls.loanOutstandingBalances.toLocaleString()} · transaction amount ${controls.transactionAmount.toLocaleString()} · ${glStatus}</div>` : ''}${data.errors?.length ? `<ul style="margin:.4rem 0 0;padding-left:1.2rem;color:#b91c1c;font-size:.7rem;">${data.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : ''}`;
  },

  // Step 3: Chart of Accounts
  _buildStep3() {
    const rows = this._data.glAccounts.map((g, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:.4rem .6rem;"><input class="form-control form-control-sm" style="font-size:.72rem;font-family:monospace;width:65px;" data-glfield="code" data-idx="${i}" value="${g.code}"></td>
        <td style="padding:.4rem .6rem;"><input class="form-control form-control-sm" style="font-size:.72rem;min-width:180px;" data-glfield="name" data-idx="${i}" value="${g.name}"></td>
        <td style="padding:.4rem .6rem;">
          <select class="form-control form-control-sm" style="font-size:.72rem;" data-glfield="category" data-idx="${i}">
            ${['Asset','Liability','Equity','Income','Expense'].map(c=>`<option ${g.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </td>
        <td style="padding:.4rem .6rem;">
          <select class="form-control form-control-sm" style="font-size:.72rem;" data-glfield="normal" data-idx="${i}">
            <option ${g.normal==='Debit'?'selected':''}>Debit</option>
            <option ${g.normal==='Credit'?'selected':''}>Credit</option>
          </select>
        </td>
        <td style="padding:.4rem .6rem;text-align:center;">
          <input type="checkbox" data-glfield="isContra" data-idx="${i}" ${g.isContra?'checked':''}>
        </td>
        <td style="padding:.4rem .6rem;">
          <button style="background:rgba(239,68,68,.08);color:#dc2626;border:none;padding:2px 7px;border-radius:5px;cursor:pointer;font-size:.72rem;" data-remove-gl="${i}">✕</button>
        </td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;">
        <p style="margin:0;font-size:.82rem;color:#475569;">Standard SACCO Chart of Accounts (pre-loaded). Add or remove accounts as needed.</p>
        <button id="btn-add-gl" style="padding:.4rem 1rem;border-radius:8px;border:2px solid #10b981;background:#f0fdf4;color:#059669;font-weight:700;font-size:.75rem;cursor:pointer;">+ Add GL Account</button>
      </div>
      <div style="overflow-x:auto;max-height:380px;overflow-y:auto;border-radius:10px;border:1px solid #e2e8f0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="position:sticky;top:0;background:#f8fafc;z-index:1;">
            <tr>
              <th style="padding:.5rem .6rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Code</th>
              <th style="padding:.5rem .6rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Account Name</th>
              <th style="padding:.5rem .6rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Category</th>
              <th style="padding:.5rem .6rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Normal</th>
              <th style="padding:.5rem .6rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Contra</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="gl-tbody">${rows}</tbody>
        </table>
      </div>
    `;
  },

  // Step 4: Staff Users
  _buildStep4() {
    const branchOptions = (user) => this._data.branches.map(b =>
      `<option value="${b.id}" ${user.branchId === b.id ? 'selected' : ''}>${b.name}</option>`
    ).join('');
    const roleOptions = (user) => this._data.roles.map(r =>
      `<option value="${r.id}" ${(user.roles || []).includes(r.id) || user.roleId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('');

    const rows = this._data.staffUsers.map((u, i) => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:.4rem .5rem;"><input class="form-control form-control-sm" style="font-size:.72rem;" data-usrfield="name" data-idx="${i}" value="${u.name}"></td>
        <td style="padding:.4rem .5rem;"><input type="email" class="form-control form-control-sm" style="font-size:.72rem;" data-usrfield="email" data-idx="${i}" value="${u.email}"></td>
        <td style="padding:.4rem .5rem;">
          <select class="form-control form-control-sm" style="font-size:.72rem;" data-usrfield="roleId" data-idx="${i}">
            ${roleOptions(u)}
          </select>
        </td>
        <td style="padding:.4rem .5rem;">
          <select class="form-control form-control-sm" style="font-size:.72rem;" data-usrfield="branchId" data-idx="${i}">
            ${branchOptions(u)}
          </select>
        </td>
        <td style="padding:.4rem .5rem;">
          <button style="background:rgba(239,68,68,.08);color:#dc2626;border:none;padding:2px 7px;border-radius:5px;cursor:pointer;font-size:.72rem;" data-remove-user="${i}">✕</button>
        </td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom:.75rem;display:flex;align-items:center;justify-content:space-between;">
        <p style="margin:0;font-size:.82rem;color:#475569;">The organisation owner and each staff member will receive a one-time email code, then set a personal password.</p>
        <button id="btn-add-user" style="padding:.4rem 1rem;border-radius:8px;border:2px solid #10b981;background:#f0fdf4;color:#059669;font-weight:700;font-size:.75rem;cursor:pointer;">+ Add Staff User</button>
      </div>
      ${this._data.staffUsers.length === 0 ? `
        <div style="text-align:center;padding:2rem;border:2px dashed #e2e8f0;border-radius:12px;color:#94a3b8;font-size:.82rem;">
          <div style="font-size:2rem;margin-bottom:.5rem;">👥</div>
          Click "+ Add Staff User" to add the first staff member.<br>
          <span style="font-size:.72rem;">You can also add users later via User Management.</span>
        </div>
      ` : `
        <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;">
          <table style="width:100%;border-collapse:collapse;">
            <thead style="background:#f8fafc;">
              <tr>
                <th style="padding:.5rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Name</th>
                <th style="padding:.5rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Email</th>
                <th style="padding:.5rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Role</th>
                <th style="padding:.5rem;text-align:left;font-size:.64rem;color:#64748b;font-weight:800;text-transform:uppercase;">Branch</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `}
    `;
  },

  // Step 5: Review & Provision
  _buildStep5() {
    const o = this._data.org;
    const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const pill = (label, val, color='#059669') =>
      `<div style="display:flex;flex-direction:column;gap:2px;padding:.6rem .9rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <span style="font-size:.6rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">${label}</span>
        <span style="font-size:.82rem;font-weight:700;color:${color};">${val}</span>
      </div>`;

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div style="background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #a7f3d0;border-radius:14px;padding:1.2rem 1.4rem;">
          <h3 style="margin:0 0 .8rem;font-size:1rem;color:#064e3b;font-weight:800;">🏦 ${o.name || '(no name)'}</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem;">
            ${pill('Type', o.type || '—')}
            ${pill('Country', o.country || '—')}
            ${pill('Currency', o.baseCurrency || '—')}
            ${pill('Regulatory Body', o.regulatoryBody || '—')}
            ${pill('Min Liquidity', (o.minLiquidityRatio || '15') + '%')}
            ${pill('Financial Year', o.financialYear || '—')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;">
          <div style="text-align:center;padding:1rem;background:#f0f9ff;border-radius:12px;border:1px solid #bae6fd;">
            <div style="font-size:1.8rem;font-weight:800;color:#0369a1;">${this._data.branches.length}</div>
            <div style="font-size:.72rem;color:#0369a1;font-weight:700;">Branches</div>
          </div>
          <div style="text-align:center;padding:1rem;background:#f0fdf4;border-radius:12px;border:1px solid #a7f3d0;">
            <div style="font-size:1.8rem;font-weight:800;color:#059669;">${this._data.glAccounts.length}</div>
            <div style="font-size:.72rem;color:#059669;font-weight:700;">GL Accounts</div>
          </div>
          <div style="text-align:center;padding:1rem;background:#fdf4ff;border-radius:12px;border:1px solid #e9d5ff;">
            <div style="font-size:1.8rem;font-weight:800;color:#7c3aed;">${this._data.staffUsers.length}</div>
            <div style="font-size:.72rem;color:#7c3aed;font-weight:700;">Staff Users</div>
          </div>
        </div>

        <div style="padding:.8rem 1rem;border:1px solid ${this._data.setupPlan === 'later' ? '#fbbf24' : '#a7f3d0'};background:${this._data.setupPlan === 'later' ? '#fffbeb' : '#f0fdf4'};border-radius:10px;font-size:.78rem;color:${this._data.setupPlan === 'later' ? '#92400e' : '#065f46'};">
          ${this._data.setupPlan === 'later'
            ? '<b>Organization setup will be marked incomplete.</b> A Head Office baseline will be created; the organization administrator can add branches, update profile details, and import data after sign-in.'
            : `<b>${this._data.importMode === 'full' ? 'Full Migration' : 'Opening-Balance Cutover'}:</b> ${this._data.importData.branches.length} imported branches · ${this._data.importData.members.length} members · ${this._data.importData.loans.length} loans · ${this._data.importData.transactions.length} transactions · ${this._data.importData.openingBalances.length} opening balances · ${this._data.importMode === 'full' ? this._data.importData.migrationRecords.length + ' source rows archived' : 'legacy source rows not archived'}.`}
        </div>
        ${this._data.importData.errors.length ? `<div style="padding:.7rem .85rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;font-size:.72rem;">${this._data.importData.errors.map(error => `<div>${escapeHtml(error)}</div>`).join('')}</div>` : ''}

        ${this._provisionedSchema ? `
          <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:12px;padding:1rem;font-size:.82rem;color:#065f46;">
            <b>Organisation provisioned successfully.</b> PostgreSQL created and seeded <code>${escapeHtml(this._provisionedSchema)}</code> directly.
            ${this._invitationResults.map(invitation => {
              const statusLabel = invitation.status === 'otp_sent' ? 'Email code sent' : invitation.status === 'existing_account_linked' ? 'Existing account linked' : 'Setup needs attention';
              const color = invitation.status === 'otp_sent' || invitation.status === 'existing_account_linked' ? '#065f46' : '#b91c1c';
              return `<div style="margin-top:.4rem;color:${color};">${statusLabel}: ${escapeHtml(invitation.email)}${invitation.message ? ` (${escapeHtml(invitation.message)})` : ''}</div>`;
            }).join('')}
          </div>
        ` : `
          <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:12px;padding:1rem;font-size:.82rem;color:#92400e;">
            <b>⚠️ Ready to provision.</b> Clicking "Provision Organisation" will:<br>
            • Create a dedicated PostgreSQL schema directly in Supabase<br>
            • Seed the owner, roles, branches, chart of accounts, and staff in one database transaction<br>
            • Email setup codes to the owner and staff; require a personal password after verification<br>
            • Activate this organisation for login
          </div>
        `}

        <div id="wizard-error" style="display:none;background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.3);border-radius:10px;padding:.8rem 1rem;font-size:.8rem;color:#dc2626;font-weight:600;"></div>
      </div>
    `;
  },

  // ─── Event Binding ───────────────────────────────────────────────────────
  _bindEvents(overlay) {
    // Close
    const closeBtn = overlay.querySelector('#wizard-close');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());

    // Next
    const nextBtn = overlay.querySelector('#wizard-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this._onNext(overlay));

    // Back
    const backBtn = overlay.querySelector('#wizard-back');
    if (backBtn) backBtn.addEventListener('click', () => { this._step--; this._render(); });

    overlay.querySelectorAll('[data-wizard-step]:not(:disabled)').forEach(button => {
      button.addEventListener('click', () => {
        this._step = Number(button.dataset.wizardStep);
        this._render();
      });
    });

    // Provision
    const provBtn = overlay.querySelector('#wizard-provision');
    if (provBtn) provBtn.addEventListener('click', () => this._onProvision(overlay));

    overlay.querySelectorAll('[name="wizard-setup-plan"]').forEach(input => {
      input.addEventListener('change', event => {
        const plan = event.currentTarget.value;
        if (plan === 'later') {
          const hasImportedData = Object.values(this._data.importData || {}).some(value => Array.isArray(value) && value.length > 0);
          if (hasImportedData && !confirm('Switch to Finish Later? Imported rows will be removed from this setup draft.')) {
            event.currentTarget.checked = false;
            overlay.querySelector('[name="wizard-setup-plan"][value="now"]').checked = true;
            return;
          }
          this._data.importData = { organization: {}, branches: [], members: [], loans: [], transactions: [], glAccounts: [], openingBalances: [], migrationRecords: [], sourceFiles: [], errors: [], sheets: [] };
          this._data.branches = [{ id: 'br-01', name: 'Head Office', code: 'HQ', tellerCount: 0, vaultLimit: 0, tellerCashLimit: 0 }];
        } else if (this._data.setupPlan === 'later') {
          this._data.branches = [{ id: 'br-01', name: 'Head Office', code: 'HQ', tellerCount: 2, vaultLimit: 50000000, tellerCashLimit: 2000000 }];
        }
        this._data.setupPlan = plan;
        this._render();
      });
    });

    const importInput = overlay.querySelector('#wizard-import-file');
    const templateButton = overlay.querySelector('#wizard-download-template');
    if (templateButton) templateButton.addEventListener('click', () => SetupImport.downloadTemplate());
    overlay.querySelectorAll('[name="wizard-import-mode"]').forEach(input => {
      input.addEventListener('change', event => {
        this._data.importMode = event.currentTarget.value;
        this._render();
      });
    });
    if (importInput) {
      importInput.addEventListener('change', async event => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        try {
          const csvType = overlay.querySelector('#wizard-csv-type')?.value || 'branches';
          const incoming = await SetupImport.parseFile(file, csvType);
          this._data.setupPlan = 'now';
          if (incoming.sheets.includes('chartOfAccounts')) this._data.glAccounts = [];
          if (this._data.importMode === 'cutover') {
            const fullOnlyTypes = incoming.migrationRecords.filter(record => !['branches', 'members', 'loans', 'transactions', 'chartOfAccounts', 'openingBalances'].includes(record.recordType));
            if (fullOnlyTypes.length) throw new Error('This workbook contains full-migration sheets. Select Full Migration to import them.');
          }
          if (incoming.organization && Object.keys(incoming.organization).length) {
            this._data.org = { ...this._data.org, ...incoming.organization };
          }
          if (!this._data.importData.branches.length && incoming.branches.length) this._data.branches = [];
          SetupImport.merge(this._data.importData, incoming);
          this._data.branches.push(...incoming.branches);
          if (incoming.glAccounts.length) this._data.glAccounts.push(...incoming.glAccounts);
          this._render();
          if (App && App.showToast) App.showToast(`Imported ${file.name}. Review the detected row counts before provisioning.`, 'success');
        } catch (error) {
          if (App && App.showToast) App.showToast(`Import failed: ${error.message}`, 'danger');
        } finally {
          input.value = '';
        }
      });
    }

    // Step 2: branch table edits
    const branchesTbody = overlay.querySelector('#branches-tbody');
    if (branchesTbody) {
      branchesTbody.addEventListener('input', e => {
        const el = e.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.field;
        if (field !== undefined && !isNaN(idx)) {
          this._data.branches[idx][field] = el.type === 'number' ? parseFloat(el.value) : el.value;
        }
      });
      branchesTbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-branch]');
        if (btn) {
          this._data.branches.splice(parseInt(btn.dataset.removeBranch), 1);
          this._render();
        }
      });
    }

    const addBranchBtn = overlay.querySelector('#btn-add-branch');
    if (addBranchBtn) {
      addBranchBtn.addEventListener('click', () => {
        const idx = this._data.branches.length + 1;
        this._data.branches.push({ id: 'br-0' + idx, name: 'New Branch', code: 'BR' + idx, tellerCount: 1, vaultLimit: 10000000, tellerCashLimit: 1000000 });
        this._render();
      });
    }

    // Step 3: GL table edits
    const glTbody = overlay.querySelector('#gl-tbody');
    if (glTbody) {
      glTbody.addEventListener('change', e => {
        const el = e.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.glfield;
        if (field !== undefined && !isNaN(idx)) {
          this._data.glAccounts[idx][field] = el.type === 'checkbox' ? el.checked : el.value;
        }
      });
      glTbody.addEventListener('input', e => {
        const el = e.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.glfield;
        if (field !== undefined && !isNaN(idx) && el.type !== 'checkbox') {
          this._data.glAccounts[idx][field] = el.value;
        }
      });
      glTbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-gl]');
        if (btn) {
          this._data.glAccounts.splice(parseInt(btn.dataset.removeGl), 1);
          this._render();
        }
      });
    }

    const addGlBtn = overlay.querySelector('#btn-add-gl');
    if (addGlBtn) {
      addGlBtn.addEventListener('click', () => {
        this._data.glAccounts.push({ code: '9' + this._data.glAccounts.length, name: 'New Account', category: 'Asset', type: '', normal: 'Debit', isContra: false });
        this._render();
      });
    }

    // Step 4: user table edits
    const addUserBtn = overlay.querySelector('#btn-add-user');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => {
        const idx = this._data.staffUsers.length + 1;
        const firstBranch = this._data.branches[0] || {};
        this._data.staffUsers.push({
          id: 'USR-' + String(idx).padStart(3, '0'),
          name: 'Staff Member ' + idx,
          email: 'staff' + idx + '@' + (this._data.org.id || 'org') + '.com',
          roles: [this._data.roles[2] ? this._data.roles[2].id : 'ROLE-TELLER'],
          roleId: this._data.roles[2] ? this._data.roles[2].id : 'ROLE-TELLER',
          branchId: firstBranch.id || 'br-01',
          branchName: firstBranch.name || 'Head Office',
          singleApprovalLimit: 5000000,
          dailyApprovalLimit: 25000000
        });
        this._render();
      });
    }

    // User table tbody
    const usrContainer = overlay.querySelector('tbody:not(#branches-tbody):not(#gl-tbody)');
    if (usrContainer) {
      usrContainer.addEventListener('input', e => {
        const el = e.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.usrfield;
        if (field !== undefined && !isNaN(idx)) this._data.staffUsers[idx][field] = el.value;
      });
      usrContainer.addEventListener('change', e => {
        const el = e.target;
        const idx = parseInt(el.dataset.idx);
        const field = el.dataset.usrfield;
        if (field !== undefined && !isNaN(idx)) {
          this._data.staffUsers[idx][field] = el.value;
          if (field === 'branchId') {
            const branch = this._data.branches.find(b => b.id === el.value);
            if (branch) this._data.staffUsers[idx].branchName = branch.name;
          }
          if (field === 'roleId') {
            this._data.staffUsers[idx].roles = [el.value];
          }
        }
      });
      usrContainer.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-user]');
        if (btn) {
          this._data.staffUsers.splice(parseInt(btn.dataset.removeUser), 1);
          this._render();
        }
      });
    }

  },

  // ─── Navigation ─────────────────────────────────────────────────────────
  _onNext(overlay) {
    // Collect current step data before moving
    if (this._step === 1) {
      if (!this._collectStep1(overlay)) return;
    }
    this._step++;
    this._render();
  },

  _collectStep1(overlay) {
    const get = id => (overlay.querySelector('#' + id) || {}).value;
    const o = {
      id:              get('wiz-org-id').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name:            get('wiz-org-name').trim(),
      type:            get('wiz-org-type'),
      regNumber:       get('wiz-reg-number').trim(),
      country:         get('wiz-country'),
      baseCurrency:    get('wiz-currency'),
      regulatoryBody:  get('wiz-regulatory-body'),
      financialYear:   get('wiz-financial-year'),
      minLiquidityRatio: parseFloat(get('wiz-min-liquidity')) || 15,
      ownerName:       get('wiz-owner-name').trim(),
      superuserEmail:  get('wiz-superuser-email').trim()
    };

    if (!o.id || !o.name || !o.ownerName || !o.superuserEmail) {
      if (App && App.showToast) App.showToast('Org ID, Legal Name, Owner Name, and Owner Email are required.', 'danger');
      return false;
    }
    this._data.org = o;
    return true;
  },

  async _onProvision(overlay) {
    if (this._loading) return;
    const errEl = overlay.querySelector('#wizard-error');

    if (this._data.importData.errors.length) {
      if (errEl) {
        errEl.textContent = 'Fix the import errors shown in the setup step before provisioning.';
        errEl.style.display = 'block';
      }
      return;
    }

    const importData = JSON.parse(JSON.stringify(this._data.importData));
    const migrationControls = SetupImport.getMigrationControls(importData, this._data.glAccounts);
    if (importData.openingBalances.length && (migrationControls.openingGlUnknownCodes.length || Math.abs(migrationControls.openingGlVariance) > 0.01)) {
      if (errEl) {
        errEl.textContent = migrationControls.openingGlUnknownCodes.length
          ? `Opening balances reference unknown GL codes: ${migrationControls.openingGlUnknownCodes.join(', ')}.`
          : `Opening GL trial balance does not balance (debits ${migrationControls.openingGlDebits}, credits ${migrationControls.openingGlCredits}, variance ${migrationControls.openingGlVariance}).`;
        errEl.style.display = 'block';
      }
      return;
    }
    if (this._data.importMode === 'full') SetupImport.attachFullMigration(importData);
    else SetupImport.attachLoans(importData);
    if (importData.errors.length) {
      if (errEl) {
        errEl.textContent = importData.errors.join(' ');
        errEl.style.display = 'block';
      }
      return;
    }

    const branches = this._data.setupPlan === 'later'
      ? [{ id: 'br-01', name: 'Head Office', code: 'HQ', tellerCount: 0, vaultLimit: 0, tellerCashLimit: 0 }]
      : this._data.branches;
    SetupImport.validateOrganizationLinks(importData, branches);
    if (importData.errors.length) {
      if (errEl) {
        errEl.textContent = importData.errors.join(' ');
        errEl.style.display = 'block';
      }
      return;
    }
    const branchById = new Map(branches.map(branch => [branch.id, branch]));
    const branchByName = new Map(branches.map(branch => [String(branch.name).toLowerCase(), branch]));
    const branchByCode = new Map(branches.map(branch => [String(branch.code).toLowerCase(), branch]));
    for (const member of importData.members) {
      const branch = branchById.get(member.branchId) || branchByCode.get(String(member.branchId).toLowerCase()) || branchByName.get(member.branchName.toLowerCase());
      if (member.branchId && !branch) {
        if (errEl) {
          errEl.textContent = `Member ${member.id} references branch ${member.branchId}, which is not in the setup data.`;
          errEl.style.display = 'block';
        }
        return;
      }
      member.branchId = branch?.id || branches[0].id;
      member.branchName = member.branchName || branch?.name || branches[0].name;
    }

    const emailOwners = new Map();
    const invitationTargets = [
      { email: this._data.org.superuserEmail, label: 'Organisation owner' },
      ...this._data.staffUsers.map((user, index) => ({
        email: user.email,
        label: `Staff row ${index + 1}`
      }))
    ];
    for (const target of invitationTargets) {
      const normalizedEmail = String(target.email || '').trim().toLowerCase();
      const existingLabel = emailOwners.get(normalizedEmail);
      if (existingLabel) {
        if (errEl) {
          errEl.textContent = `${normalizedEmail} is entered for both ${existingLabel} and ${target.label}. The owner already receives an administrator account and invitation. Remove the duplicate staff row or use a different staff email.`;
          errEl.style.display = 'block';
        }
        return;
      }
      emailOwners.set(normalizedEmail, target.label);
    }

    // Resolve user IDs for staff (ensure roles array is set)
    this._data.staffUsers.forEach(u => {
      if (!u.roles || u.roles.length === 0) u.roles = [u.roleId || 'ROLE-TELLER'];
    });

    this._loading = true;
    const btn = overlay.querySelector('#wizard-provision');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Provisioning...'; }
    if (errEl) errEl.style.display = 'none';

    try {
      const result = await Platform.provisionOrg({
        ...this._data.org,
        setupCompleted: this._data.setupPlan === 'now',
        branches,
        roles: this._data.roles,
        staffUsers: this._data.staffUsers,
        members: importData.members,
        transactions: importData.transactions,
        glAccounts: importData.glAccounts.length ? importData.glAccounts : this._data.glAccounts,
        openingBalances: importData.openingBalances,
        migrationBatchId: importData.migrationRecords.length ? crypto.randomUUID() : null,
        migrationSourceFiles: importData.sourceFiles,
        migrationRowCounts: SetupImport.getMigrationControls(importData).countByType,
        migrationControlTotals: migrationControls,
        migrationRecords: this._data.importMode === 'full' ? importData.migrationRecords : []
      });

      this._provisionedSchema = result.schemaName;
      this._invitationResults = result.invitations;
      if (window.SupabaseSync && typeof SupabaseSync.init === 'function') {
        await SupabaseSync.init(store);
      }
      if (App && App.showToast) App.showToast('Organisation "' + this._data.org.name + '" provisioned successfully!', 'success');
      // Re-render step 5 to show the success state + SQL preview
      this._render();

    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Provisioning failed: ' + e.message;
        errEl.style.display = 'block';
      }
      console.error('[SetupWizard] Provision error:', e);
    } finally {
      this._loading = false;
    }
  }
};

window.SetupWizardView = SetupWizardView;
