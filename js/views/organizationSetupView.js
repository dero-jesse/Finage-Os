const OrganizationSetupView = {
  _container: null,
  _organization: {},
  _branches: [],
  _importData: null,
  _importMode: 'full',
  _manualEntryMode: 'branch',
  _saving: false,

  _emptyImport() {
    return { organization: {}, branches: [], members: [], loans: [], transactions: [], glAccounts: [], openingBalances: [], migrationRecords: [], sourceFiles: [], errors: [], sheets: [] };
  },

  renderModal(container) {
    this._container = container;
    if (!container.querySelector('#org-setup-modal')) {
      container.innerHTML = '<div id="org-setup-modal"></div>';
    }
  },

  open() {
    const currentUser = store.getCurrentUser();
    const roles = currentUser ? UserManagementEngine.getUserRoles(store.state, currentUser.id) : [];
    const canManage = roles.some(role => role.permissions.includes('MANAGE_USERS'));
    if (!canManage) {
      App.showToast('Organization administrator permission is required to edit setup.', 'danger');
      return;
    }
    if (!window.Platform?.getActiveOrg() || !window.Platform?.context?.currentOrgSchema) {
      App.showToast('Select an organization before editing its setup.', 'warning');
      return;
    }
    this._organization = { ...Platform.getActiveOrg() };
    this._branches = (store.state.branches || []).map(branch => ({ ...branch }));
    this._importData = this._emptyImport();
    this._importMode = 'full';
    this._saving = false;
    this._render();
  },

  _escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  },

  _manualEntryFormMarkup() {
    const mode = this._manualEntryMode || 'branch';
    const fieldMap = {
      branch: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem;">
          <label class="form-label">Branch name<input name="branchName" class="form-control" required></label>
          <label class="form-label">Branch code<input name="branchCode" class="form-control" required></label>
          <label class="form-label">Teller count<input name="branchTellers" type="number" min="0" value="0" class="form-control"></label>
          <label class="form-label">Vault limit<input name="branchVaultLimit" type="number" min="0" value="0" class="form-control"></label>
          <label class="form-label">Teller cash limit<input name="branchTellerCashLimit" type="number" min="0" value="0" class="form-control"></label>
        </div>
      `,
      member: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem;">
          <label class="form-label">Full name<input name="memberName" class="form-control" required></label>
          <label class="form-label">National ID<input name="memberNationalId" class="form-control" required></label>
          <label class="form-label">Phone<input name="memberPhone" class="form-control" required></label>
          <label class="form-label">Email<input name="memberEmail" type="email" class="form-control"></label>
          <label class="form-label">Branch name<input name="memberBranchName" class="form-control" value="${this._escape(this._branches[0]?.name || 'Head Office')}"></label>
          <label class="form-label">Savings balance<input name="memberSavingsBalance" type="number" min="0" value="0" class="form-control"></label>
          <label class="form-label">Share capital<input name="memberShareCapital" type="number" min="0" value="0" class="form-control"></label>
          <label class="form-label">Fixed deposit balance<input name="memberFixedDeposit" type="number" min="0" value="0" class="form-control"></label>
        </div>
      `,
      gl: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem;">
          <label class="form-label">GL code<input name="glCode" class="form-control" required></label>
          <label class="form-label">Account name<input name="glName" class="form-control" required></label>
          <label class="form-label">Category<input name="glCategory" class="form-control" required></label>
          <label class="form-label">Normal balance<select name="glNormal" class="form-control"><option value="Debit">Debit</option><option value="Credit">Credit</option></select></label>
          <label class="form-label">Account type<input name="glType" class="form-control" value="Operating"></label>
        </div>
      `,
      openingBalance: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem;">
          <label class="form-label">GL code<input name="openingCode" class="form-control" required></label>
          <label class="form-label">Opening balance<input name="openingBalance" type="number" step="0.01" class="form-control" required></label>
        </div>
      `
    };
    return fieldMap[mode] || fieldMap.branch;
  },

  _render() {
    if (!this._container) return;
    const organization = this._organization;
    const branches = this._branches;
    const importData = this._importData;
    const branchRows = branches.map(branch => `
      <tr>
        <td><input class="form-control" data-branch-id="${this._escape(branch.id)}" data-branch-field="name" value="${this._escape(branch.name)}"></td>
        <td><input class="form-control" data-branch-id="${this._escape(branch.id)}" data-branch-field="code" value="${this._escape(branch.code)}"></td>
        <td><input type="number" class="form-control" data-branch-id="${this._escape(branch.id)}" data-branch-field="tellerCount" value="${Number(branch.tellerCount) || 0}"></td>
        <td><input type="number" class="form-control" data-branch-id="${this._escape(branch.id)}" data-branch-field="vaultLimit" value="${Number(branch.vaultLimit) || 0}"></td>
        <td><input type="number" class="form-control" data-branch-id="${this._escape(branch.id)}" data-branch-field="tellerCashLimit" value="${Number(branch.tellerCashLimit) || 0}"></td>
      </tr>
    `).join('');
    const importCounts = [
      ['Members', importData.members.length], ['Loans', importData.loans.length],
      ['Transactions', importData.transactions.length], ['GL accounts', importData.glAccounts.length],
      ['Opening balances', importData.openingBalances.length], [this._importMode === 'full' ? 'Source rows to archive' : 'Cutover source rows', importData.migrationRecords.length]
    ].filter(([, count]) => count);
    const migrationControls = SetupImport.getMigrationControls(importData, store.state.generalLedger || []);

    this._container.innerHTML = `
      <div class="modal-backdrop active" id="org-setup-modal">
        <div class="modal-container" style="max-width:980px;max-height:92vh;overflow:auto;">
          <div class="modal-header">
            <div><div class="modal-title">Organization Setup</div><span style="font-size:.75rem;color:var(--text-dim);">${this._escape(organization.name)} · ${organization.setup_completed === false ? 'Setup incomplete' : 'Manage organization details'}</span></div>
            <button type="button" class="modal-close" id="org-setup-close" aria-label="Close">✕ Close</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:1.15rem;">
            <section>
              <h3 style="font-size:.92rem;margin:0 0 .7rem;">Organization profile</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.75rem;">
                <label class="form-label">Legal name<input class="form-control" data-org-field="name" value="${this._escape(organization.name)}"></label>
                <label class="form-label">Registration number<input class="form-control" data-org-field="reg_number" value="${this._escape(organization.reg_number)}"></label>
                <label class="form-label">Country<input class="form-control" data-org-field="country" value="${this._escape(organization.country)}"></label>
                <label class="form-label">Base currency<input class="form-control" data-org-field="base_currency" value="${this._escape(organization.base_currency)}"></label>
                <label class="form-label">Financial year<input class="form-control" data-org-field="financial_year" value="${this._escape(organization.financial_year)}"></label>
                <label class="form-label">Regulatory body<input class="form-control" data-org-field="regulatory_body" value="${this._escape(organization.regulatory_body)}"></label>
                <label class="form-label">Minimum liquidity ratio (%)<input type="number" class="form-control" data-org-field="min_liquidity_ratio" value="${Number(organization.min_liquidity_ratio) || 15}"></label>
              </div>
            </section>
            <section>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:.8rem;margin-bottom:.65rem;">
                <div><h3 style="font-size:.92rem;margin:0;">Branches</h3><div style="font-size:.72rem;color:var(--text-dim);">Add service points or edit existing limits.</div></div>
                <button id="org-setup-add-branch" class="btn btn-secondary btn-sm" type="button">+ Add Branch</button>
              </div>
              <div style="overflow:auto;">
                <table class="data-table"><thead><tr><th>Name</th><th>Code</th><th>Tellers</th><th>Vault limit</th><th>Teller cash limit</th></tr></thead><tbody>${branchRows}</tbody></table>
              </div>
            </section>
            <section style="padding:1rem;border:1px solid var(--border-subtle);border-radius:8px;">
              <h3 style="font-size:.92rem;margin:0 0 .55rem;">Direct data entry</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin-bottom:.75rem;">
                <button type="button" class="btn btn-secondary btn-sm" data-manual-entry-mode="branch" ${this._manualEntryMode === 'branch' ? 'style="background:#0f766e;color:white;"' : ''}>+ Add Branch</button>
                <button type="button" class="btn btn-secondary btn-sm" data-manual-entry-mode="member" ${this._manualEntryMode === 'member' ? 'style="background:#0f766e;color:white;"' : ''}>+ Add Member</button>
                <button type="button" class="btn btn-secondary btn-sm" data-manual-entry-mode="gl" ${this._manualEntryMode === 'gl' ? 'style="background:#0f766e;color:white;"' : ''}>+ Add GL Account</button>
                <button type="button" class="btn btn-secondary btn-sm" data-manual-entry-mode="openingBalance" ${this._manualEntryMode === 'openingBalance' ? 'style="background:#0f766e;color:white;"' : ''}>+ Add Opening Balance</button>
              </div>
              <form id="org-setup-manual-entry-form" style="display:flex;flex-direction:column;gap:.8rem;">
                ${this._manualEntryFormMarkup()}
                <div style="display:flex;justify-content:flex-end;">
                  <button type="submit" class="btn btn-primary btn-sm">Add record</button>
                </div>
              </form>
              <div style="font-size:.72rem;color:var(--text-dim);margin-top:.75rem;">These manual entries are added directly to the migration draft, so users can onboard an organization without uploading CSV or XLS files.</div>
            </section>
            <section style="padding:1rem;border:1px solid var(--border-subtle);border-radius:8px;">
              <h3 style="font-size:.92rem;margin:0 0 .55rem;">Migration approach</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.75rem;">
                <label style="padding:.7rem;border:1px solid ${this._importMode === 'full' ? '#2563eb' : '#cbd5e1'};border-radius:8px;display:flex;gap:.5rem;align-items:flex-start;"><input type="radio" name="org-setup-migration-mode" value="full" ${this._importMode === 'full' ? 'checked' : ''}><span><strong style="display:block;font-size:.75rem;">Full Migration</strong><small style="font-size:.68rem;color:var(--text-dim);">Preserve supported history and source rows for audit.</small></span></label>
                <label style="padding:.7rem;border:1px solid ${this._importMode === 'cutover' ? '#2563eb' : '#cbd5e1'};border-radius:8px;display:flex;gap:.5rem;align-items:flex-start;"><input type="radio" name="org-setup-migration-mode" value="cutover" ${this._importMode === 'cutover' ? 'checked' : ''}><span><strong style="display:block;font-size:.75rem;">Opening-Balance Cutover</strong><small style="font-size:.68rem;color:var(--text-dim);">Bring balances forward; keep detailed history in the old system.</small></span></label>
              </div>
              <p style="font-size:.73rem;color:var(--text-dim);margin:0 0 .45rem;">Full Migration sheets: Organization, Branches, Chart of Accounts, GL Opening Balances, Members, Deposit Accounts, Loans, Loan Schedules, Loan Repayments, Transactions, Audit History, Bank Accounts, External Facilities, Investments, Operating Expenses, Teller Tills, and Collateral.</p>
              <p style="font-size:.68rem;color:var(--text-dim);margin:0 0 .75rem;">Members, deposit summaries, loans, transactions, GL, branches, and chart of accounts are mapped to live data. Schedules, repayment details, audit history, collateral, tills, bank accounts, facilities, investments, and expenses are preserved in the organization migration archive for reconciliation; they are not yet wired into every live module.</p>
              <div style="display:flex;gap:.75rem;align-items:end;flex-wrap:wrap;">
                <label class="form-label">CSV data type<select id="org-setup-csv-type" class="form-control"><option value="branches">Branches</option><option value="organization">Organization profile</option><option value="chartOfAccounts">Chart of accounts</option><option value="openingBalances">GL opening balances</option><option value="members">Members</option><option value="depositAccounts">Deposit accounts</option><option value="loans">Loans</option><option value="loanSchedules">Loan schedules</option><option value="loanRepayments">Loan repayments</option><option value="transactions">Transactions</option><option value="auditHistory">Audit history</option><option value="bankAccounts">Bank accounts</option><option value="externalFacilities">External facilities</option><option value="investments">Investments</option><option value="operatingExpenses">Operating expenses</option><option value="tellerTills">Teller tills</option><option value="collateral">Collateral</option></select></label>
                <label class="form-label">Workbook or CSV<input id="org-setup-file" type="file" class="form-control" accept=".xlsx,.xls,.csv"></label>
                <button id="org-setup-template" class="btn btn-secondary btn-sm" type="button">Download workbook template</button>
              </div>
              <div style="font-size:.73rem;color:var(--text-main);margin-top:.7rem;">${importCounts.map(([name, count]) => `${name}: ${count}`).join(' · ') || 'No migration rows imported yet.'}${importData.branches.length ? ` · Branch rows: ${importData.branches.length}` : ''}</div>
              ${importData.migrationRecords.length ? `<div style="font-size:.7rem;color:var(--text-dim);margin-top:.45rem;">Control totals · Deposit accounts ${migrationControls.depositAccountBalances.toLocaleString()} · Loan outstanding ${migrationControls.loanOutstandingBalances.toLocaleString()} · Transaction amount ${migrationControls.transactionAmount.toLocaleString()} · GL Dr ${migrationControls.openingGlDebits.toLocaleString()} · Cr ${migrationControls.openingGlCredits.toLocaleString()} · variance ${migrationControls.openingGlVariance.toLocaleString()}${migrationControls.openingGlUnknownCodes.length ? ` · unknown codes ${this._escape(migrationControls.openingGlUnknownCodes.join(', '))}` : ''}</div>` : ''}
              ${importData.errors.length ? `<ul style="color:var(--accent-rose);font-size:.72rem;margin:.45rem 0 0;padding-left:1.2rem;">${importData.errors.map(error => `<li>${this._escape(error)}</li>`).join('')}</ul>` : ''}
            </section>
            <div id="org-setup-error" role="alert" style="display:none;color:var(--accent-rose);font-size:.78rem;font-weight:700;"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:.65rem;padding:1rem 1.5rem;border-top:1px solid var(--border-subtle);">
            <button type="button" class="btn btn-secondary" id="org-setup-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="org-setup-save" ${this._saving ? 'disabled' : ''}>${this._saving ? 'Saving…' : 'Save Setup'}</button>
          </div>
        </div>
      </div>
    `;
    this._bindEvents();
  },

  _bindEvents() {
    const overlay = this._container.querySelector('#org-setup-modal');
    if (!overlay) return;
    overlay.querySelector('#org-setup-close').addEventListener('click', () => this.close());
    overlay.querySelector('#org-setup-cancel').addEventListener('click', () => this.close());

    overlay.querySelectorAll('[data-org-field]').forEach(input => {
      input.addEventListener('input', event => {
        this._organization[event.currentTarget.dataset.orgField] = event.currentTarget.type === 'number'
          ? Number(event.currentTarget.value)
          : event.currentTarget.value.trim();
      });
    });
    overlay.querySelectorAll('[data-branch-field]').forEach(input => {
      input.addEventListener('input', event => {
        const branch = this._branches.find(item => item.id === event.currentTarget.dataset.branchId);
        if (branch) branch[event.currentTarget.dataset.branchField] = event.currentTarget.type === 'number'
          ? Number(event.currentTarget.value)
          : event.currentTarget.value.trim();
      });
    });

    overlay.querySelector('#org-setup-add-branch').addEventListener('click', () => {
      const next = this._branches.length + 1;
      this._branches.push({ id: `br-${Date.now()}`, name: `Branch ${next}`, code: `BR${next}`, tellerCount: 0, vaultLimit: 0, tellerCashLimit: 0, status: 'Active' });
      this._render();
    });

    overlay.querySelectorAll('[name="org-setup-migration-mode"]').forEach(input => {
      input.addEventListener('change', event => {
        this._importMode = event.currentTarget.value;
        this._render();
      });
    });

    overlay.querySelectorAll('[data-manual-entry-mode]').forEach(button => {
      button.addEventListener('click', () => {
        this._manualEntryMode = button.dataset.manualEntryMode;
        this._render();
      });
    });

    const manualEntryForm = overlay.querySelector('#org-setup-manual-entry-form');
    if (manualEntryForm) {
      manualEntryForm.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(manualEntryForm);
        const values = Object.fromEntries(formData.entries());

        try {
          if (this._manualEntryMode === 'branch') {
            const name = String(values.branchName || '').trim();
            const code = String(values.branchCode || '').trim();
            if (!name || !code) throw new Error('Branch name and code are required.');
            const branch = {
              id: `br-${Date.now()}`,
              name,
              code,
              tellerCount: Number(values.branchTellers || 0),
              vaultLimit: Number(values.branchVaultLimit || 0),
              tellerCashLimit: Number(values.branchTellerCashLimit || 0),
              status: 'Active'
            };
            this._branches.push(branch);
            this._importData.branches.push(branch);
          } else if (this._manualEntryMode === 'member') {
            const name = String(values.memberName || '').trim();
            const nationalId = String(values.memberNationalId || '').trim();
            const phone = String(values.memberPhone || '').trim();
            if (!name || !nationalId || !phone) throw new Error('Member name, national ID, and phone are required.');
            const member = {
              id: `MEM-${Date.now()}`,
              name,
              nationalId,
              phone,
              email: String(values.memberEmail || '').trim(),
              branchName: String(values.memberBranchName || this._branches[0]?.name || 'Head Office'),
              branchId: this._branches.find(branch => branch.name === String(values.memberBranchName || this._branches[0]?.name || 'Head Office'))?.id || this._branches[0]?.id || null,
              kycStatus: 'Verified',
              relationshipScore: 0,
              savingsBalance: Number(values.memberSavingsBalance || 0),
              fixedDepositBalance: Number(values.memberFixedDeposit || 0),
              shareCapital: Number(values.memberShareCapital || 0),
              activeLoans: [],
              guarantorCommitments: []
            };
            this._importData.members.push(member);
          } else if (this._manualEntryMode === 'gl') {
            const code = String(values.glCode || '').trim();
            const name = String(values.glName || '').trim();
            const category = String(values.glCategory || '').trim();
            const normal = String(values.glNormal || 'Debit');
            if (!code || !name || !category) throw new Error('GL code, account name, and category are required.');
            this._importData.glAccounts.push({
              code,
              name,
              category,
              type: String(values.glType || category),
              normal,
              isContra: false
            });
          } else if (this._manualEntryMode === 'openingBalance') {
            const code = String(values.openingCode || '').trim();
            const balance = Number(values.openingBalance || 0);
            if (!code) throw new Error('GL code is required.');
            this._importData.openingBalances.push({ code, balance });
          }

          manualEntryForm.reset();
          this._render();
          App.showToast('Manual migration record added.', 'success');
        } catch (error) {
          const errorEl = overlay.querySelector('#org-setup-error');
          if (errorEl) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
          }
        }
      });
    }

    const fileInput = overlay.querySelector('#org-setup-file');
    overlay.querySelector('#org-setup-template').addEventListener('click', () => SetupImport.downloadTemplate());
    fileInput.addEventListener('change', async event => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const incoming = await SetupImport.parseFile(file, overlay.querySelector('#org-setup-csv-type').value);
        if (this._importMode === 'cutover') {
          const fullOnlyTypes = incoming.migrationRecords.filter(record => !['branches', 'members', 'loans', 'transactions', 'chartOfAccounts', 'openingBalances'].includes(record.recordType));
          if (fullOnlyTypes.length) throw new Error('This workbook contains full-migration sheets. Select Full Migration to import them.');
        }
        if (incoming.sheets.includes('chartOfAccounts')) this._importData.glAccounts = [];
        SetupImport.merge(this._importData, incoming);
        if (incoming.glAccounts.length) this._importData.glAccounts.push(...incoming.glAccounts);
        const importedOrg = incoming.organization;
        Object.assign(this._organization, {
          name: importedOrg.name ?? this._organization.name,
          reg_number: importedOrg.regNumber ?? this._organization.reg_number,
          type: importedOrg.type ?? this._organization.type,
          country: importedOrg.country ?? this._organization.country,
          base_currency: importedOrg.baseCurrency ?? this._organization.base_currency,
          financial_year: importedOrg.financialYear ?? this._organization.financial_year,
          regulatory_body: importedOrg.regulatoryBody ?? this._organization.regulatory_body,
          min_liquidity_ratio: importedOrg.minLiquidityRatio ?? this._organization.min_liquidity_ratio
        });
        incoming.branches.forEach(imported => {
          const existing = this._branches.find(branch => branch.id === imported.id || branch.code === imported.code);
          if (existing) Object.assign(existing, imported);
          else this._branches.push(imported);
        });
        this._render();
      } catch (error) {
        const errorEl = overlay.querySelector('#org-setup-error');
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
      } finally {
        input.value = '';
      }
    });

    overlay.querySelector('#org-setup-save').addEventListener('click', () => this._save());
  },

  async _save() {
    const errorEl = this._container.querySelector('#org-setup-error');
    errorEl.style.display = 'none';
    if (this._importData.errors.length) {
      errorEl.textContent = 'Resolve the import errors before saving.';
      errorEl.style.display = 'block';
      return;
    }
    if (!this._organization.name || !this._branches.length || this._branches.some(branch => !branch.name || !branch.code)) {
      errorEl.textContent = 'Organization name and at least one complete branch are required.';
      errorEl.style.display = 'block';
      return;
    }

    const imported = JSON.parse(JSON.stringify(this._importData));
    const migrationControls = SetupImport.getMigrationControls(imported, store.state.generalLedger || []);
    if (imported.openingBalances.length && (migrationControls.openingGlUnknownCodes.length || Math.abs(migrationControls.openingGlVariance) > 0.01)) {
      errorEl.textContent = migrationControls.openingGlUnknownCodes.length
        ? `Opening balances reference unknown GL codes: ${migrationControls.openingGlUnknownCodes.join(', ')}.`
        : `Opening GL trial balance does not balance (debits ${migrationControls.openingGlDebits}, credits ${migrationControls.openingGlCredits}, variance ${migrationControls.openingGlVariance}).`;
      errorEl.style.display = 'block';
      return;
    }
    if (this._importMode === 'full') SetupImport.attachFullMigration(imported, store.state.members || []);
    else SetupImport.attachLoans(imported, store.state.members || []);
    if (imported.errors.length) {
      errorEl.textContent = imported.errors.join(' ');
      errorEl.style.display = 'block';
      return;
    }
    const branchById = new Map(this._branches.map(branch => [branch.id, branch]));
    const branchByName = new Map(this._branches.map(branch => [String(branch.name).toLowerCase(), branch]));
    const branchByCode = new Map(this._branches.map(branch => [String(branch.code).toLowerCase(), branch]));
    SetupImport.validateOrganizationLinks(imported, this._branches, store.state.members || []);
    if (imported.errors.length) {
      errorEl.textContent = imported.errors.join(' ');
      errorEl.style.display = 'block';
      return;
    }
    for (const member of imported.members) {
      const branch = branchById.get(member.branchId) || branchByCode.get(String(member.branchId).toLowerCase()) || branchByName.get(String(member.branchName || '').toLowerCase());
      if (member.branchId && !branch) {
        errorEl.textContent = `Member ${member.id} references unknown branch ${member.branchId}.`;
        errorEl.style.display = 'block';
        return;
      }
      member.branchId = branch?.id || this._branches[0].id;
      member.branchName = member.branchName || branch?.name || this._branches[0].name;
    }

    this._saving = true;
    this._render();
    try {
      await SupabaseSync.applyTenantSetup({
        name: this._organization.name,
        type: this._organization.type,
        regNumber: this._organization.reg_number,
        country: this._organization.country,
        baseCurrency: this._organization.base_currency,
        financialYear: this._organization.financial_year,
        regulatoryBody: this._organization.regulatory_body,
        minLiquidityRatio: this._organization.min_liquidity_ratio
      }, {
        ...imported,
        branches: this._branches,
        migrationBatchId: imported.migrationRecords.length ? crypto.randomUUID() : null,
        migrationSourceFiles: imported.sourceFiles,
        migrationRowCounts: SetupImport.getMigrationControls(imported).countByType,
        migrationControlTotals: migrationControls,
        migrationRecords: this._importMode === 'full' ? imported.migrationRecords : []
      }, true);
      this.close();
      const migrationNote = this._importMode === 'full' && imported.migrationRecords.length
        ? ` Full migration archived ${imported.migrationRecords.length} source rows.`
        : '';
      App.showToast(`Organization setup saved.${migrationNote}`, 'success');
    } catch (error) {
      this._saving = false;
      this._render();
      const currentError = this._container.querySelector('#org-setup-error');
      currentError.textContent = error.message;
      currentError.style.display = 'block';
    }
  },

  close() {
    if (this._container) this._container.innerHTML = '<div id="org-setup-modal"></div>';
  }
};

window.OrganizationSetupView = OrganizationSetupView;
