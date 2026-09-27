
(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
        authDomain: "contract-center-llc-10.firebaseapp.com",
        projectId: "contract-center-llc-10",
        storageBucket: "contract-center-llc-10.firebasestorage.app",
        messagingSenderId: "323221512767",
        appId: "1:323221512767:web:6421260f875997dbf64e8a"
    };

    function applyMemberGamesAccess(user) {
        const memberGamesContainer = document.getElementById('memberGames');
        const loginOverlay = document.getElementById('loginOverlay');
        const memberGameCards = memberGamesContainer ? memberGamesContainer.querySelectorAll('.game-card') : [];

        if (!memberGamesContainer || !loginOverlay) {
            return;
        }

        if (user) {
            console.log('User is signed in:', user.uid);
            memberGamesContainer.classList.add('active');
            loginOverlay.style.display = 'none';
            memberGameCards.forEach(card => card.classList.remove('disabled-game'));
        } else {
            console.log('User is signed out.');
            memberGamesContainer.classList.remove('active');
            loginOverlay.style.display = 'flex';
            memberGameCards.forEach(card => card.classList.add('disabled-game'));
        }
    }

    function initMemberGamesAuth() {
        if (!window.firebase || !firebase.auth) {
            console.warn('Firebase auth is unavailable for the member games section.');
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const auth = firebase.auth();
        auth.onAuthStateChanged(applyMemberGamesAccess);
        applyMemberGamesAccess(auth.currentUser);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMemberGamesAuth, { once: true });
    } else {
        initMemberGamesAuth();
    }
})();
