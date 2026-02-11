// also.js — FULL PLUGIN

/* ==============================
   📦 FIREBASE IMPORTS
   ============================== */
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  push
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* ==============================
   🔥 FALLBACK FIREBASE CONFIG
   ============================== */
const fallbackFirebaseConfig = {
    apiKey: "AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw",
    authDomain: "contract-center-llc-10.firebaseapp.com",
    projectId: "contract-center-llc-10",
    storageBucket: "contract-center-llc-10.firebasestorage.app",
    messagingSenderId: "323221512767",
    appId: "1:323221512767:web:6421260f875997dbf64e8a",
};

/* ==============================
   🧠 GLOBAL STATE
   ============================== */
const state = {
  loggedIn: false,
  uuid: "anonymous",
  devtoolsOpen: false
};

/* ==============================
   🔥 FIREBASE INIT (SMART)
   ============================== */
let app;

if (getApps().length > 0) {
  app = getApp();
  console.log("[ALSO] Using existing Firebase app");
} else {
  app = initializeApp(fallbackFirebaseConfig);
  console.log("[ALSO] Initialized Firebase internally");
}

const auth = getAuth(app);
const db = getDatabase(app);

/* ==============================
   🔐 AUTH STATE TRACKING
   ============================== */
onAuthStateChanged(auth, (user) => {
  if (user) {
    state.loggedIn = true;
    state.uuid = user.uid;
    console.log("[ALSO] User is LOGGED IN:", user.uid);
  } else {
    state.loggedIn = false;
    state.uuid = "anonymous";
    console.log("[ALSO] User is NOT LOGGED IN");
  }
});

/* ==============================
   🧾 FIREBASE LOGGER
   ============================== */
function logToFirebase(payload) {
  try {
    push(ref(db, "WarnedTickedDevTools"), {
      ...payload,
      userUUID: state.uuid,
      loggedIn: state.loggedIn,
      time: Date.now()
    });
  } catch (e) {
    console.warn("[ALSO] Firebase logging failed");
  }
}

/* ==============================
   🧠 DEVTOOLS DETECTION
   ============================== */
function detectDevTools() {
  const threshold = 160;
  const opened =
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold;

  if (opened && !state.devtoolsOpen) {
    state.devtoolsOpen = true;

    console.warn(
      "⚠️ WARNING: The Developer Console is not to be used. Misuse may result in punishment."
    );

    console.error("❌ Your DevTools attempt was logged");

    logToFirebase({
      attemptID: crypto.randomUUID(),
      event: "DevToolsOpened"
    });
  }
}

setInterval(detectDevTools, 1000);

/* ==============================
   🪤 CONSOLE INTERCEPT (BEST-EFFORT)
   ============================== */
["log", "warn", "error"].forEach((method) => {
  const original = console[method];

  console[method] = (...args) => {
    if (state.devtoolsOpen) {
      const text = args.join(" ").slice(0, 300);
      logToFirebase({
        attemptID: crypto.randomUUID(),
        pastedContent: text
      });
    }
    original.apply(console, args);
  };
});

/* ==============================
   🌍 LANGUAGE SETTINGS (ALT + L)
   ============================== */
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.key.toLowerCase() === "l") {
    openLanguageModal();
  }
});

function openLanguageModal() {
  if (document.getElementById("also-lang-modal")) return;

  const modal = document.createElement("div");
  modal.id = "also-lang-modal";
  modal.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.4);
      z-index:99999;
      display:flex;
      align-items:center;
      justify-content:center;">
      <div style="
        background:#fff;
        width:320px;
        border-radius:10px;
        padding:16px;
        position:relative;
        font-family:sans-serif;">
        <button id="also-close" style="position:absolute;top:8px;right:8px;">✖</button>
        <h2>Language Settings</h2>
        <select id="also-lang-select" style="width:100%;padding:6px;">
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh-CN">Chinese</option>
        </select>
        <button id="also-save" style="
          margin-top:12px;
          width:100%;
          padding:8px;">
          Save Language Preference
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("also-close").onclick = () => modal.remove();

  document.getElementById("also-save").onclick = () => {
    const lang = document.getElementById("also-lang-select").value;
    localStorage.setItem("also-lang", lang);
    applyTranslation(lang);
    modal.remove();
  };
}

/* ==============================
   🌐 FULL PAGE GOOGLE TRANSLATE + TAB
   ============================== */
function applyTranslation(lang) {
  if (lang === "en") {
    removeTranslationTab();
    return;
  }

  let container = document.getElementById("google_translate_element");
  if (!container) {
    container = document.createElement("div");
    container.id = "google_translate_element";
    container.style.display = "none";
    document.body.appendChild(container);
  }

  if (!window.googleTranslateScriptLoaded) {
    const script = document.createElement("script");
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);
    window.googleTranslateScriptLoaded = true;
  }

  window.googleTranslateElementInit = function () {
    new google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: lang, autoDisplay: true },
      "google_translate_element"
    );

    setTimeout(() => {
      const select = document.querySelector(".goog-te-combo");
      if (select) {
        select.value = lang;
        select.dispatchEvent(new Event("change"));
        createTranslationTab();
      }
    }, 1000);
  };
}

/* ==============================
   🟢 TRANSLATION TAB
   ============================== */
function createTranslationTab() {
  if (document.getElementById("also-translation-tab")) return;

  const tab = document.createElement("div");
  tab.id = "also-translation-tab";
  tab.innerText = "Page Translated";
  Object.assign(tab.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    background: "#007bff",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    zIndex: "999999",
    fontFamily: "sans-serif",
    fontSize: "14px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
  });

  tab.addEventListener("click", () => {
    const el = document.getElementById("google_translate_element");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.body.appendChild(tab);
}

function removeTranslationTab() {
  const tab = document.getElementById("also-translation-tab");
  if (tab) tab.remove();
}

/* ==============================
   🔁 AUTO-APPLY SAVED LANGUAGE
   ============================== */
const savedLang = localStorage.getItem("also-lang");
if (savedLang) applyTranslation(savedLang);
