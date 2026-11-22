(function () {
  if (window.HouseLearningSiteNavigation?.ready) return;
  window.HouseLearningSiteNavigation = { ready: true, entries: [] };

  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : `${window.location.origin}/home/site-navigation.js`;
  const stylesheetUrl = new URL('site-navigation.css', scriptUrl).href;
  const searchScriptUrl = new URL('site-navigation-search.js', scriptUrl).href;
  const sitemapUrl = new URL('meta/sitemap.xml', scriptUrl).href;
  const cacheKey = 'houselearning:sitemap-search:v1';
  const mainLinks = [
    ['Home', '/home/'],
    ['Courses', '/home/courses.html'],
    ['Math', '/home/math-page.html'],
    ['Science', '/home/science-page.html'],
    ['Coding', '/home/computer-science-page.html'],
    ['Games', '/home/games.html'],
    ['Learning Hub', '/home/student-learning.html'],
    ['Teachers', '/auth/teacher.html']
  ];

  function addStylesheet() {
    if (document.querySelector('link[data-houselearning-site-nav-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheetUrl;
    link.dataset.houselearningSiteNavStyle = 'true';
    document.head.append(link);
  }

  function makeAnchor(label, href, className = '') {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = label;
    if (className) anchor.className = className;
    return anchor;
  }

  function addSkipLink() {
    if (document.querySelector('.hl-skip-link')) return;
    const target = document.querySelector('main') || document.body;
    if (!target.id) target.id = 'hl-main-content';
    const skip = makeAnchor('Skip to main content', `#${target.id}`, 'hl-skip-link');
    document.body.prepend(skip);
  }

  function findNavigationHost() {
    return document.querySelector('#site-nav')
      || document.querySelector('.navbar-content')
      || document.querySelector('.course-nav')
      || document.querySelector('header nav')
      || document.querySelector('nav.navbar');
  }

  function addMainLinks(host) {
    let links = host.querySelector('.hl-global-nav-links');
    if (!links) {
      links = document.createElement('div');
      links.className = 'hl-global-nav-links';
      links.setAttribute('aria-label', 'HouseLearning main pages');
      host.prepend(links);
    }

    const present = new Set(Array.from(host.querySelectorAll('a')).map(anchor => {
      try { return new URL(anchor.href, window.location.href).pathname; }
      catch (_error) { return ''; }
    }));
    for (const [label, href] of mainLinks) {
      if (!present.has(href)) links.append(makeAnchor(label, href, 'hl-global-nav-link'));
    }
  }

  function buildSearchUi(host) {
    if (host.querySelector('.nav-xml-search')) return null;
    let search = host.querySelector('.hl-sitemap-search');
    if (search) return search;

    search = document.createElement('form');
    search.className = 'hl-sitemap-search';
    search.setAttribute('role', 'search');
    const id = `hl-sitemap-search-${Math.random().toString(36).slice(2, 9)}`;

    const label = document.createElement('label');
    label.className = 'hl-visually-hidden';
    label.htmlFor = `${id}-input`;
    label.textContent = 'Search all HouseLearning pages';

    const input = document.createElement('input');
    input.id = `${id}-input`;
    input.type = 'search';
    input.name = 'q';
    input.placeholder = 'Search all pages';
    input.autocomplete = 'off';
    input.setAttribute('aria-controls', `${id}-results`);
    input.setAttribute('aria-expanded', 'false');

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'hl-search-submit';
    submit.setAttribute('aria-label', 'Open first search result');
    submit.textContent = 'Search';

    const results = document.createElement('div');
    results.id = `${id}-results`;
    results.className = 'hl-sitemap-results';
    results.hidden = true;
    results.setAttribute('role', 'list');
    results.setAttribute('aria-label', 'Sitemap search results');

    const status = document.createElement('span');
    status.className = 'hl-search-status hl-visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    search.append(label, input, submit, results, status);
    host.append(search);
    return search;
  }

  function installHeader() {
    addSkipLink();
    const nav = findNavigationHost();
    if (nav) {
      addMainLinks(nav);
      buildSearchUi(nav.querySelector('.nav-actions') || nav);
      return;
    }

    const header = document.createElement('header');
    header.className = 'hl-global-header';
    header.append(makeAnchor('HouseLearning', '/home/', 'hl-global-brand'));
    const navElement = document.createElement('nav');
    navElement.setAttribute('aria-label', 'HouseLearning main pages');
    addMainLinks(navElement);
    buildSearchUi(navElement);
    header.append(navElement);
    document.body.prepend(header);
  }

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000 && Array.isArray(cached.entries)) {
        return cached.entries;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  async function loadEntries(searchModule) {
    const cached = readCache();
    if (cached) return cached;
    const response = await fetch(sitemapUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Sitemap request failed (${response.status}).`);
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('The sitemap could not be read.');
    const entries = Array.from(xml.querySelectorAll('loc'))
      .map(node => searchModule.normalizeSitemapEntry(node.textContent, sitemapUrl))
      .filter(Boolean);
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), entries })); }
    catch (_error) { /* Session caching is optional. */ }
    return entries;
  }

  function loadSearchApi() {
    if (window.HouseLearningSitemapSearch) return Promise.resolve(window.HouseLearningSitemapSearch);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = searchScriptUrl;
      script.addEventListener('load', () => resolve(window.HouseLearningSitemapSearch), { once: true });
      script.addEventListener('error', () => reject(new Error('Sitemap search module could not load.')), { once: true });
      document.head.append(script);
    });
  }

  function connectSearch(search, searchModule, entries) {
    const input = search.querySelector('input[type="search"]');
    const results = search.querySelector('.hl-sitemap-results');
    const status = search.querySelector('.hl-search-status');

    function render() {
      const matches = searchModule.searchSitemapEntries(entries, input.value, 8);
      results.replaceChildren();
      if (!input.value.trim()) {
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        status.textContent = '';
        return matches;
      }

      if (!matches.length) {
        const empty = document.createElement('p');
        empty.className = 'hl-no-search-results';
        empty.textContent = 'No sitemap pages match that search.';
        results.append(empty);
      } else {
        for (const entry of matches) {
          const item = document.createElement('div');
          item.className = 'hl-sitemap-result';
          const anchor = makeAnchor(entry.title, entry.url, 'hl-sitemap-result-link');
          const path = document.createElement('span');
          path.className = 'hl-sitemap-result-path';
          path.textContent = new URL(entry.url).pathname;
          anchor.append(path);
          item.append(anchor);
          results.append(item);
        }
      }
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      status.textContent = `${matches.length} sitemap ${matches.length === 1 ? 'result' : 'results'}.`;
      return matches;
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      } else if (event.key === 'ArrowDown') {
        const firstLink = results.querySelector('a');
        if (firstLink) {
          event.preventDefault();
          firstLink.focus();
        }
      }
    });
    search.addEventListener('submit', event => {
      event.preventDefault();
      const firstLink = results.querySelector('a');
      if (firstLink) window.location.assign(firstLink.href);
      else input.focus();
    });
    document.addEventListener('click', event => {
      if (!search.contains(event.target)) {
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      }
    });
  }

  async function initialize() {
    if (!document.body) return;
    addStylesheet();
    installHeader();
    const search = document.querySelector('.hl-sitemap-search');
    const status = search && search.querySelector('.hl-search-status');
    if (status) status.textContent = 'Loading sitemap search…';
    try {
      const searchModule = await loadSearchApi();
      if (!searchModule) throw new Error('Sitemap search module did not initialize.');
      const entries = await loadEntries(searchModule);
      window.HouseLearningSiteNavigation.entries = entries;
      if (search && status) connectSearch(search, searchModule, entries);
    } catch (error) {
      if (status) status.textContent = 'Sitemap search is unavailable. Use the main page links instead.';
      console.error('[HouseLearning navigation] Sitemap search failed:', error.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else void initialize();
})();