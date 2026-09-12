// main.js

// 🚨 FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

// Initialize Firebase App
let auth = null;
let db = null;
try {
    if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        if (typeof firebase.firestore === 'function') {
            db = firebase.firestore();
        } else {
            console.warn('Firestore SDK is not loaded; notifications are disabled.');
        }
    } else {
        console.warn('Firebase SDK not found; notifications are disabled.');
    }
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

// Global Variables
let notificationsUnsubscribe = null;
let latestNotifications = []; 
let notifReminderTimer = null; 
const NOTIF_REMINDER_DISMISS_KEY = 'houselearning_notif_reminder_dismissed_at'; 

// Dynamic Element References
let profileContainer = null;
let profilePic = null;
let accountDropdown = null;
let signUpButton = null;
let anonymousPopup = null; 

const POPUP_DISMISS_KEY = 'houselearning_popup_dismissed'; 
const AUTH_PAGE_URL = 'https://houselearning.org/auth/';
const GITHUB_URL = 'https://github.com/houselearning'; 

// ====================================================================
// 1. DYNAMIC CSS INJECTION
// ====================================================================
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --hl-bg: #f3f6fb;
            --hl-bg-strong: #edf4ff;
            --hl-surface: #ffffff;
            --hl-surface-strong: #f8fbff;
            --hl-surface-alt: #f4f8ff;
            --hl-text: #1f2937;
            --hl-text-soft: #5b6b7d;
            --hl-border: rgba(31, 41, 55, 0.12);
            --hl-primary: #facc15;
            --hl-primary-strong: #f9d342;
            --hl-primary-deep: #d9a300;
            --hl-secondary: #61dafb;
            --hl-secondary-strong: #2bb7eb;
            --hl-secondary-deep: #1b5bb8;
            --hl-navbar: #20232a;
            --hl-navbar-soft: #2a3140;
            --hl-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
            --hl-shadow-strong: 0 18px 42px rgba(15, 23, 42, 0.22);
            --hl-button-text: #111827;
        }

        body {
            background: linear-gradient(180deg, var(--hl-bg-strong), var(--hl-bg));
            color: var(--hl-text);
        }

        body.dark-mode {
            --hl-bg: #0d1320;
            --hl-bg-strong: #101827;
            --hl-surface: #171f2d;
            --hl-surface-strong: #1d2940;
            --hl-surface-alt: #101a2b;
            --hl-text: #edf3ff;
            --hl-text-soft: #a7b6ce;
            --hl-border: rgba(148, 163, 184, 0.18);
            --hl-primary: #facc15;
            --hl-primary-strong: #f9d342;
            --hl-primary-deep: #efb500;
            --hl-secondary: #61dafb;
            --hl-secondary-strong: #40c4ff;
            --hl-secondary-deep: #a7dcff;
            --hl-navbar: #121a24;
            --hl-navbar-soft: #1d2a3a;
            --hl-shadow: 0 18px 32px rgba(2, 6, 23, 0.36);
            --hl-shadow-strong: 0 20px 42px rgba(2, 6, 23, 0.48);
            --hl-button-text: #111827;
        }

        body,
        .section,
        .card,
        .lesson-card,
        .game-card,
        .games-layout,
        .games,
        .sidebar,
        .lesson-panel,
        .container,
        .container > * {
            transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        body,
        .section,
        .card,
        .lesson-card,
        .game-card,
        .games,
        .games-layout,
        .sidebar,
        .lesson-panel,
        .content-wrapper,
        .main-content,
        .search-bar input,
        .warped-search,
        .search-input {
            background-color: var(--hl-surface);
            color: var(--hl-text);
        }

        .navbar,
        .navbar-inner,
        header,
        .navbar-content {
            background-color: var(--hl-navbar);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .navbar a,
        .navbar-content a,
        .navbar-inner a,
        .navbar a:visited,
        .games a,
        .section a,
        .lesson-card a,
        .game-card a,
        .card a,
        .hl-button,
        .menu-link,
        .games-layout a,
        .games a:visited {
            color: var(--hl-secondary-deep);
        }

        .navbar a:hover,
        .navbar a:focus,
        .games a:hover,
        .section a:hover,
        .lesson-card a:hover,
        .game-card a:hover,
        .card a:hover,
        .hl-button:hover,
        .games-layout a:hover {
            color: var(--hl-button-text);
        }

        .navbar a,
        .navbar-content a,
        .navbar-inner a,
        .games a,
        .section a,
        .lesson-card a,
        .game-card a,
        .card a,
        .hl-button,
        .games-layout a {
            text-decoration: none;
            border-radius: 10px;
            border: 1px solid transparent;
            transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
        }

        .navbar a:hover,
        .navbar a:focus,
        .games a:hover,
        .section a:hover,
        .lesson-card a:hover,
        .game-card a:hover,
        .card a:hover,
        .hl-button:hover,
        .games-layout a:hover {
            background: linear-gradient(135deg, var(--hl-primary), var(--hl-primary-strong));
            border-color: rgba(17, 24, 39, 0.08);
            transform: translateY(-1px);
        }

        .card,
        .game-card,
        .lesson-card,
        .section,
        .games,
        .games-layout,
        .sidebar,
        .lesson-panel,
        .search-bar input,
        .search-bar,
        .game-card,
        .lesson-card,
        .card {
            border: 1px solid var(--hl-border);
            box-shadow: var(--hl-shadow);
        }

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
            color: var(--hl-text);
        }

        .section h2,
        .games-layout h1,
        .games h2,
        .games h3,
        .lesson-card h3,
        .game-card h3,
        .card h2,
        .card h3 {
            color: var(--hl-secondary-deep);
            border-color: var(--hl-primary);
        }

        body.dark-mode .section h2,
        body.dark-mode .games-layout h1,
        body.dark-mode .games h2,
        body.dark-mode .lesson-card h3,
        body.dark-mode .game-card h3,
        body.dark-mode .card h2,
        body.dark-mode .card h3 {
            color: var(--hl-secondary);
        }

        .theme-switch-wrapper {
            position: fixed;
            right: 18px;
            bottom: 18px;
            z-index: 2000;
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(10px);
            padding: 6px 8px;
            border-radius: 999px;
            border: 1px solid var(--hl-border);
            box-shadow: var(--hl-shadow-strong);
        }

        body.dark-mode .theme-switch-wrapper {
            background: rgba(17, 24, 39, 0.82);
        }

        .theme-switch-wrapper button {
            border: none;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: transparent;
            font-size: 1.1rem;
            cursor: pointer;
            transition: transform 0.15s ease, background 0.15s ease;
            color: var(--hl-text);
        }

        .theme-switch-wrapper button:hover,
        .theme-switch-wrapper button:focus-visible {
            background: rgba(97, 218, 251, 0.15);
            outline: none;
            transform: translateY(-1px);
        }

        .theme-switch-wrapper button[aria-pressed="true"] {
            background: linear-gradient(135deg, var(--hl-primary), var(--hl-primary-strong));
            color: var(--hl-button-text);
            box-shadow: inset 0 -2px 0 rgba(17, 24, 39, 0.12);
        }

        .search-bar input,
        .search-bar {
            border: 1px solid var(--hl-border);
            background: var(--hl-surface);
            color: var(--hl-text);
        }

        .search-bar input:focus {
            outline: none;
            border-color: var(--hl-secondary);
            box-shadow: 0 0 0 3px rgba(97, 218, 251, 0.16);
        }

        /* PFP & Sign Up Button */
        .profile-container { position: fixed; top: 15px; right: 20px; z-index: 2000; display: none; }
        #sign-up-btn { position: fixed; top: 18px; right: 20px; z-index: 2000; display: none; background-color: #61dafb; color: #20232a; padding: 8px 15px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; border: none; }
        .profile-pic { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; object-fit: cover; border: 2px solid #61dafb; transition: transform 0.1s ease; }
        .profile-pic:hover { transform: scale(1.05); }

        /* Dropdown Menu */
        .dropdown-menu { position: absolute; top: 50px; right: -10px; background-color: white; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); border-radius: 12px; z-index: 1000; width: 280px; overflow: hidden; display: none; border: 1px solid #ddd; padding: 10px 0; }
        .dropdown-header { display: flex; flex-direction: column; align-items: center; padding: 15px; text-align: center; border-bottom: 1px solid #f0f0f0; position: relative; }
        .dropdown-pfp { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 3px solid #61dafb; margin-bottom: 10px; }
        .dropdown-username { font-weight: 600; font-size: 16px; color: #20232a; }
        .dropdown-icon { position: absolute; top: 15px; cursor: pointer; }
        #github-icon { left: 15px; }
        #close-icon { right: 15px; }
        .menu-link { color: #555; padding: 10px 25px; text-decoration: none; display: block; font-weight: 500; font-size: 15px; }
        .menu-link:hover { background-color: #f0f8ff; color: #007bff; }
        .logout-container { padding: 15px 25px; border-top: 1px solid #f0f0f0; }
        #logout-dropdown-btn { background-color: #f8f8f8; color: #333; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; border: 1px solid #ccc; width: 100%; }

        .safeai-setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 25px;
            color: #555;
            font-weight: 500;
            font-size: 15px;
        }
        .safeai-toggle {
            position: relative;
            width: 42px;
            height: 24px;
            display: inline-block;
        }
        .safeai-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }
        .safeai-toggle .slider {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            background: #d1d5db;
            transition: background 0.2s ease;
        }
        .safeai-toggle .slider::before {
            content: "";
            position: absolute;
            width: 18px;
            height: 18px;
            left: 3px;
            top: 3px;
            border-radius: 50%;
            background: white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            transition: transform 0.2s ease;
        }
        .safeai-toggle input:checked + .slider {
            background: #34d399;
        }
        .safeai-toggle input:checked + .slider::before {
            transform: translateX(18px);
        }

        /* Notifications */
        .notif-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ff3b30; color: white; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
        .notif-dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: #ff3b30; display: none; }
        
        /* Modal Overlay */
        .notif-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 3000; align-items: center; justify-content: center; padding: 20px; }
        .notif-modal-overlay.show { display: flex; }
        .notif-modal { background: #fff; border-radius: 12px; max-width: 500px; width: 100%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
        .notif-modal-header { padding: 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .notif-modal-body { padding: 10px; overflow-y: auto; }
        .notification-item { padding: 12px; border-bottom: 1px solid #f9f9f9; list-style: none; }
        .notification-item.unread { background-color: #f0f7ff; border-left: 4px solid #007bff; }
        .notif-small-btn { padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; background: #fff; }

        /* Reminder Popup */
        #notif-reminder-popup { position: fixed; top: 80px; right: 20px; width: 280px; background: white; border-radius: 12px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); z-index: 2500; padding: 15px; border: 1px solid #e0e0e0; display: none; }
        #notif-reminder-popup.show { display: block; }
    `;
    document.head.appendChild(style);
}

function injectAssistantWidget() {
    if (document.querySelector('[data-hl-assistant-script]')) return;

    const currentPath = (window.location.pathname || '/').toLowerCase();
    const siteOrigin = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? window.location.origin
        : 'https://houselearning.org';

    const assetBase = currentPath.includes('/home')
        ? `${siteOrigin}/home/assistant`
        : `${siteOrigin}/assistant`;

    const cssUrl = `${assetBase}/assistant.css`;
    if (!document.querySelector(`link[href="${cssUrl}"]`)) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssUrl;
        cssLink.setAttribute('data-hl-assistant-script', 'true');
        document.head.appendChild(cssLink);
    }

    const script = document.createElement('script');
    script.src = `${assetBase}/assistant.js`;
    script.defer = true;
    script.setAttribute('data-hl-assistant-script', 'true');
    document.head.appendChild(script);
}

function initThemeToggle() {
    if (document.querySelector('.theme-switch-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'theme-switch-wrapper';
    wrapper.setAttribute('role', 'toolbar');
    wrapper.setAttribute('aria-label', 'Theme switcher');
    wrapper.innerHTML = `
        <button type="button" data-theme="light" aria-pressed="false" title="Use light mode">☀️</button>
        <button type="button" data-theme="dark" aria-pressed="false" title="Use dark mode">🌙</button>
    `;

    const buttons = wrapper.querySelectorAll('button');
    const themeKey = 'houselearning_theme';

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        buttons.forEach((btn) => {
            const selected = btn.dataset.theme === theme;
            btn.setAttribute('aria-pressed', String(selected));
        });
    }

    function readTheme() {
        try {
            return localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
        } catch (error) {
            return 'light';
        }
    }

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextTheme = btn.dataset.theme;
            try {
                localStorage.setItem(themeKey, nextTheme);
            } catch (error) {}
            applyTheme(nextTheme);
        });
    });

    document.body.appendChild(wrapper);
    applyTheme(readTheme());
}

function initSharedSiteBootstrap() {
    initThemeToggle();
    injectAssistantWidget();

    const bodyTarget = document.body || document.documentElement;
    if (bodyTarget && !bodyTarget.dataset.hlAssistantObserver) {
        bodyTarget.dataset.hlAssistantObserver = 'true';
        const observer = new MutationObserver(() => {
            if (!document.querySelector('.hl-assistant')) {
                injectAssistantWidget();
            }
        });
        observer.observe(bodyTarget, { childList: true, subtree: true });
    }

    window.setTimeout(() => {
        if (!document.querySelector('.hl-assistant')) {
            injectAssistantWidget();
        }
    }, 1500);
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initSharedSiteBootstrap, { once: true });
} else {
    initSharedSiteBootstrap();
}

// ====================================================================
// 2. UI CREATION
// ====================================================================
function createAuthUI() {
    const btn = document.createElement('button');
    btn.id = 'sign-up-btn';
    btn.textContent = 'Sign Up / Login';
    btn.onclick = () => window.location.href = AUTH_PAGE_URL;
    document.body.appendChild(btn);
    return btn;
}

function createProfileUI(userPhotoURL, userName) {
    const container = document.createElement('div');
    container.id = 'profile-container';
    container.className = 'profile-container';
    container.innerHTML = `
        <div style="position:relative;">
            <img src="${userPhotoURL || 'https://houselearning.org/auth/dashboard/default.png'}" class="profile-pic" id="profile-pic">
            <span id="notif-dot" class="notif-dot"></span>
            <span id="notif-count" class="notif-badge" style="display:none;">0</span>
        </div>
        <div class="dropdown-menu" id="account-dropdown">
            <div class="dropdown-header">
                <a id="github-icon" class="dropdown-icon" href="${GITHUB_URL}" target="_blank">
                    <svg style="width:20px;height:20px;fill:#61dafb;" viewBox="0 0 24 24"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1 0 1.7 1.1 1.7 1.1 1 1.7 2.7 1.2 3.4.9.1-.7.4-.9.7-1.1-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.1-3.1-.1-.3-.5-1.5.1-3.2 0 0 .9-.3 3 1.1a10.6 10.6 0 0 1 2.8-.4 10.6 10.6 0 0 1 2.8.4c2.1-1.4 3-1.1 3-1.1.6 1.7.2 2.9.1 3.2.7.8 1.1 1.8 1.1 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.7 1.1.7 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/></svg>
                </a>
                <button id="close-icon" class="dropdown-icon" style="right:15px; background:none; border:none;">
                    <svg style="width:20px;height:20px;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/></svg>
                </button>
                <img class="dropdown-pfp" src="${userPhotoURL || 'https://houselearning.org/auth/dashboard/default.png'}">
                <span class="dropdown-username">${userName}</span>
            </div>
            <a href="https://houselearning.org/auth/dashboard" class="menu-link">Dashboard</a>
            <div class="safeai-setting-row">
                <span>SafeAI</span>
                <label class="safeai-toggle" aria-label="Toggle SafeAI">
                    <input id="safeai-toggle" type="checkbox" checked>
                    <span class="slider"></span>
                </label>
            </div>
            <a href="#" id="notifications-btn" class="menu-link">Notifications <span id="notif-count-inline" class="notif-badge" style="display:none; margin-left:8px;">0</span></a>
            <div class="logout-container"><button id="logout-dropdown-btn">Sign out</button></div>
        </div>
    `;

    const safeAiToggle = container.querySelector('#safeai-toggle');
    const safeAiKey = 'houselearning_safeai_enabled';

    function readSafeAiPreference() {
        try {
            const value = localStorage.getItem(safeAiKey);
            if (value === null) return true;
            return value !== 'false';
        } catch (_error) {
            return true;
        }
    }

    function writeSafeAiPreference(enabled) {
        try {
            localStorage.setItem(safeAiKey, String(enabled));
        } catch (_error) {
            // ignore storage failures
        }
        if (window.HLAssistantSafeAI && typeof window.HLAssistantSafeAI.setEnabled === 'function') {
            window.HLAssistantSafeAI.setEnabled(Boolean(enabled));
        }
    }

    if (safeAiToggle) {
        safeAiToggle.checked = readSafeAiPreference();
        safeAiToggle.addEventListener('change', () => {
            writeSafeAiPreference(safeAiToggle.checked);
        });
    }

    const modal = document.createElement('div');
    modal.id = 'notifications-modal-overlay';
    modal.className = 'notif-modal-overlay';
    modal.innerHTML = `
        <div class="notif-modal">
            <div class="notif-modal-header">
                <strong>Notifications</strong>
                <div style="display:flex; gap:8px;">
                    <button id="notif-mark-all-read-modal" class="notif-small-btn">Mark all read</button>
                    <button id="notifications-modal-close" class="notif-small-btn">Close</button>
                </div>
            </div>
            <div class="notif-modal-body">
                <ul id="notifications-modal-list" style="padding:0; margin:0;"></ul>
                <div id="no-notifs-msg" style="text-align:center; display:none; padding:20px; color:#999;">No notifications</div>
            </div>
        </div>
    `;

    const reminder = document.createElement('div');
    reminder.id = 'notif-reminder-popup';
    reminder.innerHTML = `
        <div style="font-weight:bold; margin-bottom:5px;">New Updates!</div>
        <div style="font-size:14px; margin-bottom:12px;">You have unread notifications waiting.</div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button id="reminder-dismiss" class="notif-small-btn">Dismiss</button>
            <button id="reminder-view" class="notif-small-btn" style="background:#007bff; color:#fff; border:none;">View</button>
        </div>
    `;
    
    document.body.appendChild(container);
    document.body.appendChild(modal);
    document.body.appendChild(reminder);

    return {
        container,
        pic: container.querySelector('#profile-pic'),
        dropdown: container.querySelector('#account-dropdown'),
        notificationsBtn: container.querySelector('#notifications-btn'),
        modal: modal,
        modalList: modal.querySelector('#notifications-modal-list'),
        reminder: reminder
    };
}

// ====================================================================
// 3. LOGIC & DATA (Updated for Security Rules)
// ====================================================================
function initNotificationsListener(uid) {
    if (!db || !uid) return;
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    // The query MUST match your security rules. 
    // We filter specifically for this user's UID.
    notificationsUnsubscribe = db.collection('notifications')
        .where('recipientUid', '==', uid) 
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const notifications = [];
            let unreadCount = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.read) unreadCount++;
                notifications.push({ id: doc.id, ...data });
            });

            latestNotifications = notifications;
            updateBadges(unreadCount);
            renderNotifications(notifications);
            checkReminder(notifications);
        }, err => {
            console.error("Firestore Notification Error:", err);
            // If you see an 'index' error in the console, click the link 
            // provided by Firebase to generate the required Composite Index.
        });
}

// Function to update 'read' status
window.markAsRead = (id) => {
    if (!db || !id) return;
    db.collection('notifications').doc(id).update({ 
        read: true 
    }).catch(err => console.error("Error marking as read:", err));
};

function updateBadges(count) {
    const badge = document.querySelector('#notif-count');
    const inline = document.querySelector('#notif-count-inline');
    const dot = document.querySelector('#notif-dot');
    const display = count > 0 ? 'inline-flex' : 'none';
    
    if (badge) { badge.style.display = display; badge.textContent = count; }
    if (inline) { inline.style.display = display; inline.textContent = count; }
    if (dot) dot.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderNotifications(docs) {
    const list = document.querySelector('#notifications-modal-list');
    const empty = document.querySelector('#no-notifs-msg');
    if (!list) return;

    list.innerHTML = '';
    if (docs.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    docs.forEach(n => {
        const li = document.createElement('li');
        li.className = `notification-item ${n.read ? '' : 'unread'}`;
        li.innerHTML = `
            <div style="font-weight:bold;">${n.title}</div>
            <div style="font-size:13px; color:#444;">${n.body}</div>
            <div style="margin-top:8px; display:flex; gap:8px;">
                ${!n.read ? `<button class="notif-small-btn" onclick="markAsRead('${n.id}')">Mark Read</button>` : ''}
                ${n.url ? `<button class="notif-small-btn" onclick="window.open('${n.url}')">Open</button>` : ''}
            </div>
        `;
        list.appendChild(li);
    });
}

window.markAsRead = (id) => db.collection('notifications').doc(id).update({ read: true });

function checkReminder(notifications) {
    const unread = notifications.filter(n => !n.read);
    const popup = document.querySelector('#notif-reminder-popup');
    if (unread.length === 0) { popup.classList.remove('show'); return; }

    const lastDismiss = parseInt(localStorage.getItem(NOTIF_REMINDER_DISMISS_KEY) || '0');
    if (Date.now() - lastDismiss < 600000) return; // 10 min cooldown

    setTimeout(() => popup.classList.add('show'), 2000);
}

// ====================================================================
// 4. MAIN EXECUTION
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    if (!document.querySelector('[data-hl-assistant-script]')) {
        injectAssistantWidget();
    }
    signUpButton = createAuthUI();

    if (!auth) {
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            if (!profileContainer) {
                const ui = createProfileUI(user.photoURL, user.displayName || user.email);
                profileContainer = ui.container;
                
                ui.pic.onclick = () => ui.dropdown.style.display = (ui.dropdown.style.display === 'block' ? 'none' : 'block');
                ui.notificationsBtn.onclick = (e) => { e.preventDefault(); ui.modal.classList.add('show'); ui.dropdown.style.display = 'none'; };
                ui.modal.querySelector('#notifications-modal-close').onclick = () => ui.modal.classList.remove('show');
                
                ui.modal.querySelector('#notif-mark-all-read-modal').onclick = async () => {
                    if (!db || latestNotifications.length === 0) return;
                    const batch = db.batch();
                    latestNotifications.filter(n => !n.read).forEach(n => batch.update(db.collection('notifications').doc(n.id), { read: true }));
                    await batch.commit();
                };

                document.querySelector('#reminder-dismiss').onclick = () => {
                    localStorage.setItem(NOTIF_REMINDER_DISMISS_KEY, Date.now().toString());
                    ui.reminder.classList.remove('show');
                };
                document.querySelector('#reminder-view').onclick = () => { ui.modal.classList.add('show'); ui.reminder.classList.remove('show'); };
                
                document.querySelector('#logout-dropdown-btn').onclick = () => auth.signOut();
            }
            profileContainer.style.display = 'block';
            signUpButton.style.display = 'none';
            initNotificationsListener(user.uid);
        } else {
            if (profileContainer) profileContainer.style.display = 'none';
            signUpButton.style.display = 'block';
            if (notificationsUnsubscribe) notificationsUnsubscribe();
        }
    });
});
