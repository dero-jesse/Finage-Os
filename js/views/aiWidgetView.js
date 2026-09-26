/**
 * Finage OS v3 - AI Widget View
 * A floating, glassmorphic chat widget for AI interactions.
 */

const AiWidgetView = {
  isOpen: false,
  chatHistory: [
    { sender: 'ai', text: "Hello! I'm your Finage AI assistant. Ask me for reports, liquidity metrics, or alerts!" }
  ],

  render(container, state) {
    // Only render if authenticated
    if (!state.isAuthenticated) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <!-- Widget Toggle Button -->
      <button id="ai-widget-toggle" style="position: fixed; bottom: 2rem; right: 2rem; width: 56px; height: 56px; border-radius: var(--radius-sm); background: var(--accent-green-dark); color: #ffffff; border: 1px solid var(--accent-green); box-shadow: var(--shadow-lg); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 9999; font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem; letter-spacing: 0.05em; transition: var(--trans-fast);">
        ${this.isOpen ? 'CLOSE' : 'AI'}
      </button>

      <!-- Chat Window -->
      <div id="ai-chat-window" class="glass-panel" style="position: fixed; bottom: 6rem; right: 2rem; width: 380px; height: 500px; z-index: 9998; display: ${this.isOpen ? 'flex' : 'none'}; flex-direction: column; overflow: hidden; transform: ${this.isOpen ? 'translateY(0)' : 'translateY(20px)'}; opacity: ${this.isOpen ? '1' : '0'}; transition: all 0.3s ease; box-shadow: var(--shadow-lg); border: 1px solid var(--border-medium); border-top: 3px solid var(--accent-green);">
        
        <!-- Chat Header -->
        <div style="background: #ffffff; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 28px; height: 28px; border-radius: var(--radius-xs); background: var(--accent-green-dark); display: flex; align-items: center; justify-content: center; color: #ffffff; font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem;">AI</div>
            <div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--accent-green-darkest);">Finage Copilot</h3>
              <span style="font-size: 0.725rem; color: var(--accent-green); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                <span class="live-status-dot" style="margin-right: 0;"></span>
                Online
              </span>
            </div>
          </div>
          <span class="badge badge-emerald">Ready</span>
        </div>

        <!-- Messages Area -->
        <div id="ai-chat-messages" style="flex: 1; padding: 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.85rem; background: var(--bg-surface-subtle);">
          ${this.chatHistory.map(msg => `
            <div style="display: flex; ${msg.sender === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
              <div style="max-width: 85%; padding: 0.65rem 0.95rem; border-radius: var(--radius-xs); font-size: 0.825rem; line-height: 1.45; ${
                msg.sender === 'user' 
                ? 'background: var(--accent-green-dark); color: #ffffff; border: 1px solid var(--accent-green-dark);' 
                : 'background: #ffffff; color: var(--text-main); border: 1px solid var(--border-subtle); box-shadow: var(--shadow-xs);'
              }">
                ${msg.text}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Input Area -->
        <div style="padding: 1rem; background: #ffffff; border-top: 1px solid var(--border-subtle);">
          <form id="ai-chat-form" style="display: flex; gap: 0.5rem;">
            <input type="text" id="ai-chat-input" class="form-control" placeholder="Ask about liquidity, reports..." autocomplete="off" style="flex: 1;">
            <button type="submit" class="btn btn-primary" style="padding: 0.5rem 1rem; font-weight: 800;">
              Send
            </button>
          </form>
        </div>
      </div>
        </div>
      </div>
    `;

    this.bindEvents(container, state);
    this.scrollToBottom(container);
  },

  bindEvents(container, state) {
    const toggleBtn = container.querySelector('#ai-widget-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isOpen = !this.isOpen;
        this.render(container, state);
      });
    }

    const form = container.querySelector('#ai-chat-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = container.querySelector('#ai-chat-input');
        const query = input.value.trim();
        if (!query) return;

        // Add user message
        this.chatHistory.push({ sender: 'user', text: query });
        
        // Add loading indicator
        this.chatHistory.push({ sender: 'ai', text: '...' });
        this.render(container, state);

        // Process response with delay to simulate AI thinking
        setTimeout(() => {
          this.chatHistory.pop(); // remove loading
          const response = AiAgentEngine.processQuery(state, query);
          this.chatHistory.push({ sender: 'ai', text: response });
          this.render(container, state);
        }, 600);
      });
    }
  },

  scrollToBottom(container) {
    const messagesDiv = container.querySelector('#ai-chat-messages');
    if (messagesDiv) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    // Auto-focus input if open
    if (this.isOpen) {
      const input = container.querySelector('#ai-chat-input');
      if (input) input.focus();
    }
  }
};

window.AiWidgetView = AiWidgetView;
