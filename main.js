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

// --- Dynamic Element References ---
let profileContainer = null;
let profilePic = null;
let accountDropdown = null;


// ====================================================================
// 1. DYNAMIC CSS INJECTION
// ====================================================================

/**
 * Creates a <style> block and inserts the necessary CSS rules 
 * for the profile container and dropdown menu into the <head>.
 */
function injectProfileStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* --- Profile Picture & Dropdown Styles (Injected via main.js) --- */
        .profile-container {
            position: fixed; 
            top: 15px;      
            right: 20px;    
            z-index: 2000;  
            display: none;  /* Hidden by default, shown by JS when logged in */
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

        .dropdown-menu {
            position: absolute; 
            top: 50px;          
            right: 0;           
            background-color: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            z-index: 1000;
            min-width: 200px;
            overflow: hidden;
            display: none; /* Hidden by default, toggled by JS */
        }

        .dropdown-menu a {
            color: #333;
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            font-weight: 400;
            font-size: 14px;
            border-radius: 0;
        }

        .dropdown-menu a:hover {
            background-color: #f0f0f0;
            color: #20232a;
        }
    `;
    document.head.appendChild(style);
}


// ====================================================================
// 2. DYNAMIC HTML CREATION & LOGIC
// ====================================================================

/**
 * Creates the entire PFP/Dropdown HTML structure and injects it into the document body.
 */
function createProfileUI(userPhotoURL) {
    const container = document.createElement('div');
    container.className = 'profile-container'; 
    container.id = 'profile-container';
    
    const pic = document.createElement('img');
    pic.src = userPhotoURL || 'https://houselearning.github.io/auth/dashboard/default.png';
    pic.alt = 'Profile Picture';
    pic.className = 'profile-pic'; 
    pic.id = 'profile-pic';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu'; 
    dropdown.id = 'account-dropdown';
    
    dropdown.innerHTML = `
        <a href="#" id="join-class-btn">Join Class</a>
        <a href="https://houselearning.github.io/auth/dashboard" id="account-settings-btn">Account Settings Menu</a>
        <a href="#" id="logout-dropdown-btn">Log Out</a>
    `;

    container.appendChild(pic);
    container.appendChild(dropdown);
    document.body.appendChild(container);
    
    return {
        container: container,
        pic: pic,
        dropdown: dropdown,
        logoutBtn: dropdown.querySelector('#logout-dropdown-btn'),
        joinBtn: dropdown.querySelector('#join-class-btn')
    };
}

function toggleDropdown(dropdownElement) {
    const isVisible = dropdownElement.style.display === 'block';
    dropdownElement.style.display = isVisible ? 'none' : 'block';
}

async function handleLogout() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout failed. Please try again.");
    }
}


// ====================================================================
// 3. MAIN EXECUTION BLOCK (Wrapped in DOMContentLoaded)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inject CSS styles immediately when the DOM is ready
    injectProfileStyles();

    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in.
                if (!profileContainer) {
                    // Create elements only once upon the first login detection
                    const elements = createProfileUI(user.photoURL);
                    profileContainer = elements.container;
                    profilePic = elements.pic;
                    accountDropdown = elements.dropdown;

                    // Attach static listeners
                    profilePic.addEventListener('click', () => toggleDropdown(accountDropdown));
                    elements.logoutBtn.addEventListener('click', handleLogout);
                    elements.joinBtn.addEventListener('click', () => window.location.href = 'https://houselearning.github.io/auth/dashboard.html?action=join');
                    
                    // Global click handler to close the dropdown
                     window.addEventListener('click', (event) => {
                        if (accountDropdown.style.display === 'block' && 
                            !profileContainer.contains(event.target)) {
                            accountDropdown.style.display = 'none';
                        }
                    });
                } 
                
                // Ensure visibility and correct photo URL
                profileContainer.style.display = 'block';
                profilePic.src = user.photoURL || 'https://houselearning.github.io/auth/dashboard/default.png';
                
            } else {
                // User is signed out: Hide the UI
                if (profileContainer) {
                    profileContainer.style.display = 'none';
                    accountDropdown.style.display = 'none';
                }
            }
        });
    }
});
