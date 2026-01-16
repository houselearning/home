// main.js

const firebaseConfig = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

// Initialize Firebase
let auth;
let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

let notificationsUnsubscribe = null;
let latestNotifications = [];
let profileContainer = null;
let signUpButton = null;

// --- 1. DYNAMIC STYLES ---
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .profile-container { position: fixed; top: 15px; right: 20px; z-index: 2000; }
        #sign-up-btn { position: fixed; top: 18px; right: 20px; z-index: 2000; background: #61dafb; color: #20232a; padding: 8px 15px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; }
        .profile-pic { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid #61dafb; }
        .dropdown-menu { position: absolute; top: 50px; right: -10px; background: white; box-shadow: 0 8px 16px rgba(0,0,0,0.2); border-radius: 12px; width: 250px; display: none; border: 1px solid #ddd; z-index: 1000; }
        .dropdown-menu.show { display: block; }
        .menu-link { padding: 12px 20px; text-decoration: none; display: block; color: #333; font-size: 14px; border-bottom: 1px solid #eee; }
        .menu-link:hover { background: #f8f8f8; }
        .notif-badge { position: absolute; top: -5px; right: -5px; background: #ff3b30; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .notif-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: none; z-index: 3000; align-items: center; justify-content: center; }
        .notif-modal-overlay.show { display: flex; }
        .notif-modal { background: white; width: 90%; max-width: 450px; border-radius: 12px; max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; }
        .notif-item { padding: 15px; border-bottom: 1px solid #eee; position: relative; }
        .notif-item.unread { background: #f0f7ff; }
    `;
    document.head.appendChild(style);
}

// --- 2. NOTIFICATION LISTENER (The Multi-Recipient Fix) ---
function initNotificationsListener(uid) {
    if (!db || !uid) return;
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    // Query that looks for the specific user AND global messages
    const q = db.collection('notifications')
        .where('recipientUid', 'in', [uid, 'GLOBAL_ALL'])
        .orderBy('timestamp', 'desc');

    notificationsUnsubscribe = q.onSnapshot(snapshot => {
        let unread = 0;
        latestNotifications = snapshot.docs.map(doc => {
            const data = doc.data();
            if (!data.read) unread++;
            return { id: doc.id, ...data };
        });
        updateNotifUI(unread);
    }, err => {
        console.error("Notifications Listener Error:", err);
    });
}

function updateNotifUI(count) {
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.style.display = count > 0 ? 'flex' : 'none';
        badge.textContent = count;
    }
}

// --- 3. UI BUILDER ---
function createUI(user) {
    if (profileContainer) return;

    profileContainer = document.createElement('div');
    profileContainer.className = 'profile-container';
    profileContainer.innerHTML = `
        <div style="position:relative;">
            <img src="${user.photoURL || 'https://via.placeholder.com/40'}" class="profile-pic" id="pfp">
            <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
            <div class="dropdown-menu" id="dropdown">
                <div style="padding:15px; text-align:center; border-bottom:1px solid #eee;">
                    <strong>${user.displayName}</strong>
                </div>
                <a href="#" id="view-notifs" class="menu-link">Notifications</a>
                <a href="https://houselearning.org/auth/dashboard" class="menu-link">Dashboard</a>
                <button id="logout-btn" class="menu-link" style="width:100%; text-align:left; border:none; background:none; cursor:pointer;">Sign Out</button>
            </div>
        </div>
    `;
    document.body.appendChild(profileContainer);

    // Modal
    const modal = document.createElement('div');
    modal.className = 'notif-modal-overlay';
    modal.id = 'notif-modal';
    modal.innerHTML = `
        <div class="notif-modal">
            <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <strong>Notifications</strong>
                <button id="close-modal" style="font-size:20px; cursor:pointer;">&times;</button>
            </div>
            <div id="notif-list" style="overflow-y:auto; flex:1;"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // Logic
    const pfp = document.getElementById('pfp');
    const dropdown = document.getElementById('dropdown');
    pfp.onclick = () => dropdown.classList.toggle('show');

    document.getElementById('logout-btn').onclick = () => auth.signOut();
    
    document.getElementById('view-notifs').onclick = (e) => {
        e.preventDefault();
        dropdown.classList.remove('show');
        renderModalList();
        modal.classList.add('show');
    };

    document.getElementById('close-modal').onclick = () => modal.classList.remove('show');
}

function renderModalList() {
    const list = document.getElementById('notif-list');
    list.innerHTML = latestNotifications.length ? '' : '<p style="padding:20px; text-align:center; color:#999;">No notifications</p>';
    
    latestNotifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.read ? '' : 'unread'}`;
        item.innerHTML = `
            <div style="font-weight:bold;">${n.title}</div>
            <div style="font-size:13px; margin:5px 0;">${n.body}</div>
            ${!n.read ? `<button onclick="markAsRead('${n.id}')" style="font-size:11px; color:#007bff; cursor:pointer;">Mark as read</button>` : ''}
        `;
        list.appendChild(item);
    });
}

window.markAsRead = async (id) => {
    await db.collection('notifications').doc(id).update({ read: true });
    renderModalList();
};

// --- 4. STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    
    signUpButton = document.createElement('button');
    signUpButton.id = 'sign-up-btn';
    signUpButton.textContent = 'Sign In';
    signUpButton.style.display = 'none';
    signUpButton.onclick = () => window.location.href = 'https://houselearning.org/auth/';
    document.body.appendChild(signUpButton);

    auth.onAuthStateChanged(user => {
        if (user) {
            signUpButton.style.display = 'none';
            createUI(user);
            initNotificationsListener(user.uid);
        } else {
            if (profileContainer) profileContainer.remove();
            profileContainer = null;
            signUpButton.style.display = 'block';
            if (notificationsUnsubscribe) notificationsUnsubscribe();
        }
    });
});
