(function () {
  if (window.HouseLearningSiteRuntime?.ready) return;
  window.HouseLearningSiteRuntime = { ready: true };

  const currentScript = document.currentScript;
  const baseUrl = currentScript && currentScript.src
    ? new URL('.', currentScript.src)
    : new URL('/home/', window.location.origin);
  const localPreview = window.location.protocol === 'file:'
    || /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
  const gamesPage = window.location.pathname === '/home/games.html'
    || window.location.pathname.startsWith('/home/games/');
  const safeLibraryPage = window.location.pathname.startsWith('/safe-library/');
  const hasExistingAssistant = safeLibraryPage || window.HL_SAFEAI_BOOTSTRAPPED
    || Boolean(document.querySelector('.hl-assistant'))
    || Array.from(document.scripts).some(script => /(?:^|\/)assistant\/assistant(?:-loader)?\.js(?:[?#]|$)/i.test(script.src));

  function loadScript(relativePath, marker) {
    if (document.querySelector(`script[data-houselearning-runtime-part="${marker}"]`)) return;
    const script = document.createElement('script');
    script.src = new URL(relativePath, baseUrl).href;
    script.defer = true;
    script.dataset.houselearningRuntimePart = marker;
    (document.head || document.documentElement).append(script);
  }

  loadScript('site-navigation.js', 'navigation');
  if (!localPreview && !gamesPage && !hasExistingAssistant) loadScript('assistant/assistant-loader.js', 'safeai');
})();