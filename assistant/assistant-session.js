(function () {
  function makeSessionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createSession(language = 'en', options = {}) {
    const now = Date.now();
    const signedIn = options.user && options.user.signedIn;
    return {
      sessionId: makeSessionId(),
      sessionType: signedIn ? 'signed-in' : 'anonymous',
      language: language || 'en',
      activeTopic: options.activeTopic || '',
      subject: options.subject || 'general',
      grade: options.grade || '',
      guidedMode: options.guidedMode !== false,
      mode: options.mode || 'keyboard',
      conversationStarted: now,
      lastActivity: now,
      currentPage: options.currentPage || null,
      previousPage: options.previousPage || null,
      messages: options.messages || [],
      user: signedIn ? { id: options.user.id, signedIn: true } : null,
      welcomeShown: false
    };
  }

  function restoreFromStorage(language = 'en') {
    const stored = window.HLAssistantStorage && window.HLAssistantStorage.readSession ? window.HLAssistantStorage.readSession() : null;
    if (!stored) return createSession(language);

    const next = {
      ...createSession(stored.language || language, {
        activeTopic: stored.activeTopic,
        subject: stored.subject,
        grade: stored.grade,
        guidedMode: stored.guidedMode,
        mode: stored.mode,
        currentPage: stored.currentPage,
        previousPage: stored.previousPage,
        messages: stored.messages || [],
        user: stored.user || null
      }),
      sessionId: stored.sessionId || makeSessionId(),
      sessionType: stored.sessionType || 'anonymous',
      conversationStarted: stored.conversationStarted || Date.now(),
      lastActivity: Date.now(),
      welcomeShown: Boolean(stored.welcomeShown)
    };

    return next;
  }

  function saveSession(session) {
    if (!session) return false;
    session.lastActivity = Date.now();
    if (window.HLAssistantStorage && window.HLAssistantStorage.saveSession) {
      return window.HLAssistantStorage.saveSession(session);
    }
    return false;
  }

  function addMessage(session, role, text) {
    if (!session) return session;
    const messageText = String(text || '').trim();
    if (!messageText) return session;
    if (!Array.isArray(session.messages)) session.messages = [];
    session.messages.push({ role, text: messageText, at: Date.now() });
    session.lastActivity = Date.now();
    session.activeTopic = session.activeTopic || guessTopicFromText(messageText);
    return session;
  }

  function guessTopicFromText(text) {
    const value = String(text || '').toLowerCase();
    if (/fractions?|fraction/.test(value)) return 'fractions';
    if (/algebra|equation|variables?/.test(value)) return 'algebra';
    if (/python|javascript|coding|programming/.test(value)) return 'coding';
    if (/science|biology|physics|chemistry/.test(value)) return 'science';
    if (/math|mathematics/.test(value)) return 'math';
    return '';
  }

  function clearSession() {
    if (window.HLAssistantStorage && window.HLAssistantStorage.clearSession) {
      window.HLAssistantStorage.clearSession();
    }
  }

  function updateContext(session, context) {
    if (!session) return session;
    const oldPage = session.currentPage || null;
    session.previousPage = oldPage && oldPage.url !== context.currentPage.url ? oldPage : session.previousPage;
    session.currentPage = context.currentPage;
    session.subject = context.subject || session.subject || 'general';
    session.grade = context.grade || session.grade || '';
    if (context.activeTopic) session.activeTopic = context.activeTopic;
    session.lastActivity = Date.now();
    return session;
  }

  window.HLAssistantSession = {
    createSession,
    restoreFromStorage,
    saveSession,
    addMessage,
    clearSession,
    updateContext,
    guessTopicFromText
  };
})();
