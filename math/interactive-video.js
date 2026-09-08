(function () {
  const firebaseConfig = {
    apiKey: 'AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw',
    authDomain: 'contract-center-llc-10.firebaseapp.com',
    projectId: 'contract-center-llc-10',
    storageBucket: 'contract-center-llc-10.firebasestorage.app',
    messagingSenderId: '323221512767',
    appId: '1:323221512767:web:6421260f875997dbf64e8a'
  };
  let currentUser = null;
  let popup;

  const style = document.createElement('style');
  style.textContent = '.interactive-video-button{display:block;margin:12px auto;padding:10px 14px;border:0;border-radius:8px;background:#3498db;color:#fff;font-weight:700;cursor:pointer}.interactive-video-button:disabled{background:#bdc3c7;cursor:not-allowed}.interactive-video-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.48)}.interactive-video-dialog{position:relative;width:min(100%,390px);padding:28px 24px 20px;background:#fff;color:#1f2937;border-radius:12px;box-shadow:0 18px 45px rgba(15,23,42,.25);font-family:Segoe UI,sans-serif}.interactive-video-dialog h2{margin:0 0 14px}.interactive-video-close{position:absolute;top:8px;right:12px;border:0;background:transparent;font-size:28px;cursor:pointer}';
  document.head.appendChild(style);

  function showPopup() {
    if (popup) return;
    popup = document.createElement('div');
    popup.className = 'interactive-video-overlay';
    popup.setAttribute('role', 'dialog');
    popup.innerHTML = '<div class="interactive-video-dialog"><button class="interactive-video-close" type="button" aria-label="Close">&times;</button><h2>Coming soon!</h2><p>Interactive video lessons are being prepared for this lesson.</p></div>';
    document.body.appendChild(popup);
    popup.querySelector('button').onclick = () => { popup.remove(); popup = null; };
  }

  function init(user) {
    currentUser = user;
    const target = document.querySelector('.nav-header, header') || document.body;
    if (!target.querySelector('.interactive-video-button')) {
      const parts = location.pathname.split('/').filter(Boolean);
      const lesson = (parts[parts.length - 1] || '').replace(/\.html$/, '');
      const href = `/math/interactive/${lesson}.html`;
      const link = document.createElement('a');
      link.className = 'interactive-video-button';
      link.textContent = 'Interactive Video Lesson';
      link.href = href;
      link.setAttribute('data-href', href);
      link.title = currentUser ? 'Open the interactive video lesson' : 'Sign in to enable this lesson';
      if (!currentUser) {
        link.removeAttribute('href');
        link.onclick = event => {
          event.preventDefault();
          showPopup();
        };
      }
      target.insertBefore(link, target.firstChild);
    }
    const button = target.querySelector('.interactive-video-button');
    if (!currentUser) {
      button.removeAttribute('href');
      button.setAttribute('aria-disabled', 'true');
      button.title = 'Sign in to enable this lesson';
      button.onclick = event => {
        event.preventDefault();
        showPopup();
      };
    } else {
      button.href = button.getAttribute('data-href');
      button.setAttribute('aria-disabled', 'false');
      button.title = 'Open the interactive video lesson';
      button.onclick = null;
    }
  }

  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function boot() {
    if (!window.firebase) await load('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
    if (!window.firebase.auth) await load('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged(init);
    init(null);
  }

  boot().catch(() => init(null));
})();
