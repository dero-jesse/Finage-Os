/**
 * Finage OS v3 - Institutional Secure Login Gateway
 * Precision Two-Tone White & Green with Instant Role Presets (Zero Icons)
 */

const LoginView = {
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
              <input type="email" id="login-email" class="form-control" placeholder="operator@finage.co.ke" value="caroline.wanjala@finage.co.ke" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;">Passkey</label>
              <input type="password" id="login-password" class="form-control" placeholder="••••••••" value="institutionsafe2026" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 0.72rem 1rem; font-weight: 800; letter-spacing: 0.04em; border-radius: 12px; background: linear-gradient(180deg, var(--accent-green-dark), #0f766e); box-shadow: 0 12px 22px rgba(16,185,129,0.18);">
              ENTER
            </button>
          </form>

          <!-- Quick Operator Select Presets -->
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 1rem; text-align: left;">
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem;">
              QUICK ACCESS
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
