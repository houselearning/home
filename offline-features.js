(function () {
  var local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  var sourceScript = document.currentScript;
  var features = ["inspect-window moderation", "sign in/sign out", "SafeAI", "Firebase services", "analytics", "cookie preferences", "language and translation tools"];

  window.HouseLearningOnlineFeatures = {
    isLocal: local,
    enabled: !local,
    disabled: local ? features.slice() : [],
    canUse: function () { return !local; }
  };

  var pathParts = location.pathname.split("/").filter(Boolean);
  var subjectIndex = pathParts.findIndex(function (part) { return ["math", "science", "computerscience"].includes(part); });
  var lessonFile = pathParts[pathParts.length - 1] || "";
  var lessonSections = subjectIndex >= 0 ? pathParts.slice(subjectIndex + 1, -1) : [];
  var isLessonPage = subjectIndex >= 0 && /\.html$/i.test(lessonFile) && lessonFile !== "index.html" && !/-shell\.html$/i.test(lessonFile) && !lessonSections.some(function (part) { return ["games", "bin"].includes(part); });
  if (isLessonPage && sourceScript) {
    var loadLessonTools = function () {
      if (document.querySelector("script[data-houselearning-lesson-tools]")) return;
      var progressScript = document.createElement("script");
      progressScript.src = new URL("lesson-progress.js", sourceScript.src).href;
      progressScript.onload = loadExpansionScript;
      document.head.appendChild(progressScript);
    };
    var loadExpansionScript = function () {
      var toolsScript = document.createElement("script");
      toolsScript.src = new URL("lesson-expansion.js", sourceScript.src).href;
      toolsScript.dataset.houselearningLessonTools = "true";
      document.head.appendChild(toolsScript);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadLessonTools, { once: true });
    else loadLessonTools();
  }

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
