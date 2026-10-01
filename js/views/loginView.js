/**
 * Finage OS v3 - Institutional Secure Login Gateway
 * Real Supabase Auth (signInWithPassword) with graceful local fallback.
 */

const LoginView = {
  _loading: false,

  render(container, state) {
    container.innerHTML = `
      <div class="login-wrapper" style="display: flex; height: 100vh; width: 100vw; background:
        radial-gradient(circle at top left, rgba(16,185,129,0.12), transparent 25%),
        linear-gradient(135deg, #f5faf6 0%, #eef8f3 100%);
        align-items: center; justify-content: center; position: fixed; top: 0; left: 0; z-index: 9999;">
        <div class="glass-panel" style="width: 440px; padding: 2rem 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.1rem; text-align: center; border-top: 6px solid var(--accent-green-dark); box-shadow: 0 26px 60px rgba(11, 52, 43, 0.12); border-radius: 20px; background: rgba(255,255,255,0.86); backdrop-filter: blur(5px);">
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 0.8rem; margin-bottom: 0.2rem; flex-wrap: wrap;">
            <img src="images/logo.png" alt="Finage OS logo" style="width: 68px; height: auto; object-fit: contain; filter: drop-shadow(0 8px 12px rgba(21, 128, 61, 0.18));">
            <div class="brand-title" style="font-size: 1.35rem; color: var(--accent-green-darkest); letter-spacing: -0.02em;">
              FINAGE OS
            </div>
          </div>

          <form id="login-form" style="display: flex; flex-direction: column; gap: 0.9rem; text-align: left;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;">Email</label>
              <input type="email" id="login-email" class="form-control" placeholder="operator@finage.co.ke" autocomplete="email" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;">Password</label>
              <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password" required>
            </div>

            <!-- Auth error message slot -->
            <div id="login-error" style="display: none; background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.3); border-radius: 8px; padding: 0.6rem 0.85rem; font-size: 0.78rem; color: var(--accent-rose); text-align: left; font-weight: 600;"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 0.72rem 1rem; font-weight: 800; letter-spacing: 0.04em; border-radius: 12px; background: linear-gradient(180deg, var(--accent-green-dark), #0f766e); box-shadow: 0 12px 22px rgba(16,185,129,0.18);">
              ENTER
            </button>
          </form>

          <!-- Auth mode indicator -->
          <div style="text-align: center; font-size: 0.68rem; color: var(--text-dim); letter-spacing: 0.04em; margin-top: -0.4rem;">
            ${window.supabase ? 
              '<span style="color: var(--accent-emerald); font-weight: 700;">● LIVE AUTH</span> · Supabase Authentication Active' : 
              '<span style="color: var(--accent-amber); font-weight: 700;">◐ OFFLINE MODE</span> · Local credential lookup only'}
          </div>

          <!-- Quick Operator Select Presets (dev/demo only, shown when offline) -->
          ${!window.supabase ? `
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem; text-align: left;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
              QUICK ACCESS <span style="color: var(--accent-amber); font-weight: 800;">(offline only)</span>
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
          ` : ''}

        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  _setLoading(container, loading) {
    this._loading = loading;
    const btn = container.querySelector('#btn-login-submit');
    const emailInput = container.querySelector('#login-email');
    const passwordInput = container.querySelector('#login-password');
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? 'Authenticating...' : 'ENTER';
    }
    if (emailInput) emailInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
  },

  _showError(container, message) {
    const errEl = container.querySelector('#login-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  },

  _clearError(container) {
    const errEl = container.querySelector('#login-error');
    if (errEl) errEl.style.display = 'none';
  },

  bindEvents(container, state) {
    const form = container.querySelector('#login-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (this._loading) return;

        const email = container.querySelector('#login-email').value.trim();
        const password = container.querySelector('#login-password').value;

        this._clearError(container);
        this._setLoading(container, true);

        try {
          const result = await UserManagementEngine.loginWithAuth(store.state, email, password);
          if (result.success) {
            store.save();
          } else {
            this._showError(container, result.error || 'Authentication failed. Check your credentials.');
          }
        } catch (err) {
          this._showError(container, 'Unexpected error: ' + err.message);
        } finally {
          this._setLoading(container, false);
        }
      });
    }

    // Quick login buttons (offline/dev mode only)
    container.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.dataset.email;
        if (email) {
          const emailInput = container.querySelector('#login-email');
          if (emailInput) emailInput.value = email;
          // In offline mode, use sync login
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
