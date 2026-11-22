(function () {
  if (window.HouseLearningSiteRuntime?.ready || document.querySelector('script[data-houselearning-runtime="true"]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.houselearning.org/home/site-runtime.js';
  script.defer = true;
  script.dataset.houselearningRuntime = 'true';
  document.head.append(script);
})();
