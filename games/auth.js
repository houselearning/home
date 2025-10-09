// 1. **REPLACE WITH YOUR FIREBASE CONFIGURATION**
    // Get this from your Firebase project settings
    const firebaseConfig = {
            apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
            authDomain: "contract-center-llc-10.firebaseapp.com",
            projectId: "contract-center-llc-10",
            storageBucket: "contract-center-llc-10.firebasestorage.app",
            messagingSenderId: "323221512767",
            appId: "1:323221512767:web:6421260f875997dbf64e8a",
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();

    // Elements
    const memberGamesContainer = document.getElementById('memberGames');
    const loginOverlay = document.getElementById('loginOverlay');
    const memberGameCards = document.querySelectorAll('#memberGames .game-card');

    // Authentication Check
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in.
            console.log('User is signed in:', user.uid);
            // 1. Enable member games
            memberGamesContainer.classList.add('active');
            // 2. Hide the lock overlay
            loginOverlay.style.display = 'none';
            // 3. Re-enable clicks on individual game cards
            memberGameCards.forEach(card => {
                card.classList.remove('disabled-game');
            });
        } else {
            // User is signed out.
            console.log('User is signed out.');
            // 1. Keep member games disabled (done via CSS classes by default)
            memberGamesContainer.classList.remove('active');
            // 2. Show the lock overlay
            loginOverlay.style.display = 'flex';
            // 3. Disable clicks on individual game cards
            memberGameCards.forEach(card => {
                card.classList.add('disabled-game');
            });
        }
    });
