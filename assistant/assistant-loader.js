(function () {
  if (window.HL_SAFEAI_BOOTSTRAPPED) return;
  const currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) return;

  window.HL_SAFEAI_BOOTSTRAPPED = true;
  window.HL_ASSISTANT_BASE_URL = new URL('.', currentScript.src).href.replace(/\/$/, '');

  if (!document.querySelector('link[data-hl-safeai-css="true"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `${window.HL_ASSISTANT_BASE_URL}/assistant.css`;
    stylesheet.dataset.hlSafeaiCss = 'true';
    document.head.append(stylesheet);
  }

  if (!document.querySelector('script[data-hl-safeai-script="true"]')) {
    const assistant = document.createElement('script');
    assistant.src = `${window.HL_ASSISTANT_BASE_URL}/assistant.js`;
    assistant.defer = true;
    assistant.dataset.hlSafeaiScript = 'true';
    document.body.append(assistant);
  }
})();