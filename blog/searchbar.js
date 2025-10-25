// searchbar.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// === Firebase Setup ===
const firebaseConfig = {
  apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
  authDomain: "contract-center-llc-10.firebaseapp.com",
  projectId: "contract-center-llc-10",
  storageBucket: "contract-center-llc-10.firebasestorage.app",
  messagingSenderId: "323221512767",
  appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  // === Create sticky search bar container ===
  const searchContainer = document.createElement("div");
  searchContainer.style.position = "sticky";
  searchContainer.style.top = "0";
  searchContainer.style.zIndex = "9999";
  searchContainer.style.background = "rgba(255,255,255,0.95)";
  searchContainer.style.backdropFilter = "blur(6px)";
  searchContainer.style.padding = "12px 0";
  searchContainer.style.textAlign = "center";
  searchContainer.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";

  // === Create the input ===
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Loading authentication...";
  searchInput.disabled = true;
  searchInput.style.padding = "10px 15px";
  searchInput.style.fontSize = "16px";
  searchInput.style.width = "80%";
  searchInput.style.maxWidth = "500px";
  searchInput.style.border = "2px solid #ccc";
  searchInput.style.borderRadius = "8px";
  searchInput.style.outline = "none";
  searchInput.style.transition = "border-color 0.2s, box-shadow 0.2s";
  searchContainer.appendChild(searchInput);

  document.body.insertBefore(searchContainer, document.body.firstChild);

  // === Fade animation style for cards ===
  const style = document.createElement("style");
  style.textContent = `
    .card {
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .card.hide {
      opacity: 0;
      transform: scale(0.97);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // === Search logic ===
  const handleSearch = () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".card");
    cards.forEach(card => {
      const match = card.textContent.toLowerCase().includes(query);
      if (match) {
        card.classList.remove("hide");
        card.style.display = "";
      } else {
        card.classList.add("hide");
        setTimeout(() => {
          if (card.classList.contains("hide")) card.style.display = "none";
        }, 250);
      }
    });
  };

  searchInput.addEventListener("input", handleSearch);

  // === Firebase Auth listener ===
  onAuthStateChanged(auth, user => {
    if (user) {
      // ✅ User is signed in
      searchInput.disabled = false;
      searchInput.placeholder = "Search cards...";
      searchInput.style.borderColor = "#28a745";
    } else {
      // 🚫 Not signed in
      searchInput.disabled = true;
      searchInput.placeholder = "Please sign in to search";
      searchInput.value = "";
      const cards = document.querySelectorAll(".card");
      cards.forEach(card => {
        card.classList.remove("hide");
        card.style.display = "";
      });
      searchInput.style.borderColor = "#dc3545";
    }
  });
});
