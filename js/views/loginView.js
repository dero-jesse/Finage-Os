/**
 * Finage OS v3 - Institutional Secure Login Gateway
 * Real Supabase Auth (signInWithPassword) with graceful local fallback.
 */

const LoginView = {
  _loading: false,

  renderPasswordChange(container, state) {
    container.innerHTML = `
      <div class="login-wrapper" style="display:flex;height:100vh;width:100vw;background:linear-gradient(135deg,#f5faf6 0%,#eef8f3 100%);align-items:center;justify-content:center;position:fixed;inset:0;z-index:10001;padding:1rem;">
        <div class="glass-panel" style="width:440px;max-width:100%;padding:2rem;display:flex;flex-direction:column;gap:1rem;text-align:center;border-top:6px solid var(--accent-green-dark);box-shadow:0 26px 60px rgba(11,52,43,.12);border-radius:16px;background:rgba(255,255,255,.94);">
          <div class="brand-title" style="font-size:1.25rem;color:var(--accent-green-darkest);">FINAGE OS</div>
          <h1 style="font-size:1.1rem;margin:0;color:#0f172a;">Set your personal password</h1>
          <p style="font-size:.78rem;color:#64748b;margin:0;">This one-time password must be replaced before you can access the organization.</p>
          <form id="password-change-form" style="display:flex;flex-direction:column;gap:.75rem;text-align:left;">
            <label class="form-label" for="new-password">New password</label>
            <input id="new-password" class="form-control" type="password" autocomplete="new-password" minlength="12" required>
            <label class="form-label" for="confirm-password">Confirm new password</label>
            <input id="confirm-password" class="form-control" type="password" autocomplete="new-password" minlength="12" required>
            <div id="password-change-error" role="alert" style="display:none;color:#b91c1c;font-size:.78rem;text-align:left;"></div>
            <button id="btn-save-password" class="btn btn-primary" type="submit" style="justify-content:center;">Update Password</button>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#password-change-form');
    const saveButton = container.querySelector('#btn-save-password');
    const error = container.querySelector('#password-change-error');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const newPassword = container.querySelector('#new-password').value;
      const confirmPassword = container.querySelector('#confirm-password').value;
      if (newPassword.length < 12) {
        error.textContent = 'Use at least 12 characters for your new password.';
        error.style.display = 'block';
        return;
      }
      if (newPassword !== confirmPassword) {
        error.textContent = 'The passwords do not match.';
        error.style.display = 'block';
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Updating…';
      error.style.display = 'none';
      try {
        const result = await UserManagementEngine.completePasswordSetup(state, newPassword);
        if (!result.success) throw new Error(result.error);
        store.saveLocal();
        if (window.App) App.showToast('Password set. Your organization workspace is ready.', 'success');
      } catch (changeError) {
        error.textContent = changeError.message || 'Password update failed.';
        error.style.display = 'block';
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Update Password';
      }
    });
  },

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

          <button id="btn-show-email-code" class="btn btn-secondary" type="button" style="justify-content:center;">Use an email code</button>
          <form id="email-code-form" style="display:none;flex-direction:column;gap:.75rem;text-align:left;">
            <label class="form-label" for="otp-email">Work email</label>
            <input id="otp-email" class="form-control" type="email" autocomplete="email" required>
            <div id="otp-code-group" style="display:none;flex-direction:column;gap:.5rem;">
              <label class="form-label" for="otp-code">Email code</label>
              <input id="otp-code" class="form-control" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8">
            </div>
            <button id="btn-email-code-submit" class="btn btn-primary" type="submit" style="justify-content:center;">Send email code</button>
            <button id="btn-email-code-resend" class="btn btn-secondary" type="button" style="display:none;justify-content:center;">Resend code</button>
            <button id="btn-use-password" class="btn btn-secondary" type="button" style="justify-content:center;">Use password instead</button>
          </form>

          <!-- Auth mode indicator -->
          <div style="text-align: center; font-size: 0.68rem; color: var(--text-dim); letter-spacing: 0.04em; margin-top: -0.4rem;">
            ${window.supabase ? 
              '<span style="color: var(--accent-emerald); font-weight: 700;">● LIVE AUTH</span> · Supabase Authentication Active' : 
              '<span style="color: var(--accent-amber); font-weight: 700;">◐ OFFLINE MODE</span> · Local credential lookup only'}
          </div>

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
    const otpForm = container.querySelector('#email-code-form');
    const otpSubmit = container.querySelector('#btn-email-code-submit');
    const otpEmail = container.querySelector('#otp-email');
    const otpCode = container.querySelector('#otp-code');
    const otpCodeGroup = container.querySelector('#otp-code-group');
    const otpResend = container.querySelector('#btn-email-code-resend');
    const switchToCode = container.querySelector('#btn-show-email-code');
    const switchToPassword = container.querySelector('#btn-use-password');

    switchToCode?.addEventListener('click', () => {
      form.style.display = 'none';
      switchToCode.style.display = 'none';
      otpForm.style.display = 'flex';
      this._clearError(container);
    });

    switchToPassword?.addEventListener('click', () => {
      otpForm.style.display = 'none';
      form.style.display = 'flex';
      switchToCode.style.display = 'flex';
      this._clearError(container);
    });

    const sendCode = async () => {
      otpSubmit.disabled = true;
      this._clearError(container);
      try {
        const result = await UserManagementEngine.requestEmailCode(otpEmail.value);
        if (!result.success) throw new Error(result.error);
        otpEmail.readOnly = true;
        otpCode.required = true;
        otpCodeGroup.style.display = 'flex';
        otpResend.style.display = 'flex';
        otpSubmit.textContent = 'Verify code';
        otpCode.focus();
      } catch (error) {
        this._showError(container, error.message || 'Could not send an email code.');
      } finally {
        otpSubmit.disabled = false;
      }
    };

    otpForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (otpCodeGroup.style.display === 'none') {
        await sendCode();
        return;
      }

      otpSubmit.disabled = true;
      this._clearError(container);
      try {
        const result = await UserManagementEngine.verifyEmailCode(state, otpEmail.value, otpCode.value);
        if (!result.success) throw new Error(result.error);
        store.saveLocal();
      } catch (error) {
        this._showError(container, error.message || 'Email code verification failed.');
      } finally {
        otpSubmit.disabled = false;
      }
    });

    otpResend?.addEventListener('click', sendCode);

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
  }
};

window.LoginView = LoginView;
