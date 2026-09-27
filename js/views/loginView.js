/**
 * Finage OS v3 - Institutional Secure Login Gateway
 * Precision Two-Tone White & Green with Instant Role Presets (Zero Icons)
 */

const LoginView = {
  render(container, state) {
    container.innerHTML = `
      <div class="login-wrapper" style="display: flex; height: 100vh; width: 100vw; background-color: #f2f5f3; background-image: radial-gradient(rgba(4, 120, 87, 0.12) 1px, transparent 1px); background-size: 24px 24px; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; z-index: 9999;">
        <div class="glass-panel" style="width: 440px; padding: 2.25rem; display: flex; flex-direction: column; gap: 1.25rem; text-align: center; border-top: 4px solid var(--accent-green-dark); box-shadow: var(--shadow-lg);">
          
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="view-meta-tag">[ IDENTITY & ACCESS GATEWAY ]</span>
            <div class="brand-title" style="font-size: 1.35rem; color: var(--accent-green-darkest);">
              FINAGE OS <span class="brand-tag">v3 Core</span>
            </div>
            <div style="font-size: 0.775rem; color: var(--text-dim);">Role-Based Operator Authentication</div>
          </div>

          <form id="login-form" style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
            <div class="form-group">
              <label class="form-label">Corporate Operator Email</label>
              <input type="email" id="login-email" class="form-control" placeholder="operator@finage.co.ke" value="caroline.wanjala@finage.co.ke" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Security Credential / Passkey</label>
              <input type="password" id="login-password" class="form-control" placeholder="••••••••" value="institutionsafe2026" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 0.65rem 1rem; font-weight: 800; letter-spacing: 0.04em;">
              AUTHORIZE & ENTER PORTAL
            </button>
          </form>

          <!-- Quick Operator Select Presets -->
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem; text-align: left;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
              Instant Operator Fast-Login:
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
              <button class="btn btn-secondary btn-sm btn-quick-login" data-email="admin@finage.co.ke" style="font-size: 0.68rem; justify-content: flex-start; text-align: left;">
                Admin (System)
              </button>
              <button class="btn btn-secondary btn-sm btn-quick-login" data-email="caroline.wanjala@finage.co.ke" style="font-size: 0.68rem; justify-content: flex-start; text-align: left;">
                Treasury Manager
              </button>
              <button class="btn btn-secondary btn-sm btn-quick-login" data-email="faith.mwangi@finage.co.ke" style="font-size: 0.68rem; justify-content: flex-start; text-align: left;">
                FOSA
              </button>
              <button class="btn btn-secondary btn-sm btn-quick-login" data-email="david.ochieng@finage.co.ke" style="font-size: 0.68rem; justify-content: flex-start; text-align: left;">
                Teller
              </button>
              <button class="btn btn-secondary btn-sm btn-quick-login" data-email="brian.komen@finage.co.ke" style="font-size: 0.68rem; justify-content: flex-start; text-align: left;">
                Credit Checker
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  bindEvents(container, state) {
    const form = container.querySelector('#login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = container.querySelector('#login-email').value.trim();
        
        const success = UserManagementEngine.login(store.state, email);
        if (success) {
          store.save(); // trigger re-render
        } else {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Invalid operator credentials. User record not found.', 'danger');
          } else {
            alert('Invalid credentials. User record not found or inactive.');
          }
        }
      });
    }

    // Quick login buttons
    container.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.dataset.email;
        if (email) {
          const emailInput = container.querySelector('#login-email');
          if (emailInput) emailInput.value = email;
          const success = UserManagementEngine.login(store.state, email);
          if (success) {
            store.save();
          }
        }
      });
    });
  }
};

window.LoginView = LoginView;
