// main.js

// 🚨 IMPORTANT: Use the same config as in auth.js and app.js
const firebaseConfig = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

// Initialize Firebase App
let app;
let auth;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
} catch (error) {
    console.error("Firebase initialization failed on main page:", error);
}

// Get DOM elements
const profileContainer = document.getElementById('profile-container');
const profilePic = document.getElementById('profile-pic');
const accountDropdown = document.getElementById('account-dropdown');
const logoutDropdownBtn = document.getElementById('logout-dropdown-btn');
const joinClassBtn = document.getElementById('join-class-btn');

/**
 * Toggles the visibility of the account dropdown menu.
 */
function toggleDropdown() {
    // If the dropdown is currently visible, hide it. Otherwise, show it.
    const isVisible = accountDropdown.style.display === 'block';
    accountDropdown.style.display = isVisible ? 'none' : 'block';
}

/**
 * Handles the logout process.
 */
async function handleLogout() {
    try {
        await auth.signOut();
        // The onAuthStateChanged listener will handle UI update/page refresh
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}

/**
 * Handles the Join Class action.
 * NOTE: Since the full app.js `joinClass` function isn't available here, 
 * we'll link to the dashboard and let the user click Join Class there.
 */
function handleJoinClass() {
    window.location.href = 'dashboard.html';
}

// --- Main Auth State Listener ---
if (auth) {
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in: Show profile picture and container
            profileContainer.style.display = 'block';

            // Use the user's photoURL if available, otherwise use default.png
            if (user.photoURL) {
                profilePic.src = user.photoURL;
            } else {
                profilePic.src = 'https://houselearning.github.io/auth/dashboard/default.png'; // Ensure default.png is in the correct directory
            }

            // Attach event listeners for the profile UI
            profilePic.addEventListener('click', toggleDropdown);
            logoutDropdownBtn.addEventListener('click', handleLogout);
            joinClassBtn.addEventListener('click', handleJoinClass);

            // Hide dropdown when clicking anywhere else on the window
            window.addEventListener('click', (event) => {
                if (accountDropdown.style.display === 'block' && 
                    !profileContainer.contains(event.target)) {
                    accountDropdown.style.display = 'none';
                }
            });

        } else {
            // User is signed out: Hide profile picture
            profileContainer.style.display = 'none';
            accountDropdown.style.display = 'none'; // Ensure dropdown is hidden too
            
            // Revert profile pic to default for next sign-in (in case a photoURL was used)
            profilePic.src = 'https://houselearning.github.io/auth/dashboard/default.png'; 
            
            // Remove listeners to prevent memory leaks (good practice)
            profilePic.removeEventListener('click', toggleDropdown);
            logoutDropdownBtn.removeEventListener('click', handleLogout);
            joinClassBtn.removeEventListener('click', handleJoinClass);
        }
    });
}
