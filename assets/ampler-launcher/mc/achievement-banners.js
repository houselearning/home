(function () {
  const subjects = ["Math", "Science", "Computer Science"];
  const randomSubject = () => subjects[Math.floor(Math.random() * subjects.length)];

  function ensureStyles() {
    if (document.getElementById("houselearning-achievement-banner-style")) return;

    const style = document.createElement("style");
    style.id = "houselearning-achievement-banner-style";
    style.textContent = `
      .houselearning-achievement-toast {
        position: fixed;
        top: 18px;
        right: 18px;
        width: min(360px, calc(100vw - 28px));
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px 12px 12px;
        background: linear-gradient(180deg, rgba(22, 26, 32, 0.96), rgba(12, 15, 20, 0.95));
        border: 2px solid rgba(139, 172, 255, 0.9);
        border-left: 4px solid #ffd34d;
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.42);
        border-radius: 12px;
        color: #f5f7fb;
        z-index: 2147483647;
        pointer-events: none;
        transform: translateY(-18px);
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .houselearning-achievement-toast.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .houselearning-achievement-icon {
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: linear-gradient(180deg, #ffdb5d, #f4b631);
        color: #19202d;
        font-size: 18px;
        font-weight: 900;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.3);
      }
      .houselearning-achievement-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow: hidden;
      }
      .houselearning-achievement-head {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #ffd75a;
      }
      .houselearning-achievement-body {
        font-size: 14px;
        line-height: 1.3;
        color: #edf3ff;
      }
      @media (max-width: 480px) {
        .houselearning-achievement-toast {
          top: 10px;
          right: 10px;
          left: 10px;
          width: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showBanner(subject) {
    const target = document.getElementById("game_frame") || document.body;
    if (!target) return;

    const toast = document.createElement("div");
    toast.className = "houselearning-achievement-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <div class="houselearning-achievement-icon">★</div>
      <div class="houselearning-achievement-text">
        <div class="houselearning-achievement-head">Need a break?</div>
        <div class="houselearning-achievement-body">Try ${subject} on HouseLearning!</div>
      </div>
    `;

    target.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 320);
    }, 4500);
  }

  function scheduleNext() {
    const minMs = 5 * 60 * 1000;
    const maxMs = 8 * 60 * 1000;
    const delay = minMs + Math.random() * (maxMs - minMs);

    setTimeout(() => {
      showBanner(randomSubject());
      scheduleNext();
    }, delay);
  }

  function init() {
    if (window.__houselearningAchievementBannerReady) return;
    window.__houselearningAchievementBannerReady = true;

    ensureStyles();
    const initialDelay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      showBanner(randomSubject());
      scheduleNext();
    }, initialDelay);
  }

  window.HouseLearningAchievementBanner = { init, showBanner, randomSubject };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
