(function () {
  function createSessionIndicator(text) {
    const existing = document.querySelector('.hl-assistant-session-indicator');
    if (existing) existing.remove();

    const pill = document.createElement('div');
    pill.className = 'hl-assistant-session-indicator';
    pill.textContent = text;
    document.body.appendChild(pill);
    return pill;
  }

  function clearSessionIndicator() {
    const existing = document.querySelector('.hl-assistant-session-indicator');
    if (existing) existing.remove();
  }

  function setOrbNotice(text) {
    const orb = document.querySelector('.hl-assistant-orb');
    if (!orb) return;
    const label = orb.querySelector('.hl-assistant-orb-label');
    if (label) label.title = text;
    orb.setAttribute('data-notice', text || '');
  }

  window.HLAssistantUI = {
    createSessionIndicator,
    clearSessionIndicator,
    setOrbNotice
  };
})();
