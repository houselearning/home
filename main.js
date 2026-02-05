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
let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
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
            <a href="#" id="notifications-btn" class="menu-link">Notifications <span id="notif-count-inline" class="notif-badge" style="display:none; margin-left:8px;">0</span></a>
            <div class="logout-container"><button id="logout-dropdown-btn">Sign out</button></div>
        </div>
    `;

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
    signUpButton = createAuthUI();

    auth.onAuthStateChanged(user => {
        if (user) {
            if (!profileContainer) {
                const ui = createProfileUI(user.photoURL, user.displayName || user.email);
                profileContainer = ui.container;
                
                ui.pic.onclick = () => ui.dropdown.style.display = (ui.dropdown.style.display === 'block' ? 'none' : 'block');
                ui.notificationsBtn.onclick = (e) => { e.preventDefault(); ui.modal.classList.add('show'); ui.dropdown.style.display = 'none'; };
                ui.modal.querySelector('#notifications-modal-close').onclick = () => ui.modal.classList.remove('show');
                
                ui.modal.querySelector('#notif-mark-all-read-modal').onclick = async () => {
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
