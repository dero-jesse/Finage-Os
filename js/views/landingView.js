/**
 * Finage OS v3 - Institutional Landing View
 * Precision White & Institutional Green Architecture
 */

const LandingView = {
  render(container, state) {
    container.innerHTML = `
      <div class="landing-wrapper" style="display: flex; height: 100vh; width: 100vw; background-color: #f2f5f3; background-image: radial-gradient(rgba(4, 120, 87, 0.12) 1px, transparent 1px), linear-gradient(to right, rgba(4, 120, 87, 0.03) 1px, transparent 1px); background-size: 24px 24px, 120px 120px; color: var(--text-main); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; z-index: 10000; flex-direction: column; overflow: hidden;">
        
        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 820px; padding: 2.5rem; background: #ffffff; border: 1px solid var(--border-medium); border-top: 4px solid var(--accent-green-dark); border-radius: var(--radius-md); box-shadow: var(--shadow-lg);">
          
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem;">
            <span class="view-meta-tag">[ CORE BANKING OPERATING SYSTEM ]</span>
          </div>
          
          <h1 style="font-size: 3.25rem; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 0.75rem; color: var(--accent-green-darkest); line-height: 1.1;">
            FINAGE OS <span style="font-size: 1.25rem; vertical-align: super; font-family: var(--font-mono); font-weight: 700; color: var(--accent-green); background: var(--accent-green-light); border: 1px solid var(--accent-green); padding: 0.15rem 0.5rem; border-radius: var(--radius-xs);">v3 Institutional</span>
          </h1>
          
          <p style="font-size: 1.05rem; color: var(--text-muted); font-weight: 400; margin-bottom: 2.25rem; line-height: 1.6; max-width: 620px;">
            Institutional-Grade Core Banking & Liquidity Management Operating System. Built for SACCOs, MFIs, and Tier-1 Deposit-Taking Financial Institutions.
          </p>
          
          <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2.5rem;">
            <button id="btn-enter-portal" class="btn btn-primary" style="padding: 0.85rem 2.5rem; font-size: 0.95rem; font-weight: 800; letter-spacing: 0.05em; background: var(--accent-green-dark); border: 1px solid var(--accent-green-dark); box-shadow: var(--shadow-md);">
              ENTER OPERATIONAL SYSTEM
            </button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; width: 100%; border-top: 1px solid var(--border-subtle); padding-top: 1.5rem;">
            <div style="text-align: center; border-right: 1px solid var(--border-subtle); padding-right: 1rem;">
              <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: var(--accent-green-darkest);">SASRA Tier-1</div>
              <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.25rem; font-weight: 700;">Statutory Returns</div>
            </div>
            <div style="text-align: center; border-right: 1px solid var(--border-subtle); padding-right: 1rem;">
              <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: var(--accent-green-darkest);">Double-Entry</div>
              <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.25rem; font-weight: 700;">Real-Time GL</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: var(--accent-green-darkest);">Zero-Batch</div>
              <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.25rem; font-weight: 700;">Immediate Ledger Sync</div>
            </div>
          </div>
          
        </div>
      </div>
    `;

    this.bindEvents(container, state);
  },

  bindEvents(container, state) {
    const enterBtn = container.querySelector('#btn-enter-portal');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        const wrapper = container.querySelector('.landing-wrapper');
        wrapper.style.opacity = '0';
        wrapper.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
          store.state.hasPassedLanding = true;
          store.save(); // triggers re-render to login view
        }, 300);
      });
    }
  }
};

window.LandingView = LandingView;
