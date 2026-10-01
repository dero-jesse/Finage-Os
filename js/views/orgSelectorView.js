/**
 * Finage OS — Organisation Selector View
 * Shown after login when the user belongs to multiple organisations
 * (or when the platform superuser wants to switch orgs).
 */

const OrgSelectorView = {

  render(container, state) {
    const orgs = (window.Platform && Platform.getOrganizations()) || [];
    const activeOrgs = orgs.filter(o => o.status === 'active');
    const isSuperuser = window.Platform && Platform.isSuperuser();
    const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

    container.innerHTML = `
      <div style="display:flex;height:100vh;width:100vw;background:
        radial-gradient(circle at top left,rgba(124,58,237,0.1),transparent 28%),
        radial-gradient(circle at bottom right,rgba(16,185,129,0.1),transparent 28%),
        linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);
        align-items:center;justify-content:center;position:fixed;top:0;left:0;z-index:9999;">

        <div style="width:100%;max-width:560px;padding:2rem;display:flex;flex-direction:column;gap:1.25rem;">

          <!-- Header -->
          <div style="text-align:center;margin-bottom:.5rem;">
            <img src="images/logo.png" alt="Finage OS" style="height:48px;margin-bottom:.75rem;filter:drop-shadow(0 6px 12px rgba(16,185,129,0.2));">
            <h1 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;letter-spacing:-.03em;">Select Organisation</h1>
            <p style="margin:.3rem 0 0;font-size:.82rem;color:#64748b;">Choose the organisation to operate under</p>
          </div>

          <!-- Org Cards -->
          ${activeOrgs.length > 0
            ? activeOrgs.map(org => `
              <button class="org-select-card" data-org-id="${org.id}"
                style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
                  background:rgba(255,255,255,0.9);border:2px solid ${Platform.context.currentOrgId === org.id ? '#10b981' : '#e2e8f0'};
                  border-radius:16px;cursor:pointer;text-align:left;width:100%;
                  box-shadow:${Platform.context.currentOrgId === org.id ? '0 0 0 4px rgba(16,185,129,0.15)' : '0 2px 8px rgba(0,0,0,0.05)'};
                  transition:all .2s;backdrop-filter:blur(4px);">
                <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                  ${org.type === 'SACCO' ? '🏦' : org.type === 'MFI' ? '💰' : '🏛️'}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:.92rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${org.name}</div>
                  <div style="font-size:.7rem;color:#64748b;display:flex;gap:.5rem;align-items:center;margin-top:2px;">
                    <span style="background:#f0fdf4;color:#059669;border:1px solid #a7f3d0;border-radius:4px;padding:1px 6px;font-weight:700;font-size:.65rem;">${org.type}</span>
                    <span>${org.country} · ${org.base_currency}</span>
                    ${org.regulatory_body ? `<span>· ${org.regulatory_body}</span>` : ''}
                  </div>
                </div>
                ${Platform.context.currentOrgId === org.id
                  ? '<div style="color:#10b981;font-size:1.1rem;font-weight:800;">✓</div>'
                  : '<div style="color:#cbd5e1;font-size:0.9rem;">→</div>'
                }
              </button>
            `).join('')
            : `<div style="text-align:center;padding:2.5rem;background:rgba(255,255,255,0.8);border-radius:16px;border:2px dashed #e2e8f0;">
                <div style="font-size:2.5rem;margin-bottom:.75rem;">🏦</div>
                <div style="font-weight:700;color:#475569;font-size:.9rem;">No Active Organisations</div>
                <div style="font-size:.78rem;color:#94a3b8;margin-top:.3rem;">Use the Setup Wizard to onboard your first organisation.</div>
              </div>`
          }

          <!-- Superuser Controls -->
          ${isSuperuser ? `
            <div style="border-top:1px solid #e2e8f0;padding-top:1rem;display:flex;flex-direction:column;gap:.85rem;">
              ${activeOrgs.length ? `
                <form id="form-correct-owner-email" data-org-id="${escapeHtml(activeOrgs[0].id)}" style="display:flex;flex-direction:column;gap:.55rem;padding:.85rem;background:rgba(255,255,255,.85);border:1px solid #e2e8f0;border-radius:10px;">
                  <label for="inp-correct-owner-email" style="font-size:.72rem;font-weight:800;color:#334155;">Correct owner invitation · ${escapeHtml(activeOrgs[0].name)}</label>
                  <div style="display:flex;gap:.5rem;">
                    <input id="inp-correct-owner-email" type="email" class="form-control" value="${escapeHtml(activeOrgs[0].superuser_email)}" required style="min-width:0;flex:1;font-size:.78rem;">
                    <button id="btn-correct-owner-email" type="submit" style="padding:.55rem .8rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;">Update &amp; Invite</button>
                  </div>
                  <button id="btn-owner-temporary-password" type="button" style="align-self:flex-start;padding:.45rem .75rem;border:1px solid #b6ccf5;border-radius:8px;background:#eff6ff;color:#1e40af;font-size:.7rem;font-weight:700;cursor:pointer;">Generate One-Time Password</button>
                  <div id="owner-email-result" role="status" style="display:none;font-size:.72rem;"></div>
                </form>
              ` : ''}
              <div style="display:flex;gap:.75rem;justify-content:center;">
              <button id="btn-org-setup-wizard"
                style="padding:.65rem 1.4rem;border-radius:12px;border:2px solid #7c3aed;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-weight:800;font-size:.8rem;cursor:pointer;box-shadow:0 4px 14px rgba(124,58,237,0.3);">
                🚀 New Organisation Setup
              </button>
              </div>
            </div>
          ` : ''}

          <!-- Sign out -->
          <div style="text-align:center;">
            <button id="btn-org-signout" style="background:none;border:none;color:#94a3b8;font-size:.75rem;cursor:pointer;padding:.3rem .6rem;border-radius:6px;">
              ← Sign out
            </button>
          </div>

        </div>
      </div>
    `;

    this._bindEvents(container, state);
  },

  _bindEvents(container, state) {
    const ownerEmailForm = container.querySelector('#form-correct-owner-email');
    if (ownerEmailForm) {
      ownerEmailForm.addEventListener('submit', async event => {
        event.preventDefault();
        const input = ownerEmailForm.querySelector('#inp-correct-owner-email');
        const button = ownerEmailForm.querySelector('#btn-correct-owner-email');
        const result = ownerEmailForm.querySelector('#owner-email-result');
        const email = input.value.trim();
        if (!input.checkValidity()) {
          input.reportValidity();
          return;
        }
        button.disabled = true;
        button.textContent = 'Sending…';
        result.style.display = 'none';
        try {
          const response = await Platform.correctOwnerEmail(ownerEmailForm.dataset.orgId, email);
          result.textContent = `${response.message} Owner email is now ${response.ownerEmail}.`;
          result.style.color = '#047857';
          result.style.display = 'block';
          input.value = response.ownerEmail;
        } catch (error) {
          result.textContent = error.message;
          result.style.color = '#b91c1c';
          result.style.display = 'block';
        } finally {
          button.disabled = false;
          button.textContent = 'Update & Invite';
        }
      });

      const temporaryPasswordButton = ownerEmailForm.querySelector('#btn-owner-temporary-password');
      temporaryPasswordButton.addEventListener('click', async () => {
        const result = ownerEmailForm.querySelector('#owner-email-result');
        temporaryPasswordButton.disabled = true;
        temporaryPasswordButton.textContent = 'Generating…';
        result.style.display = 'none';
        try {
          const { data, error } = await window.supabase.functions.invoke('provision-organization', {
            body: { action: 'set-owner-temporary-password', orgId: ownerEmailForm.dataset.orgId }
          });
          if (error) {
            let message = error.message || 'Temporary password generation failed.';
            if (error.context && typeof error.context.json === 'function') {
              try {
                const body = await error.context.json();
                message = body.error || body.message || message;
              } catch (_) {}
            }
            throw new Error(message);
          }
          if (!data?.success || !data.temporaryPassword) throw new Error(data?.error || 'Temporary password was not returned.');
          const message = document.createElement('div');
          message.textContent = `One-time password for ${data.ownerEmail}. Provide it directly to the owner; it must be changed at first sign-in.`;
          message.style.marginBottom = '.45rem';
          const credentialRow = document.createElement('div');
          credentialRow.style.cssText = 'display:flex;gap:.4rem;';
          const credential = document.createElement('input');
          credential.type = 'password';
          credential.readOnly = true;
          credential.autocomplete = 'new-password';
          credential.value = data.temporaryPassword;
          credential.setAttribute('aria-label', 'One-time owner password');
          credential.style.cssText = 'min-width:0;flex:1;font-family:monospace;';
          const copyButton = document.createElement('button');
          copyButton.type = 'button';
          copyButton.textContent = 'Copy';
          copyButton.style.cssText = 'padding:.35rem .65rem;border:1px solid #93c5fd;border-radius:6px;background:#dbeafe;color:#1e40af;font-weight:700;cursor:pointer;';
          copyButton.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(credential.value);
              copyButton.textContent = 'Copied';
            } catch (_) {
              credential.type = 'text';
              credential.select();
              document.execCommand('copy');
              credential.type = 'password';
              copyButton.textContent = 'Copied';
            }
          });
          credentialRow.append(credential, copyButton);
          result.replaceChildren(message, credentialRow);
          result.style.color = '#1e40af';
          result.style.display = 'block';
          temporaryPasswordButton.textContent = 'One-Time Password Generated';
        } catch (error) {
          result.textContent = error.message;
          result.style.color = '#b91c1c';
          result.style.display = 'block';
          temporaryPasswordButton.disabled = false;
          temporaryPasswordButton.textContent = 'Generate One-Time Password';
        }
      });
    }

    // Select an org
    container.querySelectorAll('.org-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const orgId = card.dataset.orgId;
        if (window.Platform && Platform.setActiveOrg(orgId)) {
          // Trigger a sync pull for this org then re-render the main app
          if (window.SupabaseSync && typeof SupabaseSync.init === 'function') {
            SupabaseSync.init(store).catch(e => console.warn('[OrgSelector] sync error:', e));
          }
          store.state.orgSelectorShown = false;
          store.save();
          if (App && App.showToast) App.showToast('Switched to: ' + Platform.getActiveOrg().name, 'success');
        }
      });
    });

    // New org wizard (superuser only)
    const wizardBtn = container.querySelector('#btn-org-setup-wizard');
    if (wizardBtn) {
      wizardBtn.addEventListener('click', () => {
        if (window.SetupWizardView) SetupWizardView.open();
      });
    }

    // Sign out
    const signOutBtn = container.querySelector('#btn-org-signout');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        if (window.UserManagementEngine) {
          await UserManagementEngine.logout(store.state);
          store.save();
        }
      });
    }
  }
};

window.OrgSelectorView = OrgSelectorView;
