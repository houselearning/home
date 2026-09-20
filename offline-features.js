(function () {
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  var features = ["inspect-window moderation", "sign in/sign out", "SafeAI", "Firebase services", "analytics", "cookie preferences", "language and translation tools"];

  window.HouseLearningOnlineFeatures = {
    isLocal: local,
    enabled: !local,
    disabled: local ? features.slice() : [],
    canUse: function () { return !local; }
  };

  if (!local) return;
  function showNotice() {
    if (document.getElementById("hl-local-features-notice")) return;
    var notice = document.createElement("aside");
    notice.id = "hl-local-features-notice";
    notice.setAttribute("role", "status");
    notice.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;max-width:360px;padding:12px 14px;background:#fff4d6;color:#3b2f00;border:1px solid #d6a72c;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);font:14px/1.4 system-ui,sans-serif";
    notice.textContent = "Hey! HouseLearning.org is currently not saved to web. Features such as: " + features.join(", ") + " will not be usable.";
    (document.body || document.documentElement).appendChild(notice);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showNotice); else showNotice();
})();
