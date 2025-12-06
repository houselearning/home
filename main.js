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
let auth;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
} catch (error) {
    console.error("Firebase initialization failed on main page:", error);
}

// Add DB vars for notifications real-time listener
let db = null;
let notificationsUnsubscribe = null;
let latestNotifications = []; // <-- existing cache
let notifReminderTimer = null; // NEW: timer id for scheduled reminder
let notifReminderPopup = null; // NEW: DOM for reminder
const NOTIF_REMINDER_DISMISS_KEY = 'houselearning_notif_reminder_dismissed_at'; // NEW: store dismissal time (ms)

// --- Dynamic Element References ---
let profileContainer = null;
let profilePic = null;
let accountDropdown = null;
let signUpButton = null;
let anonymousPopup = null; 

// --- Local Storage Keys ---
const POPUP_DISMISS_KEY = 'houselearning_popup_dismissed'; 
const AUTH_PAGE_URL = 'https://houselearning.github.io/auth/';
const GITHUB_URL = 'https://github.com/houselearning'; 


// ====================================================================
// 1. DYNAMIC CSS INJECTION - COMBINED STYLES
// ====================================================================

/**
 * Creates a <style> block and inserts all necessary CSS rules.
 */
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* --- PFP & Sign Up Button Styles --- */
        .profile-container {
            position: fixed; 
            top: 15px;      
            right: 20px;    
            z-index: 2000;  
            display: none; 
        }
        
        #sign-up-btn {
            position: fixed;
            top: 18px; 
            right: 20px;
            z-index: 2000;
            display: none; 
            background-color: #61dafb; 
            color: #20232a;           
            padding: 8px 15px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            border: none;
            transition: background-color 0.3s ease;
        }
        
        #sign-up-btn:hover {
            background-color: #53c4e3; 
        }

        .profile-pic {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            object-fit: cover;
            border: 2px solid #61dafb;
            transition: transform 0.1s ease;
        }
        .profile-pic:hover {
            transform: scale(1.05);
        }

        /* --- DROPDOWN STYLES (MODAL-LIKE) --- */
        .dropdown-menu {
            position: absolute; 
            top: 50px;          
            right: -10px;           
            background-color: white;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
            border-radius: 12px; 
            z-index: 1000;
            width: 280px; 
            overflow: hidden;
            display: none; 
            border: 1px solid #ddd;
            padding: 10px 0; 
        }
        
        .dropdown-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 15px 15px 25px 15px;
            text-align: center;
            border-bottom: 1px solid #f0f0f0;
            position: relative;
        }

        .dropdown-pfp {
            width: 70px; 
            height: 70px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid #61dafb;
            margin-bottom: 10px;
        }

        .dropdown-username {
            font-weight: 600;
            font-size: 16px;
            color: #20232a;
        }
        
        .dropdown-icon {
            position: absolute;
            top: 15px;
            cursor: pointer;
        }

        #github-icon {
            left: 15px;
        }
        #close-icon {
            right: 15px;
        }

        .dropdown-menu .menu-link {
            color: #555;
            padding: 10px 25px;
            text-decoration: none;
            display: block;
            font-weight: 500;
            font-size: 15px;
            transition: background-color 0.15s ease, color 0.15s ease;
        }

        .dropdown-menu .menu-link:hover {
            background-color: #f0f8ff; 
            color: #007bff;
        }
        
        .logout-container {
            padding: 15px 25px;
            border-top: 1px solid #f0f0f0;
            text-align: center;
        }
        
        #logout-dropdown-btn {
            background-color: #f8f8f8;
            color: #333;
            padding: 8px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            border: 1px solid #ccc;
            width: 100%;
            box-sizing: border-box;
            transition: background-color 0.15s;
        }
        
        #logout-dropdown-btn:hover {
            background-color: #e8e8e8;
        }
        
        .icon-svg {
            width: 20px;
            height: 20px;
            fill: #61dafb;
        }

        /* --- Anonymous Pop-up Styles --- */
        #anonymous-popup {
            position: fixed;
            top: 15px;
            right: 20px;
            width: 300px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
            z-index: 1999; 
            padding: 20px;
            opacity: 0; 
            transform: translateY(20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border: 1px solid #e0e0e0;
            display: none; 
        }
        
        #anonymous-popup.show {
            opacity: 1;
            transform: translateY(0);
            display: block;
        }

        .popup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .popup-header h3 {
            margin: 0;
            font-size: 18px;
            color: #20232a;
        }

        #popup-close-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            line-height: 1;
        }

        #popup-close-btn svg {
            width: 16px;
            height: 16px;
            fill: #777;
            transition: fill 0.2s ease;
        }
        #popup-close-btn:hover svg {
            fill: #333;
        }

        .popup-body p {
            font-size: 14px;
            color: #555;
            line-height: 1.4;
            margin-bottom: 20px;
        }

        .popup-buttons {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 15px;
        }
        
        /* Google-style Button Base */
        .google-style-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px 15px;
            border: 1px solid #dadce0;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            transition: background-color 0.15s, box-shadow 0.15s;
        }

        .google-style-btn:hover {
            background-color: #f6f6f6;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        }

        #sign-in-popup-btn, #perks-sign-in-btn {
            background-color: #4285f4;
            color: white;
            border: 1px solid #4285f4;
            flex-grow: 1; 
        }
        #sign-in-popup-btn:hover, #perks-sign-in-btn:hover {
            background-color: #3b78e7;
            border-color: #3b78e7;
        }
        
        #view-perks-btn {
            background-color: white;
            color: #3c4043;
            flex-grow: 1; 
        }
        
        /* Perks View Specific Styles */
        .perks-view-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }

        #perks-back-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            line-height: 1;
        }
        #perks-back-btn svg {
            width: 20px;
            height: 20px;
            fill: #333;
        }

        #perks-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 150px;
            overflow-y: auto;
        }
        #perks-list li {
            font-size: 14px;
            margin-bottom: 8px;
            color: #20232a;
            display: flex;
            align-items: flex-start;
        }
        #perks-list li::before {
            content: '✓';
            color: #61dafb;
            font-weight: bold;
            margin-right: 8px;
        }
        
        /* Layout for switching views */
        .popup-view {
            display: none;
        }
        .popup-view.active {
            display: block;
        }

        /* Notification badge on profile pic */
        .notif-badge {
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            border-radius: 9px;
            background: #ff3b30;
            color: white;
            font-size: 12px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        /* small red dot on pfp (separate from count badge) */
        .notif-dot {
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff3b30;
            box-shadow: 0 1px 2px rgba(0,0,0,0.25);
            z-index: 2;
            display: none;
        }

        /* --- Notifications Modal Styles --- */
        .notif-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            display: none;
            z-index: 3000;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .notif-modal-overlay.show {
            display: flex;
        }
        .notif-modal {
            background: #fff;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 14px 40px rgba(0,0,0,0.35);
            display: flex;
            flex-direction: column;
        }
        .notif-modal-header {
            padding: 16px 18px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            border-bottom: 1px solid #eee;
        }
        .notif-modal-body {
            padding: 12px 16px;
            overflow-y: auto;
        }
        .notif-modal-footer {
            padding: 12px 16px;
            border-top: 1px solid #f0f0f0;
            display:flex;
            gap:8px;
            justify-content: flex-end;
        }

        /* reuse .notification-item styles in modal */
        .notif-modal .notification-item { margin-bottom: 10px; }

        /* Reminder popup (re-using anonymous popup visual language) */
        #notif-reminder-popup {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 320px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
            z-index: 2500;
            padding: 18px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border: 1px solid #e0e0e0;
            display: none;
        }
        #notif-reminder-popup.show {
            display: block;
        }
        #notif-reminder-popup .reminder-header {
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:10px;
        }
        #notif-reminder-popup .reminder-header h4 {
            margin:0;
            font-size:16px;
        }
        #notif-reminder-popup .reminder-body {
            color:#444;
            font-size:14px;
            margin-bottom:12px;
        }
        #notif-reminder-popup .reminder-actions {
            display:flex;
            gap:8px;
            justify-content:flex-end;
        }
    `;
    document.head.appendChild(style);
}


// ====================================================================
// 2. DYNAMIC HTML CREATION & LOGIC FUNCTIONS
// ====================================================================

function createAuthButton() {
    const button = document.createElement('button');
    button.id = 'sign-up-btn';
    button.textContent = 'Sign Up / Login';
    button.onclick = () => {
        window.location.href = AUTH_PAGE_URL; 
    };
    document.body.appendChild(button);
    return button;
}

function createProfileUI(userPhotoURL, userName) {
    const container = document.createElement('div');
    container.className = 'profile-container';
    container.id = 'profile-container';
    
    const picWrapper = document.createElement('div');
    picWrapper.className = 'profile-pic-wrapper';
    
    const pic = document.createElement('img');
    pic.src = userPhotoURL || 'https://houselearning.github.io/auth/dashboard/default.png';
    pic.alt = 'Profile Picture';
    pic.className = 'profile-pic';
    pic.id = 'profile-pic';
    
    // badge for unread count
    const badge = document.createElement('span');
    badge.id = 'notif-count';
    badge.className = 'notif-badge';
    badge.style.display = 'none';
    badge.textContent = '0';

    // small red dot indicator (no number)
    const dot = document.createElement('span');
    dot.id = 'notif-dot';
    dot.className = 'notif-dot';
    dot.style.display = 'none';
    
    picWrapper.appendChild(pic);
    picWrapper.appendChild(dot);   // NEW: dot above pic
    picWrapper.appendChild(badge);
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    dropdown.id = 'account-dropdown';
    
    // main dropdown content (added Notifications link and notifications panel)
    dropdown.innerHTML = `
        <div class="dropdown-header">
            <a id="github-icon" class="dropdown-icon" href="${GITHUB_URL}" target="_blank" title="View on GitHub">
                <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.7.1-.7 1.1 0 1.7 1.1 1.7 1.1 1 1.7 2.7 1.2 3.4.9.1-.7.4-.9.7-1.1-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.1-3.1-.1-.3-.5-1.5.1-3.2 0 0 .9-.3 3 1.1a10.6 10.6 0 0 1 2.8-.4 10.6 10.6 0 0 1 2.8.4c2.1-1.4 3-1.1 3-1.1.6 1.7.2 2.9.1 3.2.7.8 1.1 1.8 1.1 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.7 1.1.7 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" fill-rule="evenodd"/>
                </svg>
            </a>
            
            <button id="close-icon" class="dropdown-icon" aria-label="Close menu">
                <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#333">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>
                </svg>
            </button>

            <img class="dropdown-pfp" src="${userPhotoURL || 'https://houselearning.github.io/auth/dashboard/default.png'}" alt="Profile Image">
            <span class="dropdown-username">${userName || 'User Name'}</span>
        </div>
        
        <a href="https://houselearning.github.io/auth/dashboard" class="menu-link">Dashboard</a>
        <a href="https://houselearning.github.io/auth/dashboard/settings" id="account-settings-btn" class="menu-link">Account Settings</a>
        <a href="https://houselearning.github.io/auth/dashboard" id="join-class-btn" class="menu-link">Join Class</a>

        <!-- Notifications Link -->
        <a href="#" id="notifications-btn" class="menu-link">Notifications <span id="notif-count-inline" class="notif-badge" style="display:none; margin-left:8px;">0</span></a>

        <!-- Notifications Panel -->
        <div id="notifications-panel" class="notifications-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>Notifications</strong>
                <div>
                    <button id="notif-mark-all-read" class="notif-small-btn">Mark all read</button>
                    <button id="notifications-back-btn" class="notif-small-btn">Back</button>
                </div>
            </div>
            <ul id="notifications-list">
                <!-- realtime notifications inserted here -->
            </ul>
            <div id="no-notifs" style="text-align:center; color:#777; font-size:13px; display:none;">No notifications</div>
        </div>

        <div class="logout-container">
            <button id="logout-dropdown-btn">Sign out</button>
        </div>
    `;
    
    container.appendChild(picWrapper);
    container.appendChild(dropdown);
    document.body.appendChild(container);

    // --- Create Notifications Modal (overlay + modal)
    const notifOverlay = document.createElement('div');
    notifOverlay.className = 'notif-modal-overlay';
    notifOverlay.id = 'notifications-modal-overlay';
    notifOverlay.innerHTML = `
        <div class="notif-modal" role="dialog" aria-modal="true" aria-label="Notifications">
            <div class="notif-modal-header">
                <strong>Notifications</strong>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="notif-mark-all-read-modal" class="notif-small-btn">Mark all read</button>
                    <button id="notifications-modal-close" class="notif-small-btn" aria-label="Close">Close</button>
                </div>
            </div>
            <div class="notif-modal-body">
                <ul id="notifications-modal-list" style="list-style:none; padding:0; margin:0;"></ul>
                <div id="notifications-modal-no-notifs" style="text-align:center; color:#777; font-size:13px; display:none; margin-top:12px;">No notifications</div>
            </div>
            <div class="notif-modal-footer">
                <button id="notifications-modal-back" class="notif-small-btn">Back</button>
            </div>
        </div>
    `;
    document.body.appendChild(notifOverlay);

    // --- Create Reminder popup (hidden by default)
    const reminder = document.createElement('div');
    reminder.id = 'notif-reminder-popup';
    reminder.innerHTML = `
        <div class="reminder-header">
            <h4>Hey!</h4>
        </div>
        <div class="reminder-body">You have unread notifications!</div>
        <div class="reminder-actions">
            <button id="notif-reminder-dismiss" class="notif-small-btn">Dismiss</button>
            <button id="notif-reminder-action" class="notif-small-btn">Take Action</button>
        </div>
    `;
    document.body.appendChild(reminder);

    return {
        container: container,
        pic: pic,
        dropdown: dropdown,
        logoutBtn: dropdown.querySelector('#logout-dropdown-btn'),
        joinBtn: dropdown.querySelector('#join-class-btn'),
        closeBtn: dropdown.querySelector('#close-icon'),
        notificationsBtn: dropdown.querySelector('#notifications-btn'),
        notificationsPanel: dropdown.querySelector('#notifications-panel'),
        notificationsBackBtn: dropdown.querySelector('#notifications-back-btn'),
        notifCountElem: badge,
        notifCountInline: dropdown.querySelector('#notif-count-inline'),
        markAllReadBtn: dropdown.querySelector('#notif-mark-all-read'),
        notificationsList: dropdown.querySelector('#notifications-list'),
        noNotifsElem: dropdown.querySelector('#no-notifs'),
        // modal refs
        notificationsModalOverlay: notifOverlay,
        notificationsModalClose: notifOverlay.querySelector('#notifications-modal-close'),
        notificationsModalBack: notifOverlay.querySelector('#notifications-modal-back'),
        notificationsModalList: notifOverlay.querySelector('#notifications-modal-list'),
        notificationsModalNoNotifs: notifOverlay.querySelector('#notifications-modal-no-notifs'),
        notificationsModalMarkAll: notifOverlay.querySelector('#notif-mark-all-read-modal'),
        // reminder refs
        notificationsReminder: reminder,
        notificationsReminderDismiss: reminder.querySelector('#notif-reminder-dismiss'),
        notificationsReminderAction: reminder.querySelector('#notif-reminder-action')
    };
}

/**
 * Creates the anonymous pop-up element and injects it into the document body.
 */
function createAnonymousPopup() {
    const popup = document.createElement('div');
    popup.id = 'anonymous-popup';
    
    // Main View
    const mainView = document.createElement('div');
    mainView.id = 'popup-main-view';
    mainView.className = 'popup-view active';
    mainView.innerHTML = `
        <div class="popup-header">
            <h3>You are anonymous.</h3>
            <button id="popup-close-btn" aria-label="Close notification">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>
                </svg>
            </button>
        </div>
        <div class="popup-body">
            <p>HouseLearning is enjoyed most when you are signed in. Sign in now to get the full perks.</p>
        </div>
        <div class="popup-buttons">
            <a href="${AUTH_PAGE_URL}" id="sign-in-popup-btn" class="google-style-btn">Sign in now</a>
            <button id="view-perks-btn" class="google-style-btn">View Perks</button>
        </div>
    `;

    // Perks View
    const perksView = document.createElement('div');
    perksView.id = 'popup-perks-view';
    perksView.className = 'popup-view';
    perksView.innerHTML = `
        <div class="perks-view-header">
            <button id="perks-back-btn" aria-label="Go back">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12z"/>
                </svg>
            </button>
            <h3>Full Perks</h3>
        </div>
        <ul id="perks-list">
            <li>Save your progress across all games and challenges.</li>
            <li>Earn badges and track your achievements.</li>
            <li>Access exclusive content and advanced tutorials.</li>
            <li>Connect with other learners and join classes.</li>
        </ul>
        <div class="popup-buttons" style="justify-content: flex-end;">
            <a href="${AUTH_PAGE_URL}" class="google-style-btn" id="perks-sign-in-btn">Sign in now</a>
        </div>
    `;
    
    popup.appendChild(mainView);
    popup.appendChild(perksView);
    document.body.appendChild(popup);
    return popup;
}

function toggleDropdown(dropdownElement) {
    const isVisible = dropdownElement.style.display === 'block';
    dropdownElement.style.display = isVisible ? 'none' : 'block';
}

async function handleLogout() {
    try {
        // detach real-time notifications listener
        if (notificationsUnsubscribe) {
            notificationsUnsubscribe();
            notificationsUnsubscribe = null;
        }
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

// NEW: hide & show helper for reminder and scheduling logic
function showNotifReminder(elements) {
    if (!elements || !elements.notificationsReminder) return;
    // Do not show if user recently dismissed (cooldown)
    const lastDismiss = parseInt(localStorage.getItem(NOTIF_REMINDER_DISMISS_KEY) || '0', 10);
    const now = Date.now();
    if (lastDismiss && (now - lastDismiss) < (10 * 60 * 1000)) {
        // still in cooldown
        return;
    }
    elements.notificationsReminder.classList.add('show');
}

function hideNotifReminder(elements) {
    if (!elements || !elements.notificationsReminder) return;
    elements.notificationsReminder.classList.remove('show');
}

function clearNotifReminderTimer() {
    if (notifReminderTimer) {
        clearTimeout(notifReminderTimer);
        notifReminderTimer = null;
    }
}

/**
 * Schedule or show reminder based on unread notifications' ages.
 * - If any unread is already >=10min old, show immediately (respecting dismissal cooldown).
 * - Otherwise schedule a timer to show when the earliest unread reaches 10 minutes.
 */
function scheduleReminderBasedOnNotifications(notifications) {
    clearNotifReminderTimer();
    // find unread notifications
    const unread = (notifications || []).filter(n => !n.read);
    const elements = profileContainer ? {
        notificationsReminder: document.querySelector('#notif-reminder-popup'),
        notificationsModalOverlay: document.querySelector('#notifications-modal-overlay')
    } : null;

    if (!unread || unread.length === 0) {
        // nothing unread -> hide reminder
        if (elements) hideNotifReminder(elements);
        return;
    }

    const now = Date.now();
    const tenMinMs = 10 * 60 * 1000;

    // compute ages and earliest time until some unread reaches 10min
    let earliestDelay = Infinity;
    let showImmediately = false;
    for (const u of unread) {
        const age = now - (u.timestamp || now);
        if (age >= tenMinMs) {
            showImmediately = true;
            break;
        } else {
            const remaining = tenMinMs - age;
            if (remaining < earliestDelay) earliestDelay = remaining;
        }
    }

    if (showImmediately) {
        showNotifReminder(elements);
    } else if (earliestDelay !== Infinity) {
        // schedule showing after earliestDelay, but check dismissal cooldown at show time
        notifReminderTimer = setTimeout(() => {
            notifReminderTimer = null;
            showNotifReminder(elements);
        }, earliestDelay + 200); // small buffer
    }
}

// New helper: render notifications into panel or modal
function renderNotifications(docs) {
    // prefer modal list if it exists, otherwise use dropdown list
    const modalListElem = document.querySelector('#notifications-modal-list');
    const dropdownListElem = document.querySelector('#notifications-list');
    const listElem = modalListElem || dropdownListElem;
    if (!listElem) return;

    const modalNoNotifs = document.querySelector('#notifications-modal-no-notifs');
    const dropdownNoNotifs = document.querySelector('#no-notifs');
    const noNotifs = modalNoNotifs || dropdownNoNotifs;

    listElem.innerHTML = '';
    if (!docs || docs.length === 0) {
        if (noNotifs) noNotifs.style.display = 'block';
        return;
    } else {
        if (noNotifs) noNotifs.style.display = 'none';
    }

    docs.forEach(n => {
        const item = document.createElement('li');
        item.className = 'notification-item' + (n.read ? '' : ' unread');
        item.dataset.id = n.id;
        item.innerHTML = `
            <div class="notif-title">${n.title || 'Notification'}</div>
            <div class="notif-body">${n.body || ''}</div>
            <div style="font-size:12px; color:#888;">${n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</div>
            <div class="notif-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">
                ${n.url ? `<button class="notif-small-btn open-link-btn">Open</button>` : ''}
                ${n.read ? '' : `<button class="notif-small-btn mark-read-btn">Mark read</button>`}
            </div>
        `;
        listElem.appendChild(item);

        // handlers
        if (!n.read) {
            const markBtn = item.querySelector('.mark-read-btn');
            if (markBtn) {
                markBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        if (!db) return;
                        await db.collection('notifications').doc(n.id).update({ read: true });
                    } catch (err) {
                        console.error('Mark read failed', err);
                    }
                });
            }
        }
        const openBtn = item.querySelector('.open-link-btn');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (n.url) window.open(n.url, '_blank');
            });
        }
    });

    // after rendering, also if no unread, ensure reminder is hidden and timer cleared
    const anyUnread = (docs || []).some(n => !n.read);
    if (!anyUnread) {
        clearNotifReminderTimer();
        const reminderEl = document.querySelector('#notif-reminder-popup');
        if (reminderEl) reminderEl.classList.remove('show');
    }
}

// Initialize notifications real-time listener for the logged-in user
function initNotificationsListener(uid) {
    if (!db || !uid) return;
    // detach previous listener if any
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }
    try {
        notificationsUnsubscribe = db.collection('notifications')
            .where('recipientUid', '==', uid)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                const notifications = [];
                let unreadCount = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().getTime() : (data.timestamp || Date.now());
                    const normalized = {
                        id: doc.id,
                        title: data.title,
                        body: data.body,
                        url: data.url,
                        read: !!data.read,
                        timestamp: ts
                    };
                    if (!normalized.read) unreadCount++;
                    notifications.push(normalized);
                });

                // update cache
                latestNotifications = notifications.slice();

                // update badges & dot
                if (profileContainer) {
                    const badge = profileContainer.querySelector('#notif-count');
                    const inline = profileContainer.querySelector('#notif-count-inline');
                    const dot = profileContainer.querySelector('#notif-dot'); // NEW: dot ref
                    if (unreadCount > 0) {
                        if (badge) { badge.style.display = 'inline-flex'; badge.textContent = unreadCount; }
                        if (inline) { inline.style.display = 'inline-flex'; inline.textContent = unreadCount; }
                        if (dot) { dot.style.display = 'inline-block'; }
                    } else {
                        if (badge) badge.style.display = 'none';
                        if (inline) inline.style.display = 'none';
                        if (dot) dot.style.display = 'none';
                    }
                }

                // render list (modal preferred if present)
                renderNotifications(notifications);

                // schedule or show reminder if unread notifications age >10min
                scheduleReminderBasedOnNotifications(notifications);
            }, err => {
                console.error('Notifications listener error:', err);
            });
    } catch (error) {
        console.error('initNotificationsListener error:', error);
    }
}


// ====================================================================
// 3. MAIN EXECUTION BLOCK 
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inject CSS styles immediately when the DOM is ready
    injectStyles();

    // Create the Sign Up button element right away
    if (!signUpButton) {
        signUpButton = createAuthButton();
    }
    
    // Global click handler to close the dropdown when clicking outside (Setup immediately)
    // NOTE: This listener must be defined outside the auth.onAuthStateChanged scope.
    window.addEventListener('click', (event) => {
        if (accountDropdown && accountDropdown.style.display === 'block' && 
            !profileContainer.contains(event.target)) {
            accountDropdown.style.display = 'none';
        }
    });

    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // USER IS LOGGED IN: SHOW PFP, HIDE SIGN UP & POPUP
                
                const userName = user.displayName || user.email; 

                if (!profileContainer) {
                    const elements = createProfileUI(user.photoURL, userName); 
                    profileContainer = elements.container;
                    profilePic = elements.pic;
                    accountDropdown = elements.dropdown;

                    // Attach static listeners
                    profilePic.addEventListener('click', () => toggleDropdown(accountDropdown));
                    elements.logoutBtn.addEventListener('click', handleLogout);
                    elements.joinBtn.addEventListener('click', () => window.location.href = 'https://houselearning.github.io/auth/dashboard?action=join');
                    elements.closeBtn.addEventListener('click', () => toggleDropdown(accountDropdown));

                    // --- NEW: Notifications modal handlers ---
                    // Open modal when notifications link clicked
                    elements.notificationsBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (elements.notificationsModalOverlay) {
                            elements.notificationsModalOverlay.classList.add('show');
                            renderNotifications(latestNotifications);
                            // also hide reminder if present when user opens notifications
                            if (elements.notificationsReminder) elements.notificationsReminder.classList.remove('show');
                            // reset dismissal timer so it won't reappear immediately
                            localStorage.setItem(NOTIF_REMINDER_DISMISS_KEY, Date.now().toString());
                        }
                    });

                    // Close/Back modal
                    if (elements.notificationsModalClose) {
                        elements.notificationsModalClose.addEventListener('click', () => {
                            elements.notificationsModalOverlay.classList.remove('show');
                        });
                    }
                    if (elements.notificationsModalBack) {
                        elements.notificationsModalBack.addEventListener('click', () => {
                            elements.notificationsModalOverlay.classList.remove('show');
                        });
                    }

                    // Modal "Mark all read"
                    if (elements.notificationsModalMarkAll) {
                        elements.notificationsModalMarkAll.addEventListener('click', async () => {
                            if (!db) return;
                            const toMark = latestNotifications.filter(n => !n.read);
                            if (toMark.length === 0) return;
                            try {
                                const batch = db.batch();
                                toMark.forEach(n => {
                                    const ref = db.collection('notifications').doc(n.id);
                                    batch.update(ref, { read: true });
                                });
                                await batch.commit();
                                // clear reminder when all read
                                clearNotifReminderTimer();
                                if (elements.notificationsReminder) elements.notificationsReminder.classList.remove('show');
                            } catch (err) {
                                console.error('Mark all read failed', err);
                            }
                        });
                    }

                    // Also keep dropdown 'Mark all read' working if present
                    if (elements.markAllReadBtn) {
                        elements.markAllReadBtn.addEventListener('click', async () => {
                            if (!db) return;
                            const toMark = latestNotifications.filter(n => !n.read);
                            if (toMark.length === 0) return;
                            try {
                                const batch = db.batch();
                                toMark.forEach(n => {
                                    const ref = db.collection('notifications').doc(n.id);
                                    batch.update(ref, { read: true });
                                });
                                await batch.commit();
                                // clear reminder when all read
                                clearNotifReminderTimer();
                                if (elements.notificationsReminder) elements.notificationsReminder.classList.remove('show');
                            } catch (err) {
                                console.error('Mark all read failed', err);
                            }
                        });
                    }

                    // Reminder popup handlers
                    if (elements.notificationsReminderDismiss) {
                        elements.notificationsReminderDismiss.addEventListener('click', () => {
                            // set dismissal timestamp so it won't reappear for 10 minutes
                            localStorage.setItem(NOTIF_REMINDER_DISMISS_KEY, Date.now().toString());
                            // hide popup and clear timer
                            elements.notificationsReminder.classList.remove('show');
                            clearNotifReminderTimer();
                        });
                    }
                    if (elements.notificationsReminderAction) {
                        elements.notificationsReminderAction.addEventListener('click', () => {
                            // open notifications modal and hide reminder
                            if (elements.notificationsModalOverlay) elements.notificationsModalOverlay.classList.add('show');
                            if (elements.notificationsReminder) elements.notificationsReminder.classList.remove('show');
                            // store dismissal so it won't instantly reappear
                            localStorage.setItem(NOTIF_REMINDER_DISMISS_KEY, Date.now().toString());
                        });
                    }
                } 
                
                // Update dynamic content and visibility
                profileContainer.style.display = 'block';
                profilePic.src = user.photoURL || 'https://houselearning.github.io/auth/dashboard/default.png';
                signUpButton.style.display = 'none';

                const dropdownUsername = accountDropdown.querySelector('.dropdown-username');
                if (dropdownUsername) {
                    dropdownUsername.textContent = `[${userName || 'User Name'}]`;
                }

                // Hide popup when logged in
                if (anonymousPopup) {
                    anonymousPopup.classList.remove('show');
                }
                // Clear dismissal flag so it shows again on next logout
                localStorage.removeItem(POPUP_DISMISS_KEY); 
                
            } else {
                // USER IS NOT LOGGED IN: HIDE PFP, SHOW SIGN UP & HANDLE POPUP
                
                if (profileContainer) {
                    profileContainer.style.display = 'none';
                    accountDropdown.style.display = 'none';
                }
                
                signUpButton.style.display = 'block';

                // --- Anonymous Pop-up Logic Restored ---
                const isDismissed = localStorage.getItem(POPUP_DISMISS_KEY) === 'true';

                if (!isDismissed) {
                    setTimeout(() => {
                        if (auth.currentUser) return; 

                        if (!anonymousPopup) {
                            anonymousPopup = createAnonymousPopup();
                            
                            const closeBtn = anonymousPopup.querySelector('#popup-close-btn');
                            const viewPerksBtn = anonymousPopup.querySelector('#view-perks-btn');
                            const backBtn = anonymousPopup.querySelector('#perks-back-btn');
                            const mainView = anonymousPopup.querySelector('#popup-main-view');
                            const perksView = anonymousPopup.querySelector('#popup-perks-view');

                            // Close Button Logic (Dismiss and store preference)
                            closeBtn.addEventListener('click', () => {
                                anonymousPopup.classList.remove('show');
                                // Store preference so it doesn't show up again
                                localStorage.setItem(POPUP_DISMISS_KEY, 'true'); 
                            });

                            // View Perks / Back Button Logic
                            viewPerksBtn.addEventListener('click', () => {
                                mainView.classList.remove('active');
                                perksView.classList.add('active');
                            });
                            
                            backBtn.addEventListener('click', () => {
                                perksView.classList.remove('active');
                                mainView.classList.add('active');
                            });
                        }

                        // Show the popup
                        anonymousPopup.classList.add('show');
                    }, 3000); // 3 second delay
                }
            }
        });
    } else {
         // Fallback if Firebase initialization failed
         console.error("Authentication setup failed. Profile features disabled.");
    }

    // Initialize firebase services safely (firestore)
    try {
        if (firebase && firebase.firestore) {
            db = firebase.firestore();
        } else {
            console.warn('Firestore not available on firebase object.');
        }
    } catch (err) {
        console.error('Firestore init failed:', err);
        db = null;
    }
});
