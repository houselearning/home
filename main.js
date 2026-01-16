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

// Global Variables
let db = null;
let notificationsUnsubscribe = null;
let latestNotifications = []; 
let notifReminderTimer = null; 
let notifReminderPopup = null; 
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
        .profile-container { position: fixed; top: 15px; right: 20px; z-index: 2000; display: none; }
        #sign-up-btn { position: fixed; top: 18px; right: 20px; z-index: 2000; display: none; background-color: #61dafb; color: #20232a; padding: 8px 15px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; cursor: pointer; border: none; transition: background-color 0.3s ease; }
        #sign-up-btn:hover { background-color: #53c4e3; }
        .profile-pic { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; object-fit: cover; border: 2px solid #61dafb; transition: transform 0.1s ease; }
        .profile-pic:hover { transform: scale(1.05); }
        .dropdown-menu { position: absolute; top: 50px; right: -10px; background-color: white; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25); border-radius: 12px; z-index: 1000; width: 280px; overflow: hidden; display: none; border: 1px solid #ddd; padding: 10px 0; }
        .dropdown-header { display: flex; flex-direction: column; align-items: center; padding: 15px; text-align: center; border-bottom: 1px solid #f0f0f0; position: relative; }
        .dropdown-pfp { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 3px solid #61dafb; margin-bottom: 10px; }
        .dropdown-username { font-weight: 600; font-size: 16px; color: #20232a; }
        .dropdown-icon { position: absolute; top: 15px; cursor: pointer; }
        #github-icon { left: 15px; }
        #close-icon { right: 15px; }
        .dropdown-menu .menu-link { color: #555; padding: 10px 25px; text-decoration: none; display: block; font-weight: 500; font-size: 15px; transition: background-color 0.15s; }
        .dropdown-menu .menu-link:hover { background-color: #f0f8ff; color: #007bff; }
        .logout-container { padding: 15px 25px; border-top: 1px solid #f0f0f0; }
        #logout-dropdown-btn { background-color: #f8f8f8; color: #333; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; border: 1px solid #ccc; width: 100%; }
        .notif-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ff3b30; color: white; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
        .notif-dot { position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: #ff3b30; display: none; }
        .notif-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: none; z-index: 3000; align-items: center; justify-content: center; padding: 20px; }
        .notif-modal-overlay.show { display: flex; }
        .notif-modal { background: #fff; border-radius: 12px; max-width: 500px; width: 100%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
        .notif-modal-header { padding: 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .notification-item { padding: 12px; border-bottom: 1px solid #f9f9f9; list-style: none; }
        .notification-item.unread { background-color: #f0f7ff; }
        .notif-small-btn { padding: 4px 8px; font-size: 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; background: #fff; }
        #notif-reminder-popup { position: fixed; top: 80px; right: 20px; width: 280px; background: white; border-radius: 12px; box-shadow: 0 10px 20px rgba(0,0,0,0.1); z-index: 2500; padding: 15px; border: 1px solid #e0e0e0; display: none; }
        #notif-reminder-popup.show { display: block; }
    `;
    document.head.appendChild(style);
}

// ====================================================================
// 2. UI CREATION & LOGIC
// ====================================================================
function createAuthButton() {
    const button = document.createElement('button');
    button.id = 'sign-up-btn';
    button.textContent = 'Sign Up / Login';
    button.onclick = () => window.location.href = AUTH_PAGE_URL;
    document.body.appendChild(button);
    return button;
}

function createProfileUI(userPhotoURL, userName) {
    const container = document.createElement('div');
    container.className = 'profile-container';
    container.id = 'profile-container';
    
    container.innerHTML = `
        <div class="profile-pic-wrapper" style="position:relative;">
            <img src="${userPhotoURL || 'https://houselearning.org/auth/dashboard/default.png'}" class="profile-pic" id="profile-pic">
            <span id="notif-dot" class="notif-dot"></span>
            <span id="notif-count" class="notif-badge" style="display:none;">0</span>
        </div>
        <div class="dropdown-menu" id="account-dropdown">
            <div class="dropdown-header">
                <img class="dropdown-pfp" src="${userPhotoURL || 'https://houselearning.org/auth/dashboard/default.png'}">
                <span class="dropdown-username">${userName}</span>
            </div>
            <a href="https://houselearning.org/auth/dashboard" class="menu-link">Dashboard</a>
            <a href="#" id="notifications-btn" class="menu-link">Notifications <span id="notif-count-inline" class="notif-badge" style="display:none; margin-left:8px;">0</span></a>
            <div class="logout-container"><button id="logout-dropdown-btn">Sign out</button></div>
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'notif-modal-overlay';
    modal.id = 'notifications-modal-overlay';
    modal.innerHTML = `
        <div class="notif-modal">
            <div class="notif-modal-header">
                <strong>Notifications</strong>
                <button id="notif-mark-all-read-modal" class="notif-small-btn">Mark all read</button>
                <button id="notifications-modal-close" class="notif-small-btn">Close</button>
            </div>
            <div class="notif-modal-body" style="overflow-y:auto; padding:10px;">
                <ul id="notifications-modal-list" style="padding:0; margin:0;"></ul>
                <div id="no-notifs" style="text-align:center; display:none; padding:20px; color:#999;">No notifications</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    document.body.appendChild(modal);

    return {
        container,
        pic: container.querySelector('#profile-pic'),
        dropdown: container.querySelector('#account-dropdown'),
        logoutBtn: container.querySelector('#logout-dropdown-btn'),
        notificationsBtn: container.querySelector('#notifications-btn'),
        modalOverlay: modal,
        modalList: modal.querySelector('#notifications-modal-list'),
        modalClose: modal.querySelector('#notifications-modal-close'),
        modalMarkAll: modal.querySelector('#notif-mark-all-read-modal')
    };
}

// ====================================================================
// 3. NOTIFICATION LOGIC (THE "IN" QUERY)
// ====================================================================
function initNotificationsListener(uid) {
    if (!db || !uid) return;
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    // The key update: look for your UID OR "GLOBAL_ALL"
    notificationsUnsubscribe = db.collection('notifications')
        .where('recipientUid', 'in', [uid, 'GLOBAL_ALL'])
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const notifications = [];
            let unreadCount = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                const normalized = { id: doc.id, ...data, read: !!data.read };
                if (!normalized.read) unreadCount++;
                notifications.push(normalized);
            });

            latestNotifications = notifications;
            updateBadges(unreadCount);
            renderNotifications(notifications);
        });
}

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
    const empty = document.querySelector('#no-notifs');
    if (!list) return;

    list.innerHTML = '';
    if (docs.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    docs.forEach(n => {
        const li = document.createElement('li');
        li.className = `notification-item ${n.read ? '' : 'unread'}`;
        li.innerHTML = `
            <div style="font-weight:bold;">${n.title}</div>
            <div style="font-size:14px; color:#444;">${n.body}</div>
            <div style="margin-top:8px; display:flex; gap:5px;">
                ${!n.read ? `<button class="notif-small-btn mark-read" data-id="${n.id}">Mark Read</button>` : ''}
                ${n.url ? `<button class="notif-small-btn" onclick="window.open('${n.url}')">Open</button>` : ''}
            </div>
        `;
        list.appendChild(li);
    });

    list.querySelectorAll('.mark-read').forEach(btn => {
        btn.onclick = async () => {
            await db.collection('notifications').doc(btn.dataset.id).update({ read: true });
        };
    });
}

// ====================================================================
// 4. MAIN EXECUTION
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    signUpButton = createAuthButton();

    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                if (!profileContainer) {
                    const ui = createProfileUI(user.photoURL, user.displayName || user.email);
                    profileContainer = ui.container;
                    
                    ui.pic.onclick = () => ui.dropdown.style.display = ui.dropdown.style.display === 'block' ? 'none' : 'block';
                    ui.logoutBtn.onclick = () => auth.signOut();
                    ui.notificationsBtn.onclick = (e) => { e.preventDefault(); ui.modalOverlay.classList.add('show'); };
                    ui.modalClose.onclick = () => ui.modalOverlay.classList.remove('show');
                    ui.modalMarkAll.onclick = async () => {
                        const batch = db.batch();
                        latestNotifications.filter(n => !n.read).forEach(n => batch.update(db.collection('notifications').doc(n.id), { read: true }));
                        await batch.commit();
                    };
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
    }

    try {
        if (firebase.firestore) db = firebase.firestore();
    } catch (e) { console.error(e); }
});
