(function () {
  const DEFAULT_SITEMAP_URL = 'https://www.houselearning.org/meta/sitemap.xml';
  const DEFAULT_LANG = 'en';
  const ASSISTANT_VERSION = '1.1.0';

  function getHouseLearningHomeUrl() {
    return (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000/home'
      : 'https://houselearning.org/home';
  }

  function scriptBaseUrl() {
    const candidates = [];
    const path = window.location.pathname || '/';
    if (path.includes('/home')) candidates.push('/home/assistant');
    candidates.push('/assistant');
    for (const candidate of candidates) {
      if (candidate === '/home/assistant' || candidate === '/assistant') return candidate;
    }
    return '/assistant';
  }

  function ensureCss() {
    if (document.querySelector('link[data-hl-assistant-css="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${scriptBaseUrl()}/assistant.css`;
    link.setAttribute('data-hl-assistant-css', 'true');
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.hlLoaded === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => {
          existing.dataset.hlLoaded = 'true';
          resolve();
        }, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.defer = false;
      script.dataset.hlLoaded = 'false';
      script.addEventListener('load', () => {
        script.dataset.hlLoaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function ensureScripts() {
    const base = scriptBaseUrl();
    const scripts = [
      `${base}/assistant-i18n.js`,
      `${base}/assistant-storage.js`,
      `${base}/assistant-session.js`,
      `${base}/assistant-context.js`,
      `${base}/assistant-ui.js`,
      `${base}/assistant-sitemap.js`,
      `${base}/assistant-voice.js`
    ];

    for (const src of scripts) {
      await loadScript(src);
    }
  }

  function safeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function sanitizeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function getSubjectContext(currentUrl) {
    const path = (currentUrl || window.location.pathname || '').toLowerCase();
    if (path.includes('/math')) return 'math';
    if (path.includes('/science')) return 'science';
    if (path.includes('/comput') || path.includes('python') || path.includes('code') || path.includes('javascript')) return 'coding';
    if (path.includes('/games')) return 'games';
    return 'general';
  }

  function createSystemPrompt() {
    return `You are the HouseLearning AI Assistant. Help students learn and navigate HouseLearning. Use HouseLearning resources first and never invent HouseLearning links. Be friendly, patient, kid-safe, and encourage learning. Explain concepts clearly in the user's language. If you do not know something, say so honestly. Keep responses concise and age-appropriate. The supported languages are English, Spanish, Turkish, and Portuguese.`;
  }

  async function defaultAssistantBackend(message, context = {}) {
    const text = safeText(message);
    const safeAiEnabled = window.HLAssistantSafeAI ? window.HLAssistantSafeAI.isEnabled() : true;

    if (!text) {
      return {
        text: context.translations?.responseFallback || 'I can help you explore HouseLearning lessons, math, science, and coding. Try asking for a topic or choose one of the suggestions.',
        suggestions: []
      };
    }

    const normalized = text.toLowerCase();
    const session = context.session || null;
    const topicText = session && session.activeTopic ? session.activeTopic : '';
    const suggestions = (context.recommendations || []).slice(0, 4);

    if (safeAiEnabled && /\b(hack|bypass|exploit|malware|weapon|self-harm|suicide|violent attack|bomb|illegal drug|buy drugs)\b/i.test(text)) {
      return {
        text: 'I can help with school-friendly, safe learning topics. Let’s focus on math, science, coding, or a lesson you are studying.',
        suggestions: []
      };
    }

    let answer = context.translations?.responseFallback || 'I can help you find a topic to explore on HouseLearning.';

    if (session && session.currentPage && session.currentPage.title) {
      answer = `Welcome back! We were working on ${topicText || 'your current topic'}. You are on ${session.currentPage.title}. Want to keep learning from here?`;
    }

    if (normalized.includes('python') || normalized.includes('coding') || normalized.includes('programming')) {
      answer = 'Python and coding are great places to start. Try exploring our coding and computer science lessons, then build a small project step by step.';
    } else if (normalized.includes('fraction') || normalized.includes('fractions')) {
      answer = 'Fractions are parts of a whole. You can compare the numerator and denominator, or draw a visual model to help understand them better.';
    } else if (normalized.includes('algebra') || normalized.includes('equation') || normalized.includes('math')) {
      answer = 'Math becomes easier when you look for patterns and break problems into smaller steps. Start with a simple example and then try a similar one on your own.';
    } else if (normalized.includes('science')) {
      answer = 'Science is all about observing, asking questions, and testing ideas. Try exploring a topic like energy, planets, or living things.';
    } else if (normalized.includes('lesson') || normalized.includes('learn')) {
      answer = 'I can help you find a good lesson on HouseLearning. Start with the topic you want to study, and I will suggest the most relevant pages.';
    } else if (normalized.includes('hello') || normalized.includes('hi')) {
      answer = 'Hi! I can help you explore math, science, coding, and lessons on HouseLearning. What would you like to study today?';
    }

    return { text: answer, suggestions };
  }

  async function askAssistant(message, context = {}) {
    const backend = context.backend || defaultAssistantBackend;
    return backend(message, context);
  }

  async function initAssistant(options = {}) {
    ensureCss();
    try {
      await ensureScripts();
    } catch (_error) {
      // Ignore script load failures so the core assistant still renders.
    }

    const sitemapUrl = options.sitemap || DEFAULT_SITEMAP_URL;
    const defaultLanguage = options.defaultLanguage || DEFAULT_LANG;
    const backend = options.backend || defaultAssistantBackend;

    const assistantRoot = document.createElement('div');
    assistantRoot.className = 'hl-assistant';
    assistantRoot.setAttribute('data-open', 'false');
    assistantRoot.setAttribute('data-state', 'idle');
    assistantRoot.setAttribute('data-version', ASSISTANT_VERSION);

    const session = window.HLAssistantSession ? window.HLAssistantSession.restoreFromStorage(defaultLanguage) : { sessionId: 'local', language: defaultLanguage, messages: [], activeTopic: '', currentPage: null, previousPage: null, guidedMode: true, mode: 'keyboard' };

    const state = {
      open: false,
      status: 'idle',
      language: window.HLAssistantI18n ? window.HLAssistantI18n.getLanguagePreference(session.language || defaultLanguage) : (session.language || defaultLanguage),
      currentSuggestions: [],
      recognitionSession: null,
      session,
      voiceSupported: Boolean(window.HLAssistantVoice && window.HLAssistantVoice.isSupported),
      guidedMode: session.guidedMode !== false,
      mode: session.mode || 'keyboard'
    };

    const strings = window.HLAssistantI18n?.translations?.[state.language] || window.HLAssistantI18n?.translations?.en || {};

    assistantRoot.innerHTML = `
      <div class="hl-assistant-panel" role="dialog" aria-live="polite" aria-label="HouseLearning assistant">
        <div class="hl-assistant-header">
          <div class="hl-assistant-title">
            <span class="hl-assistant-badge" aria-hidden="true"></span>
            <span>${sanitizeHtml(strings.assistantName || 'HouseLearning Assistant')}</span>
          </div>
          <div class="hl-assistant-controls">
            <label class="sr-only" for="hl-assistant-language">${sanitizeHtml(strings.labels?.language || 'Language')}</label>
            <select id="hl-assistant-language" class="hl-assistant-select" aria-label="Language selector">
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="pt">🇧🇷 Português</option>
            </select>
            <button type="button" class="hl-assistant-clear" aria-label="${sanitizeHtml(strings.labels?.clearChatTooltip || 'Clear conversation')}" title="${sanitizeHtml(strings.labels?.clearChatTooltip || 'Clear conversation')}">×</button>
          </div>
        </div>
        <div class="hl-assistant-modebar">
          <button type="button" class="hl-assistant-mode-btn hl-assistant-mode-btn-active" data-mode="keyboard">⌨️ Type</button>
          <button type="button" class="hl-assistant-mode-btn" data-mode="voice">🎤 Voice</button>
          <button type="button" class="hl-assistant-mode-btn" data-mode="guided">🧭 Guided</button>
          <button type="button" class="hl-assistant-end-btn" data-mode="end">⏹ End</button>
        </div>
        <div class="hl-assistant-messages" id="hl-assistant-messages"></div>
        <div class="hl-assistant-suggestions">
          <div class="hl-assistant-suggestions-title">${sanitizeHtml(strings.suggestionsTitle || 'What would you like to learn?')}</div>
          <div class="hl-assistant-suggestions-list" id="hl-assistant-suggestions"></div>
        </div>
        <div class="hl-assistant-composer">
          <textarea class="hl-assistant-input" id="hl-assistant-input" rows="1" placeholder="${sanitizeHtml(strings.labels?.inputPlaceholder || 'Ask me anything...')}" aria-label="Assistant prompt"></textarea>
          <button class="hl-assistant-mic" type="button" aria-label="${sanitizeHtml(strings.mic || 'Voice')}">🎤</button>
          <button class="hl-assistant-send" type="button">${sanitizeHtml(strings.send || 'Send')}</button>
        </div>
      </div>
      <button class="hl-assistant-orb" type="button" aria-label="Open HouseLearning assistant" aria-expanded="false">
        <span class="hl-assistant-orb-core" aria-hidden="true"></span>
        <span class="hl-assistant-orb-label" aria-hidden="true"></span>
      </button>
    `;

    const messagesBox = assistantRoot.querySelector('#hl-assistant-messages');
    const suggestionsBox = assistantRoot.querySelector('#hl-assistant-suggestions');
    const languageSelect = assistantRoot.querySelector('#hl-assistant-language');
    const input = assistantRoot.querySelector('#hl-assistant-input');
    const orb = assistantRoot.querySelector('.hl-assistant-orb');
    const sendButton = assistantRoot.querySelector('.hl-assistant-send');
    const micButton = assistantRoot.querySelector('.hl-assistant-mic');
    const clearButton = assistantRoot.querySelector('.hl-assistant-clear');
    const modeButtons = assistantRoot.querySelectorAll('.hl-assistant-mode-btn');
    const endButton = assistantRoot.querySelector('.hl-assistant-end-btn');

    function syncSessionStorage() {
      if (window.HLAssistantSession && window.HLAssistantSession.saveSession) {
        window.HLAssistantSession.saveSession(state.session);
      }
    }

    function updateActiveContext() {
      if (!window.HLAssistantContext) return;
      const context = window.HLAssistantContext.buildContext(state.session);
      state.session.currentPage = context.currentPage;
      state.session.previousPage = context.previousPage;
      state.session.subject = context.subject || state.session.subject || 'general';
      state.session.grade = context.grade || state.session.grade || '';
      if (context.activeTopic) state.session.activeTopic = context.activeTopic;
      state.session.lastActivity = Date.now();
      syncSessionStorage();
    }

    function setStatus(nextStatus) {
      state.status = nextStatus;
      assistantRoot.setAttribute('data-state', nextStatus);
      if (nextStatus === 'listening') {
        window.HLAssistantUI && window.HLAssistantUI.setOrbNotice('Listening...');
      } else if (nextStatus === 'thinking') {
        window.HLAssistantUI && window.HLAssistantUI.setOrbNotice('Thinking...');
      } else if (nextStatus === 'speaking') {
        window.HLAssistantUI && window.HLAssistantUI.setOrbNotice('Speaking...');
      } else {
        window.HLAssistantUI && window.HLAssistantUI.setOrbNotice(state.session && state.session.messages && state.session.messages.length ? 'I\'m still here 👋' : '');
      }
    }

    function renderAssistantMessage(text, type = 'assistant') {
      const message = document.createElement('div');
      message.className = `hl-assistant-message ${type}`;
      message.innerHTML = sanitizeHtml(text);
      messagesBox.appendChild(message);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function renderSuggestions(items) {
      suggestionsBox.innerHTML = '';
      const safeItems = (items || []).slice(0, 4);
      safeItems.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hl-assistant-suggestion';
        button.textContent = item.title || item.url;
        button.setAttribute('aria-label', `Open ${item.title || item.url}`);
        button.addEventListener('click', () => {
          if (item.url) {
            window.location.href = item.url;
          }
        });
        suggestionsBox.appendChild(button);
      });
    }

    function buildQuickSuggestions() {
      const subject = getSubjectContext(window.location.pathname || window.location.href);
      const homePage = 'https://houselearning.org/home';
      const defaultPrompts = strings.defaultPrompts || {};
      const generated = [
        { title: defaultPrompts.lesson || 'Find a lesson', url: homePage },
        { title: defaultPrompts.math || 'Help me with math', url: 'https://houselearning.org/home/math-page.html' },
        { title: defaultPrompts.coding || 'Learn coding', url: 'https://houselearning.org/home/computer-science-page.html' },
        { title: defaultPrompts.science || 'Explore science', url: 'https://houselearning.org/home/science-page.html' }
      ];

      if (subject === 'math') {
        generated[1].url = 'https://houselearning.org/home/math-page.html';
      } else if (subject === 'coding') {
        generated[2].url = 'https://houselearning.org/home/computer-science-page.html';
      } else if (subject === 'science') {
        generated[3].url = 'https://houselearning.org/home/science-page.html';
      }

      return generated;
    }

    async function refreshSuggestions(query = '') {
      let results = [];
      if (window.HLAssistantSitemap && typeof window.HLAssistantSitemap.getRelevant === 'function') {
        results = await window.HLAssistantSitemap.getRelevant(query || state.session.activeTopic || 'lesson', 4);
      }
      if (!results.length) {
        results = buildQuickSuggestions();
      }
      state.currentSuggestions = results;
      renderSuggestions(results);
    }

    function updateModeButtons() {
      modeButtons.forEach((button) => {
        const active = button.dataset.mode === state.mode;
        button.classList.toggle('hl-assistant-mode-btn-active', active);
      });
      if (state.mode === 'voice') {
        micButton.classList.add('active');
      } else {
        micButton.classList.remove('active');
      }
    }

    function maybeCreateSafeAiBubble() {
      const seenKey = 'houselearning_safeai_intro_seen';
      let seen = false;
      try {
        seen = localStorage.getItem(seenKey) === 'true';
      } catch (_error) {
        seen = false;
      }

      if (seen) return;

      const bubble = document.createElement('div');
      bubble.className = 'hl-safeai-bubble';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      bubble.innerHTML = `
        <span class="hl-safeai-bubble-main">Hello, I'm SafeAI. Your personal helper friend.</span>
        <span class="hl-safeai-bubble-extra">Ask me everything... I know everything.</span>
      `;

      const markSeen = () => {
        try {
          localStorage.setItem(seenKey, 'true');
        } catch (_error) {
          // ignore storage failures
        }
      };

      bubble.addEventListener('mouseenter', markSeen);
      bubble.addEventListener('focusin', markSeen);
      bubble.addEventListener('click', markSeen);
      assistantRoot.insertBefore(bubble, orb);
    }

    function maybeWelcomeBack() {
      if (!state.session || !state.session.messages || state.session.messages.length === 0) return;
      if (state.session.welcomeShown) return;
      if (state.session.currentPage && state.session.previousPage && state.session.currentPage.url !== state.session.previousPage.url) {
        renderAssistantMessage('Welcome back! We were working on ' + (state.session.activeTopic || 'your lesson') + '. Want to keep going?', 'assistant');
        state.session.welcomeShown = true;
        syncSessionStorage();
      }
    }

    async function handleUserMessage(messageText) {
      const cleanMessage = safeText(messageText);
      if (!cleanMessage) return;

      if (window.HLAssistantSession) {
        state.session = window.HLAssistantSession.addMessage(state.session, 'user', cleanMessage);
      }

      renderAssistantMessage(cleanMessage, 'user');
      setStatus('thinking');

      updateActiveContext();
      let recommendations = state.currentSuggestions;
      if (window.HLAssistantSitemap && typeof window.HLAssistantSitemap.getRelevant === 'function') {
        recommendations = await window.HLAssistantSitemap.getRelevant(cleanMessage, 4);
      }

      const context = {
        backend,
        translations: strings,
        recommendations,
        session: state.session,
        page: {
          pathname: window.location.pathname,
          title: document.title,
          subject: getSubjectContext(window.location.pathname || window.location.href)
        }
      };

      try {
        const response = await askAssistant(cleanMessage, context);
        const responseText = safeText(response?.text || strings.responseFallback || 'I can help with that.');
        renderAssistantMessage(responseText, 'assistant');
        if (window.HLAssistantSession) {
          state.session = window.HLAssistantSession.addMessage(state.session, 'assistant', responseText);
          if (response?.suggestions?.length) {
            state.session.activeTopic = state.session.activeTopic || 'learning';
          }
        }

        if (response?.suggestions?.length) {
          renderSuggestions(response.suggestions);
        } else if (recommendations.length) {
          renderSuggestions(recommendations);
        }
        syncSessionStorage();
        setStatus('idle');
      } catch (_error) {
        setStatus('error');
        renderAssistantMessage(strings.error || 'Oops! I couldn\'t do that. Try again?', 'assistant');
        setStatus('idle');
      }
    }

    function sendInput() {
      const value = input.value.trim();
      if (!value) return;
      input.value = '';
      input.style.height = '42px';
      handleUserMessage(value);
    }

    function toggleOpen(forceOpen) {
      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.open;
      state.open = shouldOpen;
      assistantRoot.setAttribute('data-open', String(shouldOpen));
      orb.setAttribute('aria-expanded', String(shouldOpen));
      if (shouldOpen) {
        input.focus();
        if (state.session && state.session.messages && state.session.messages.length) {
          maybeWelcomeBack();
        }
      }
    }

    function endConversation() {
      if (window.HLAssistantVoice && window.HLAssistantVoice.stopSpeaking) {
        window.HLAssistantVoice.stopSpeaking();
      }
      if (state.recognitionSession && typeof state.recognitionSession.stop === 'function') {
        state.recognitionSession.stop();
      }
      if (window.HLAssistantSession) {
        state.session = window.HLAssistantSession.createSession(state.language, {
          guidedMode: state.guidedMode,
          mode: state.mode,
          currentPage: window.HLAssistantContext ? window.HLAssistantContext.getCurrentPageInfo() : null
        });
      }
      if (window.HLAssistantStorage && window.HLAssistantStorage.clearSession) {
        window.HLAssistantStorage.clearSession();
      }
      messagesBox.innerHTML = '';
      renderAssistantMessage('Conversation ended. I\'ll be here when you are ready to learn again!', 'assistant');
      setStatus('idle');
      if (window.HLAssistantUI) {
        window.HLAssistantUI.clearSessionIndicator();
      }
    }

    function attachVoiceListener() {
      if (!window.HLAssistantVoice || !window.HLAssistantVoice.isSupported) {
        renderAssistantMessage('Voice input isn\'t supported in this browser. You can type instead.', 'assistant');
        return;
      }
      state.mode = 'voice';
      updateModeButtons();
      setStatus('listening');
      state.recognitionSession = window.HLAssistantVoice.listenForSpeech({
        language: state.language,
        onResult: (transcript) => {
          input.value = transcript;
          handleUserMessage(transcript);
        },
        onError: () => {
          setStatus('error');
          renderAssistantMessage(strings.error || 'Oops! I couldn\'t do that. Try again?', 'assistant');
          setStatus('idle');
        },
        onStart: () => setStatus('listening'),
        onEnd: () => setStatus('idle')
      });
    }

    function speakCurrentResponse(text) {
      if (!window.HLAssistantVoice || !window.HLAssistantVoice.speakText) return;
      setStatus('speaking');
      window.HLAssistantVoice.speakText(text, state.language, 1, 1).finally(() => setStatus('idle'));
    }

    function handleModeChange(mode) {
      state.mode = mode;
      if (mode === 'voice') {
        updateModeButtons();
        attachVoiceListener();
      } else if (mode === 'keyboard') {
        updateModeButtons();
        if (state.recognitionSession && typeof state.recognitionSession.stop === 'function') {
          state.recognitionSession.stop();
        }
        input.focus();
      } else if (mode === 'guided') {
        state.guidedMode = !state.guidedMode;
        updateModeButtons();
        if (window.HLAssistantUI) {
          window.HLAssistantUI.createSessionIndicator(state.guidedMode ? 'Learning session active' : 'Guided mode off');
        }
      }
      syncSessionStorage();
    }

    orb.addEventListener('click', () => toggleOpen());
    clearButton.addEventListener('click', () => {
      messagesBox.innerHTML = '';
      setStatus('idle');
      if (window.HLAssistantSession) {
        state.session.messages = [];
        state.session.activeTopic = '';
      }
      syncSessionStorage();
    });

    sendButton.addEventListener('click', sendInput);
    micButton.addEventListener('click', attachVoiceListener);
    endButton.addEventListener('click', endConversation);

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetMode = button.dataset.mode;
        if (targetMode === 'guided') {
          state.guidedMode = !state.guidedMode;
          state.session.guidedMode = state.guidedMode;
          if (window.HLAssistantUI) {
            window.HLAssistantUI.createSessionIndicator(state.guidedMode ? 'Learning session active' : 'Guided mode off');
          }
          updateModeButtons();
          syncSessionStorage();
          return;
        }
        state.mode = targetMode;
        updateModeButtons();
        if (state.mode === 'voice') {
          attachVoiceListener();
        }
      });
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendInput();
      }
      if (event.key === 'Escape') {
        toggleOpen(false);
      }
    });

    languageSelect.value = state.language;
    languageSelect.addEventListener('change', (event) => {
      const nextLang = event.target.value;
      if (window.HLAssistantI18n) {
        window.HLAssistantI18n.setLanguagePreference(nextLang);
      }
      state.language = nextLang;
      state.session.language = nextLang;
      syncSessionStorage();
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        toggleOpen(false);
      }
    });

    document.body.appendChild(assistantRoot);
    maybeCreateSafeAiBubble();
    if (window.HLAssistantUI) {
      window.HLAssistantUI.setOrbNotice(state.session.messages?.length ? 'I\'m still here 👋' : '');
    }
    updateActiveContext();
    refreshSuggestions(state.session.activeTopic || 'lesson');
    toggleOpen(true);

    if (state.session && state.session.messages && state.session.messages.length) {
      state.session.messages.forEach((item) => {
        renderAssistantMessage(item.text, item.role === 'user' ? 'user' : 'assistant');
      });
      if (state.session.messages.length > 0) {
        renderAssistantMessage('Welcome back! We were working on ' + (state.session.activeTopic || 'your lesson') + '. Want to keep going?', 'assistant');
      }
    } else {
      renderAssistantMessage(strings.idle || 'Hi! I\'m your HouseLearning assistant.', 'assistant');
    }

    if (window.HLAssistantSitemap && typeof window.HLAssistantSitemap.init === 'function') {
      window.HLAssistantSitemap.init().then(() => refreshSuggestions(state.session.activeTopic || 'lesson')).catch(() => refreshSuggestions(state.session.activeTopic || 'lesson'));
    }

    updateModeButtons();
    syncSessionStorage();

    return {
      root: assistantRoot,
      session: state.session,
      sendInput,
      toggleOpen,
      setStatus,
      speak: () => {
        setStatus('speaking');
        if (window.HLAssistantVoice) {
          const text = state.session && state.session.activeTopic ? `We are working on ${state.session.activeTopic}.` : strings.idle || 'Hi! I\'m here to help.';
          window.HLAssistantVoice.speakText(text, state.language, 1, 1).finally(() => setStatus('idle'));
        }
      },
      endConversation
    };
  }

  function init() {
    if (document.querySelector('.hl-assistant')) return;
    const start = () => {
      initAssistant({ sitemap: DEFAULT_SITEMAP_URL, defaultLanguage: DEFAULT_LANG, backend: defaultAssistantBackend }).catch(() => {
        // final fallback: allow the widget to render even if the modular scripts fail to load
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }

    start();
  }

  function createSafeAIController() {
    const SAFE_AI_KEY = 'houselearning_safeai_enabled';
    function isEnabled() {
      try {
        const value = localStorage.getItem(SAFE_AI_KEY);
        if (value === null) return true;
        return value !== 'false';
      } catch (_error) {
        return true;
      }
    }

    function setEnabled(enabled) {
      try {
        localStorage.setItem(SAFE_AI_KEY, String(Boolean(enabled)));
      } catch (_error) {
        // ignore storage failures
      }
    }

    window.HLAssistantSafeAI = {
      isEnabled,
      setEnabled,
      getStatus: isEnabled
    };
  }

  createSafeAIController();

  window.HouseLearningAssistant = {
    init,
    askAssistant,
    createSystemPrompt,
    defaultAssistantBackend,
    getSubjectContext
  };

  init();
})();
