(function () {
  const authUrl = 'https://houselearning.org/auth/';
  const firebaseConfig = { apiKey: 'AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw', authDomain: 'contract-center-llc-10.firebaseapp.com', projectId: 'contract-center-llc-10', storageBucket: 'contract-center-llc-10.firebasestorage.app', messagingSenderId: '323221512767', appId: '1:323221512767:web:6421260f875997dbf64e8a' };
  let popup;
  let featurePopup;
  let currentUser = null;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .lesson-auth-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15, 23, 42, .48); }
      .lesson-auth-dialog { position: relative; width: min(100%, 390px); padding: 28px 24px 20px; background: #fff; color: #1f2937; border: 1px solid #dfe6e9; border-radius: 16px; box-shadow: 0 18px 45px rgba(15, 23, 42, .25); font-family: 'Segoe UI', sans-serif; }
      .lesson-auth-dialog h2 { margin: 0 0 14px; font-size: 21px; }
      .lesson-auth-dialog p { margin: 0 0 24px; line-height: 1.55; }
      .lesson-auth-close { position: absolute; top: 8px; right: 12px; border: 0; background: transparent; color: #374151; font-size: 30px; line-height: 1; cursor: pointer; }
      .lesson-auth-actions { display: flex; gap: 12px; justify-content: flex-end; }
      .lesson-auth-actions button { min-width: 126px; padding: 11px 16px; border-radius: 8px; border: 1px solid #9b59b6; font: inherit; font-weight: 700; cursor: pointer; }
      .lesson-auth-signin { background: #9b59b6; color: #fff; }
      .lesson-auth-keep { background: #fff; color: #6c3483; }
      .lesson-auth-video-blocker { position: absolute; inset: 0; z-index: 20; width: 100%; height: 100%; border: 0; background: rgba(15,23,42,.82); color: #fff; font: 700 16px 'Segoe UI', sans-serif; cursor: pointer; }
      .interactive-video-button { display: block; width: 100%; margin-top: 16px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.65); border-radius: 8px; background: rgba(255,255,255,.16); color: #fff; font: 700 13px 'Segoe UI', sans-serif; cursor: pointer; }
      .interactive-video-button:hover:not(:disabled) { background: rgba(255,255,255,.28); }
      .interactive-video-button:disabled { opacity: .58; cursor: not-allowed; }
      body > footer { position: fixed; right: 0; bottom: 0; left: 0; width: 100%; z-index: 10; }
      @media (max-width: 480px) { .lesson-auth-actions { flex-direction: column-reverse; } .lesson-auth-actions button { width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function showPopup(message = 'Sign in to complete this lesson.') {
    if (popup) return;
    popup = document.createElement('div');
    popup.className = 'lesson-auth-overlay';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.innerHTML = `
      <div class="lesson-auth-dialog">
        <button class="lesson-auth-close" type="button" aria-label="Close">&times;</button>
        <h2>You are not signed in.</h2>
        <p>${message}</p>
        <div class="lesson-auth-actions">
          <button class="lesson-auth-signin" type="button">Sign in</button>
          <button class="lesson-auth-keep" type="button">Ok</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    popup.querySelector('.lesson-auth-signin').onclick = () => { window.location.href = authUrl; };
    popup.querySelector('.lesson-auth-keep').onclick = closePopup;
    popup.querySelector('.lesson-auth-close').onclick = closePopup;
  }

  function closePopup() {
    if (!popup) return;
    popup.remove();
    popup = null;
  }

  function initInteractiveVideoButton() {
    const header = document.querySelector('.nav-header');
    if (!header || header.querySelector('.interactive-video-button')) return;
    const parts = location.pathname.split('/').filter(Boolean);
    const subject = parts.includes('science') ? 'science' : 'math';
    const lesson = (parts[parts.length - 1] || '').replace(/\.html$/, '');
    const href = `/home/${subject}/interactive/${lesson}.html`;
    const link = document.createElement('a');
    link.href = href;
    link.className = 'interactive-video-button';
    link.textContent = 'Interactive Video Lesson';
    link.setAttribute('data-href', href);
    link.setAttribute('aria-disabled', String(!currentUser));
    link.title = currentUser ? 'Open the interactive video lesson' : 'Sign in to enable this lesson';
    if (!currentUser) {
      link.removeAttribute('href');
      link.onclick = event => {
        event.preventDefault();
        showPopup('Sign in to unlock the interactive video lesson.');
      };
    } else {
      link.onclick = event => {
        if (!link.href) {
          event.preventDefault();
          return;
        }
      };
    }
    header.appendChild(link);
  }

  function updateInteractiveVideoButton() {
    const button = document.querySelector('.interactive-video-button');
    if (!button) return;
    const href = button.getAttribute('data-href');
    if (!currentUser) {
      button.removeAttribute('href');
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Sign in to enable this lesson';
      button.onclick = event => {
        event.preventDefault();
        showPopup('Sign in to unlock the interactive video lesson.');
      };
    } else {
      button.href = href;
      button.setAttribute('aria-disabled', 'false');
      button.title = 'Open the interactive video lesson';
      button.onclick = null;
    }
  }

  window.showLessonAuthPopup = showPopup;

  function isFinalItem(target) {
    const item = target.closest('.nav-item, [data-final-lesson], [data-mastery-lesson]');
    return item && (item.hasAttribute('data-final-lesson') || item.hasAttribute('data-mastery-lesson') || /graduat|mastery|architect|terminal|final|complete|output/i.test(item.textContent));
  }

  function blockUnsignedActions(event) {
    if (currentUser) return;
    const target = event.target;
    const video = target.closest('iframe, video, .video-container, [data-lesson-video]');
    if (video || isFinalItem(target)) {
      event.preventDefault();
      event.stopPropagation();
      showPopup();
    }
  }

  function blockVideoPlayback() {
    if (currentUser) return;
    document.querySelectorAll('iframe, video, .video-container, [data-lesson-video]').forEach(video => {
      if (video.dataset.authBlocked) return;
      const parent = video.closest('.video-container') || video;
      if (parent.querySelector('.lesson-auth-video-blocker')) return;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      const blocker = document.createElement('button');
      blocker.type = 'button';
      blocker.className = 'lesson-auth-video-blocker';
      blocker.textContent = 'Sign in to watch this video';
      blocker.onclick = event => { event.preventDefault(); event.stopPropagation(); showPopup(); };
      parent.appendChild(blocker);
      video.dataset.authBlocked = 'true';
    });
  }

  function unblockVideoPlayback() {
    document.querySelectorAll('.lesson-auth-video-blocker').forEach(blocker => blocker.remove());
    document.querySelectorAll('[data-auth-blocked]').forEach(video => delete video.dataset.authBlocked);
  }

  function loadSiteScripts() {
    [
      ['script', 'https://www.houselearning.org/feedback.js'],
      ['script', 'https://www.houselearning.org/home/also.js', 'module'],
      ['script', '/cookiebanner.js']
    ].forEach(([tagName, src, type]) => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const script = document.createElement(tagName);
      script.src = src;
      if (type) script.type = type;
      document.head.appendChild(script);
    });
  }

  function watchAuth() {
    if (!window.firebase || !firebase.auth) {
      window.setTimeout(watchAuth, 100);
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged(user => { currentUser = user; updateInteractiveVideoButton(); if (user) { closePopup(); unblockVideoPlayback(); } else blockVideoPlayback(); });
    document.addEventListener('click', blockUnsignedActions, true);
    blockVideoPlayback();
    initInteractiveVideoButton();
  }

  injectStyles();
  loadSiteScripts();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchAuth);
  else watchAuth();
})();
