// main.js - HouseLearning Authentication & Notifications
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🚨 FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Variables
let notificationsUnsubscribe = null;
let latestNotifications = []; 
const NOTIF_REMINDER_DISMISS_KEY = 'houselearning_notif_reminder_dismissed_at'; 

// --- UI INJECTION ---
function injectStyles() {
    if (document.getElementById('hl-styles')) return;
    const style = document.createElement('style');
    style.id = 'hl-styles';
    style.textContent = `
        .profile-container { position: fixed; top: 15px; right: 20px; z-index: 2000; display: none; }
        #sign-up-btn { position: fixed; top: 18px; right: 20px; z-index: 2000; display: none; background: #61dafb; color: #20232a; padding: 8px 15px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; }
        .profile-pic { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 2px solid #61dafb; }
        .dropdown-menu { position: absolute; top: 50px; right: -10px; background: white; box-shadow: 0 8px 16px rgba(0,0,0,0.2); border-radius: 12px; width: 260px; display: none; border: 1px solid #ddd; z-index: 2001; }
        .notif-badge { position: absolute; top: -5px; right: -5px; background: #ff3b30; color: white; border-radius: 50%; padding: 2px 6px; font-size: 11px; font-weight: bold; }
        .notif-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: none; z-index: 3000; align-items: center; justify-content: center; }
        .notif-modal-overlay.show { display: flex; }
        .notif-modal { background: white; border-radius: 12px; width: 90%; max-width: 450px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
        .notif-item { padding: 15px; border-bottom: 1px solid #eee; position: relative; }
        .notif-item.unread { background: #f0f7ff; border-left: 4px solid #007bff; }
        .mark-read-btn { font-size: 12px; color: #007bff; cursor: pointer; background: none; border: none; padding: 0; margin-top: 5px; }
    `;
    document.head.appendChild(style);
}

function createUIElements(user) {
    // Sign Up Button
    const signUpBtn = document.createElement('button');
    signUpBtn.id = 'sign-up-btn';
    signUpBtn.textContent = 'Sign Up / Login';
    signUpBtn.onclick = () => window.location.href = 'https://houselearning.org/auth/';
    document.body.appendChild(signUpBtn);

    // Profile Container
    const container = document.createElement('div');
    container.className = 'profile-container';
    container.innerHTML = `
        <div style="position:relative;">
            <img src="${user?.photoURL || 'https://houselearning.org/auth/dashboard/default.png'}" class="profile-pic" id="profile-trigger">
            <span id="notif-badge-icon" class="notif-badge" style="display:none;">0</span>
        </div>
        <div class="dropdown-menu" id="hl-dropdown">
            <div style="padding:15px; border-bottom:1px solid #eee; text-align:center;">
                <strong>${user?.displayName || 'User'}</strong>
            </div>
            <a href="https://houselearning.org/auth/dashboard" style="display:block; padding:12px; text-decoration:none; color:#333;">Dashboard</a>
            <button id="open-notifs" style="width:100%; text-align:left; padding:12px; background:none; border:none; cursor:pointer;">Notifications</button>
            <button id="hl-logout" style="width:100%; text-align:left; padding:12px; background:none; border:none; cursor:pointer; color:red;">Sign Out</button>
        </div>
    `;

    // Notification Modal
    const modal = document.createElement('div');
    modal.id = 'notif-modal-overlay';
    modal.className = 'notif-modal-overlay';
    modal.innerHTML = `
        <div class="notif-modal">
            <div style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0;">Notifications</h3>
                <button id="close-notif-modal" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            <div id="notif-list" style="overflow-y:auto; flex-grow:1; min-height:100px;"></div>
        </div>
    `;

    document.body.appendChild(container);
    document.body.appendChild(modal);

    return { signUpBtn, container, modal };
}

// --- LOGIC ---
function initNotificationsListener(uid) {
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    // MATCHES SECURITY RULES: Filter by current user's UID
    const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", uid),
        orderBy("timestamp", "desc")
    );

    notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
        const notifications = [];
        let unreadCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.read) unreadCount++;
            notifications.push({ id: doc.id, ...data });
        });

        latestNotifications = notifications;
        renderNotifications(notifications, unreadCount);
    }, (error) => {
        console.error("Notification listener error:", error);
    });
}

function renderNotifications(notifs, unreadCount) {
    const badge = document.getElementById('notif-badge-icon');
    const list = document.getElementById('notif-list');

    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'block' : 'none';

    list.innerHTML = notifs.length === 0 ? '<p style="text-align:center; padding:20px;">No notifications yet.</p>' : '';
    
    notifs.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.read ? '' : 'unread'}`;
        item.innerHTML = `
            <div style="font-weight:600;">${n.title}</div>
            <div style="font-size:14px; color:#555;">${n.body}</div>
            ${!n.read ? `<button class="mark-read-btn" data-id="${n.id}">Mark as read</button>` : ''}
        `;
        list.appendChild(item);
    });

    // Attach click events to "Mark as Read" buttons
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.getAttribute('data-id');
            const ref = doc(db, "notifications", id);
            await updateDoc(ref, { read: true });
        };
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    let ui = null;

    onAuthStateChanged(auth, (user) => {
        if (!ui) ui = createUIElements(user);

        if (user) {
            ui.signUpBtn.style.display = 'none';
            ui.container.style.display = 'block';

            // Menu Toggle
            document.getElementById('profile-trigger').onclick = () => {
                const menu = document.getElementById('hl-dropdown');
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            };

            // Modal Toggles
            document.getElementById('open-notifs').onclick = () => {
                ui.modal.classList.add('show');
                document.getElementById('hl-dropdown').style.display = 'none';
            };
            document.getElementById('close-notif-modal').onclick = () => ui.modal.classList.remove('show');
            document.getElementById('hl-logout').onclick = () => signOut(auth);

            initNotificationsListener(user.uid);
        } else {
            ui.signUpBtn.style.display = 'block';
            ui.container.style.display = 'none';
            if (notificationsUnsubscribe) notificationsUnsubscribe();
        }
    });
});
