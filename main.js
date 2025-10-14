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
let signUpButton = null;
let anonymousPopup = null; // NEW reference for the anonymous pop-up

// --- Local Storage Keys ---
const POPUP_DISMISS_KEY = 'houselearning_popup_dismissed'; 
const AUTH_PAGE_URL = 'https://houselearning.github.io/auth/';


// ====================================================================
// 1. DYNAMIC CSS INJECTION - Includes PFP/Dropdown and NEW Popup Styles
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
            display: none;  /* Hidden by default, shown by JS when logged in */
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
            flex-grow: 1; /* Allow sign-in buttons to fill space */
        }
        #sign-in-popup-btn:hover, #perks-sign-in-btn:hover {
            background-color: #3b78e7;
            border-color: #3b78e7;
        }
        
        #view-perks-btn {
            background-color: white;
            color: #3c4043;
            flex-grow: 1; /* Allow view perks button to fill space */
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
            /* SVG for back arrow */
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

function createProfileUI(userPhotoURL) {
    // ... (PFP Creation Logic - kept short for brevity, but same as before)
    const container = document.createElement('div');
    container.className = 'profile-container'; 
    container.id = 'profile-container';
    
    const pic = document.createElement('img');
    pic.src = userPhotoURL || 'default.png';
    pic.alt = 'Profile Picture';
    pic.className = 'profile-pic'; 
    pic.id = 'profile-pic';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu'; 
    dropdown.id = 'account-dropdown';
    
    dropdown.innerHTML = `
        <a href="#" id="join-class-btn">Join Class</a>
        <a href="dashboard.html" id="account-settings-btn">Account Settings Menu</a>
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
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error);
        // Note: Using alert() here because it's an error handler, but consider a custom modal instead.
        alert("Logout failed. Please try again.");
    }
}


// ====================================================================
// 3. MAIN EXECUTION BLOCK (Wrapped in DOMContentLoaded)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inject CSS styles immediately when the DOM is ready
    injectStyles();

    // Create the Sign Up button element right away (it starts hidden by CSS)
    if (!signUpButton) {
        signUpButton = createAuthButton();
    }
    
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // USER IS LOGGED IN: SHOW PFP, HIDE SIGN UP & POPUP
                
                if (!profileContainer) {
                    const elements = createProfileUI(user.photoURL);
                    profileContainer = elements.container;
                    profilePic = elements.pic;
                    accountDropdown = elements.dropdown;

                    // Attach static listeners
                    profilePic.addEventListener('click', () => toggleDropdown(accountDropdown));
                    elements.logoutBtn.addEventListener('click', handleLogout);
                    elements.joinBtn.addEventListener('click', () => window.location.href = 'dashboard.html?action=join');
                    
                    // Global click handler to close the dropdown
                     window.addEventListener('click', (event) => {
                        if (accountDropdown.style.display === 'block' && 
                            !profileContainer.contains(event.target)) {
                            accountDropdown.style.display = 'none';
                        }
                    });
                } 
                
                // Set visibility
                profileContainer.style.display = 'block';
                profilePic.src = user.photoURL || 'default.png';
                signUpButton.style.display = 'none';
                
                // Hide popup when logged in
                if (anonymousPopup) {
                    anonymousPopup.classList.remove('show');
                }
                // Clear dismissal flag so it shows again on next logout
                localStorage.removeItem(POPUP_DISMISS_KEY); 
                
            } else {
                // USER IS NOT LOGGED IN: HIDE PFP, SHOW SIGN UP & HANDLE POPUP
                
                // 1. Hide PFP
                if (profileContainer) {
                    profileContainer.style.display = 'none';
                    accountDropdown.style.display = 'none';
                }
                
                // 2. Show Sign Up Button
                signUpButton.style.display = 'block';

                // 3. Handle Anonymous Pop-up Logic
                
                // NOTE: We rely on the external cookie banner script to handle consent.
                // Assuming consent means the user is ready for functional elements like this popup.
                const isDismissed = localStorage.getItem(POPUP_DISMISS_KEY) === 'true';

                if (!isDismissed) {
                    setTimeout(() => {
                        // If user signed in during the 3s, abort
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
    }
});
