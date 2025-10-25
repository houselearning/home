// searchbar.js
document.addEventListener("DOMContentLoaded", () => {
  // === Create sticky search bar ===
  const searchContainer = document.createElement("div");
  searchContainer.style.position = "sticky";
  searchContainer.style.top = "0";
  searchContainer.style.zIndex = "9999";
  searchContainer.style.background = "rgba(255,255,255,0.95)";
  searchContainer.style.backdropFilter = "blur(5px)";
  searchContainer.style.padding = "12px 0";
  searchContainer.style.textAlign = "center";
  searchContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
  searchContainer.style.transition = "all 0.3s ease";

  // === Create the input ===
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search cards...";
  searchInput.style.padding = "10px 15px";
  searchInput.style.fontSize = "16px";
  searchInput.style.width = "80%";
  searchInput.style.maxWidth = "500px";
  searchInput.style.border = "2px solid #ccc";
  searchInput.style.borderRadius = "8px";
  searchInput.style.outline = "none";
  searchInput.style.transition = "border-color 0.2s, box-shadow 0.2s";

  searchInput.addEventListener("focus", () => {
    searchInput.style.borderColor = "#007bff";
    searchInput.style.boxShadow = "0 0 5px rgba(0,123,255,0.5)";
  });
  searchInput.addEventListener("blur", () => {
    searchInput.style.borderColor = "#ccc";
    searchInput.style.boxShadow = "none";
  });

  // Add to DOM
  searchContainer.appendChild(searchInput);
  document.body.insertBefore(searchContainer, document.body.firstChild);

  // === Style fade animation for cards ===
  const style = document.createElement("style");
  style.textContent = `
    .card {
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .card.hide {
      opacity: 0;
      transform: scale(0.98);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // === Search function ===
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const match = text.includes(query);

      if (match) {
        card.classList.remove("hide");
        card.style.display = ""; // ensure visible again
      } else {
        card.classList.add("hide");
        setTimeout(() => {
          if (card.classList.contains("hide")) {
            card.style.display = "none";
          }
        }, 250); // match transition time
      }
    });
  });
});
