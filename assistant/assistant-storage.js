(function () {
  const STORAGE_KEY = 'hl_assistant_session_v1';
  const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

  function getStorage() {
    try {
      const testKey = '__hl_assistant_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch (_error) {
      return null;
    }
  }

  function getSignedInUser() {
    const candidates = [
      window.HouseLearningAuth,
      window.houselearningAuth,
      window.user,
      window.currentUser,
      window.HouseLearningUser,
      window.houselearningUser
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate.id || candidate.uid || candidate.userId) {
        return { id: candidate.id || candidate.uid || candidate.userId, signedIn: Boolean(candidate.signedIn !== false) };
      }
      if (candidate.signedIn && (candidate.id || candidate.uid || candidate.userId)) {
        return { id: candidate.id || candidate.uid || candidate.userId, signedIn: true };
      }
    }

    try {
      if (window.firebase && window.firebase.auth && typeof window.firebase.auth === 'function') {
        const currentUser = window.firebase.auth().currentUser;
        if (currentUser && currentUser.uid) {
          return { id: currentUser.uid, signedIn: true };
        }
      }
    } catch (_error) {
      // ignore firebase lookup errors
    }

    return null;
  }

  function getStorageKey() {
    const signedIn = getSignedInUser();
    if (signedIn && signedIn.id) return `hl_assistant_session_user_${signedIn.id}`;
    return STORAGE_KEY;
  }

  function readSession() {
    const store = getStorage();
    if (!store) return null;

    try {
      const raw = store.getItem(getStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.sessionId) return null;
      const expired = Date.now() - (parsed.lastActivity || parsed.startedAt || Date.now()) > SESSION_TIMEOUT_MS;
      if (expired) {
        store.removeItem(getStorageKey());
        return null;
      }
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function saveSession(session) {
    const store = getStorage();
    if (!store) return false;
    try {
      const payload = {
        ...session,
        lastActivity: Date.now(),
        sessionType: session.sessionType || (getSignedInUser() ? 'signed-in' : 'anonymous')
      };
      store.setItem(getStorageKey(), JSON.stringify(payload));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function clearSession() {
    const store = getStorage();
    if (!store) return;
    store.removeItem(getStorageKey());
  }

  function hasStorage() {
    return Boolean(getStorage());
  }

  window.HLAssistantStorage = {
    STORAGE_KEY,
    readSession,
    saveSession,
    clearSession,
    hasStorage,
    getSignedInUser,
    getStorageKey
  };
})();
