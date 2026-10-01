/**
 * Finage OS v3 - Admin Reporting Portal
 * Generates customizable institution-level CSV/XLSX reports for operational modules.
 */

const ReportsView = {
  activeCategory: 'client-management',

  open() {
    const mount = document.getElementById('reports-modal-mount');
    if (mount) {
      this.renderModal(mount, store.state);
    }
  },

  close(container) {
    if (container) {
      container.innerHTML = '';
    }
  },

  renderModal(container, state) {
    container.innerHTML = `
      <div class="modal-backdrop" id="reports-modal">
        <div class="modal-container" style="max-width: 1100px; border-radius: 18px; overflow: hidden;">
          <div class="modal-header" style="padding: 1.25rem 1.5rem; background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.98)); border-bottom: 1px solid rgba(148,163,184,0.2);">
            <div>
              <div class="modal-title" style="font-size: 1rem; letter-spacing: 0.06em; text-transform: uppercase; color: #e2e8f0;">Report Hub</div>
            </div>
            <button class="modal-close" id="btn-close-reports-modal" title="Close reports" style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.7rem; border: 1px solid rgba(148,163,184,0.25); border-radius: 10px; background: rgba(15,23,42,0.6); color: #dbeafe; cursor: pointer;">
              ✕
            </button>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 0.55rem; padding: 0.9rem 1.5rem 0; border-bottom: 1px solid var(--border-subtle); background: linear-gradient(180deg, #f8fafc, #eef4ff);">
            ${this.getCategoryButtons().map(item => `
              <button class="input-tab-btn ${this.activeCategory === item.id ? 'active' : ''}" data-report-category="${item.id}" style="text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.68rem;">
                ${item.label}
              </button>
            `).join('')}
          </div>

          <div class="modal-body" id="reports-panel-body" style="padding: 1.25rem 1.5rem 1.5rem; background: linear-gradient(180deg, #f8fafc 0%, #f3f6fb 100%);">
            ${this.renderCategoryBody(state)}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  getCategoryButtons() {
    return [
      { id: 'client-management', label: 'Clients' },
      { id: 'savings-management', label: 'Savings' },
      { id: 'time-deposits', label: 'Fixed Deposits' },
      { id: 'shares-module', label: 'Shares' },
      { id: 'loan-portfolio', label: 'Loans' },
      { id: 'general-ledger', label: 'Ledger' }
    ];
  },

  renderCategoryBody(state) {
    const category = this.getCategoryById(this.activeCategory);
    const rows = this.getReportRows(this.activeCategory, state);
    const summary = this.getSummaryStats(rows);

    return `
      <div style="display: flex; flex-direction: column; gap: 1.15rem;">
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8rem;">
          <div class="glass-panel" style="margin: 0; padding: 0.9rem 1rem; background: linear-gradient(180deg, #ffffff, #f4f8ff);">
            <div style="font-size: 0.68rem; letter-spacing: 0.08em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.55rem;">Records</div>
            <div style="font-size: 1.55rem; font-weight: 800; color: var(--accent-green-darkest); font-family: var(--font-mono);">${summary.records}</div>
          </div>
          <div class="glass-panel" style="margin: 0; padding: 0.9rem 1rem; background: linear-gradient(180deg, #ffffff, #effcf9);">
            <div style="font-size: 0.68rem; letter-spacing: 0.08em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.55rem;">Gross Value</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-green-darkest); font-family: var(--font-mono);">${this.formatCurrency(summary.grossValue)}</div>
          </div>
          <div class="glass-panel" style="margin: 0; padding: 0.9rem 1rem; background: linear-gradient(180deg, #ffffff, #f5f3ff);">
            <div style="font-size: 0.68rem; letter-spacing: 0.08em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.55rem;">Branch Coverage</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-green-darkest); font-family: var(--font-mono);">${summary.branches}</div>
          </div>
          <div class="glass-panel" style="margin: 0; padding: 0.9rem 1rem; background: linear-gradient(180deg, #ffffff, #fefce8);">
            <div style="font-size: 0.68rem; letter-spacing: 0.08em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.55rem;">Status</div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-green-dark); text-transform: uppercase;">${summary.status}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 1.25rem;">
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="glass-panel" style="margin: 0; padding: 1rem; background: linear-gradient(180deg, #ffffff, #f8fbff);">
              <div class="panel-header" style="margin-bottom: 0.75rem;">
                <div class="panel-title-wrap">
                  <span class="panel-title">${category.label}</span>
                </div>
                <span class="badge badge-aqua">${rows.length} record(s)</span>
              </div>
              <p style="margin: 0; color: var(--text-dim); font-size: 0.75rem; line-height: 1.5;">
                ${category.description.split(' ').slice(0, 10).join(' ')}${category.description.split(' ').length > 10 ? '…' : ''}
              </p>
            </div>

            <div class="glass-panel" style="margin: 0; padding: 1rem; background: linear-gradient(180deg, #ffffff, #f8fafc);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label">From</label>
                  <input id="reports-from-date" type="date" class="form-control" value="${this.getDefaultFromDate()}" />
                </div>
                <div class="form-group" style="margin: 0;">
                  <label class="form-label">To</label>
                  <input id="reports-to-date" type="date" class="form-control" value="${this.getDefaultToDate()}" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.8rem; margin-top: 1rem; align-items: end;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label">Export format</label>
                  <select id="reports-export-format" class="form-control">
                    <option value="csv">CSV</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>
                <button id="btn-generate-report" class="btn btn-primary" style="padding: 0.7rem 1.2rem; font-weight: 800; white-space: nowrap;">
                  Generate Report
                </button>
              </div>
            </div>
          </div>

          <div class="glass-panel" style="margin: 0; padding: 1rem; background: linear-gradient(180deg, #ffffff, #f8fafc);">
            <div class="panel-header" style="margin-bottom: 0.8rem;">
              <div class="panel-title-wrap">
                <span class="panel-title">Preview</span>
              </div>
            </div>

            <div class="table-responsive" style="max-height: 360px;">
              <table class="data-table">
                <thead>
                  <tr>
                    ${Object.keys(rows[0] || {}).slice(0, 5).map(key => `<th>${key}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.slice(0, 6).map(row => `
                    <tr>
                      ${Object.entries(row).slice(0, 5).map(([_, value]) => `<td>${this.formatCell(value)}</td>`).join('')}
                    </tr>
                  `).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1rem;">No rows available for this report.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getCategoryById(id) {
    const map = {
      'client-management': {
        label: 'Client Management Reports',
        description: 'Aggregates demographic data, client categorization, KYC status, risk segmentation, and outreach analytics.'
      },
      'savings-management': {
        label: 'Savings Management Reports',
        description: 'Tracks voluntary savings balances, account activity, and member wealth position across savings products.'
      },
      'time-deposits': {
        label: 'Time Deposits & Fixed Deposits',
        description: 'Summarizes long-term deposit balances, maturity windows, and fixed deposit allocation by member and branch.'
      },
      'shares-module': {
        label: 'Shares Module Reports',
        description: 'Covers equity contributions, dividend movement, share capital, and cooperative ownership tracking.'
      },
      'loan-portfolio': {
        label: 'Loan Portfolio Reports',
        description: 'Tracks loan balances, risk segments, performance quality, disbursements, and outstanding exposure.'
      },
      'general-ledger': {
        label: 'General Ledger & Financial Reports',
        description: 'Lists accounting entries, liability and asset positions, and financial control balances by account.'
      }
    };
    return map[id] || map['client-management'];
  },

  getDefaultFromDate() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  },

  getDefaultToDate() {
    return new Date().toISOString().slice(0, 10);
  },

  getSummaryStats(rows) {
    const grossValue = rows.reduce((sum, row) => {
      const values = Object.values(row).filter(v => typeof v === 'number');
      return sum + values.reduce((acc, v) => acc + v, 0);
    }, 0);

    const branchSet = new Set();
    rows.forEach(row => {
      const branch = row.Branch || row.branch || row.BranchName || row.branchName;
      if (branch) branchSet.add(branch);
    });

    const status = rows.length > 0 ? 'Operational' : 'No Data';

    return {
      records: rows.length,
      grossValue,
      branches: branchSet.size || 1,
      status
    };
  },

  formatCurrency(value) {
    const amount = Number(value) || 0;
    if (Formatter && Formatter.money) return Formatter.money(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  },

  bindEvents(container, state) {
    const closeBtn = container.querySelector('#btn-close-reports-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(container));
    }

    container.querySelectorAll('[data-report-category]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeCategory = button.dataset.reportCategory;
        this.renderModal(container, state);
      });
    });

    const generateBtn = container.querySelector('#btn-generate-report');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        const rows = this.getReportRows(this.activeCategory, state);
        const format = container.querySelector('#reports-export-format')?.value || 'csv';
        const fileName = `${this.activeCategory}-${new Date().toISOString().slice(0, 10)}.${format}`;

        if (format === 'xlsx') {
          this.downloadXlsx(rows, fileName, state);
        } else {
          this.downloadCsv(rows, fileName, state);
        }

        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`${this.getCategoryById(this.activeCategory).label} exported as ${format.toUpperCase()}.`, 'success');
        }
      });
    }
  },

  getReportRows(reportId, state) {
    const members = state.members || [];

    switch (reportId) {
      case 'savings-management':
        return members.map(member => ({
          MemberID: member.id,
          Name: member.name,
          Branch: member.branchName,
          SavingsBalance: member.savingsBalance || 0,
          FixedDeposit: member.fixedDepositBalance || 0,
          ShareCapital: member.shareCapital || 0,
          TotalPosition: (member.savingsBalance || 0) + (member.fixedDepositBalance || 0) + (member.shareCapital || 0)
        }));
      case 'time-deposits':
        return members.filter(member => (member.fixedDepositBalance || 0) > 0).map(member => ({
          MemberID: member.id,
          Name: member.name,
          Branch: member.branchName,
          FixedDeposit: member.fixedDepositBalance || 0,
          MaturityCycle: '12-36 months',
          Rate: '10.5% p.a.',
          Status: 'Active'
        }));
      case 'shares-module':
        return members.map(member => ({
          MemberID: member.id,
          Name: member.name,
          Branch: member.branchName,
          ShareCapital: member.shareCapital || 0,
          RelationshipScore: member.relationshipScore || 0,
          DividendEligible: member.shareCapital > 0 ? 'Yes' : 'No'
        }));
      case 'loan-portfolio':
        return members.flatMap(member => (member.activeLoans || []).map(loan => ({
          MemberID: member.id,
          Name: member.name,
          Branch: member.branchName,
          Product: loan.product || 'Loan Facility',
          Outstanding: loan.outstanding || 0,
          Status: loan.status || 'Active',
          RiskClass: loan.npaClassification || 'Performing'
        })));
      case 'general-ledger':
        return (state.generalLedger || []).map(account => ({
          Code: account.code || '',
          Name: account.name || '',
          Category: account.category || '',
          Type: account.type || '',
          Balance: account.balance || 0,
          Normal: account.normal || ''
        }));
      case 'client-management':
      default:
        return members.map(member => ({
          MemberID: member.id,
          Name: member.name,
          Email: member.email || '',
          Phone: member.phone || '',
          Branch: member.branchName || '',
          KYCStatus: member.kycStatus || '',
          RiskSegment: member.riskSegment || '',
          RelationshipScore: member.relationshipScore || 0
        }));
    }
  },

  downloadCsv(rows, fileName, state) {
    if (!rows.length) {
      rows = [{ NoData: 'No records available for this report.' }];
    }

    const headers = Object.keys(rows[0]);
    const organizationName = state.institution?.name || 'Organization';
    const csv = [
      'FINAGE OS',
      `Organization,${this.escapeCsv(organizationName)}`,
      `Report,${this.escapeCsv(this.getCategoryById(this.activeCategory).label)}`,
      '',
      headers.map(header => this.escapeCsv(header)).join(','),
      ...rows.map(row => headers.map(header => this.escapeCsv(row[header])).join(','))
    ].join('\r\n');
    this.triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), fileName);
  },

  downloadXlsx(rows, fileName, state) {
    if (!window.XLSX) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('XLSX export is unavailable because the spreadsheet library did not load.', 'warning');
      }
      return;
    }

    if (!rows.length) {
      rows = [{ NoData: 'No records available for this report.' }];
    }

    const organizationName = state.institution?.name || 'Organization';
    const headers = Object.keys(rows[0]);
    const worksheetRows = [
      ['FINAGE OS'],
      ['Organization', organizationName],
      ['Report', this.getCategoryById(this.activeCategory).label],
      [],
      headers,
      ...rows.map(row => headers.map(header => row[header]))
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, fileName);
  },

  triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  escapeCsv(value) {
    const str = value == null ? '' : String(value);
    const needsQuotes = /[",\n]/.test(str);
    return needsQuotes ? `"${str.replace(/"/g, '""')}"` : str;
  },

  formatCell(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return Formatter && Formatter.money ? Formatter.money(value) : value.toLocaleString();
    return String(value);
  }
};

window.ReportsView = ReportsView;
