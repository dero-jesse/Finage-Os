/**
 * Finage OS v3 - Institutional Landing View
 * Precision White & Institutional Green Architecture
 */

const LandingView = {
  render(container, state) {
    container.innerHTML = `
      <div class="landing-wrapper" style="display: flex; height: 100vh; width: 100vw; background:
        radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 30%),
        radial-gradient(circle at bottom right, rgba(20,184,166,0.14), transparent 28%),
        linear-gradient(135deg, #f4f9f5 0%, #edf6f0 28%, #f7faf9 100%);
        color: var(--text-main); align-items: center; justify-content: center; position: fixed; top: 0; left: 0; z-index: 10000; flex-direction: column; overflow: hidden;">
        
        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 980px; padding: 3.25rem 4rem; background: rgba(255,255,255,0.9); border: 1px solid rgba(16,185,129,0.18); border-top: 6px solid var(--accent-green-dark); border-radius: 28px; box-shadow: 0 32px 80px rgba(10, 42, 38, 0.12); backdrop-filter: blur(8px);">
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            <img src="images/logo.png" alt="Finage OS logo" style="width: 138px; height: auto; object-fit: contain; filter: drop-shadow(0 14px 20px rgba(21, 128, 61, 0.18));">
            <h1 style="font-size: clamp(3rem, 5vw, 5rem); font-weight: 800; letter-spacing: -0.06em; margin: 0; color: var(--accent-green-darkest); line-height: 0.92;">
              FINAGE OS
            </h1>
          </div>
          
          <p style="font-size: 1.05rem; color: rgba(6,78,59,0.9); font-weight: 700; margin: 0 0 2.2rem; line-height: 1.5; max-width: 620px; letter-spacing: 0.02em;">
            Banking and liquidity.
          </p>
          
          <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
            <button id="btn-enter-portal" class="btn btn-primary" style="padding: 1.1rem 2.8rem; font-size: 0.96rem; font-weight: 800; letter-spacing: 0.05em; background: linear-gradient(180deg, var(--accent-green-dark), #0f766e); border: 1px solid rgba(15, 118, 110, 0.9); box-shadow: 0 20px 36px rgba(13, 148, 136, 0.28); border-radius: 999px; transform: translateY(0); transition: transform 0.2s ease, box-shadow 0.2s ease;">
              ENTER
            </button>
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
