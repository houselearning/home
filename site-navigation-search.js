(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HouseLearningSitemapSearch = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const ALLOWED_HOSTS = new Set(['houselearning.org', 'www.houselearning.org']);
  const SEGMENT_LABELS = new Map([
    ['computerscience', 'Computer Science'],
    ['computer-science-page', 'Computer Science'],
    ['math-page', 'Math'],
    ['science-page', 'Science']
  ]);

  function titleCase(segment) {
    const cleaned = decodeURIComponent(segment)
      .replace(/\.html?$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    if (/^k$/i.test(cleaned)) return 'Kindergarten';
    const grade = cleaned.match(/^grade(\d{1,2})$/i);
    if (grade) return `Grade ${grade[1]}`;
    return cleaned.replace(/\b\w/g, character => character.toUpperCase());
  }

  function normalizeSitemapEntry(value, base = 'https://www.houselearning.org/') {
    try {
      const url = new URL(value, base);
      if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
      url.hash = '';
      url.search = '';
      let segments = url.pathname.split('/').filter(Boolean);
      if (segments[0]?.toLowerCase() === 'home') segments = segments.slice(1);
      if (segments.at(-1)?.toLowerCase() === 'index.html') segments.pop();
      if (segments.length === 0) return { url: url.href, title: 'HouseLearning', searchText: 'houselearning home' };

      const title = segments.map(segment => SEGMENT_LABELS.get(segment.toLowerCase()) || titleCase(segment)).join(' · ');
      return { url: url.href, title, searchText: `${title} ${url.pathname}`.toLocaleLowerCase() };
    } catch (_error) {
      return null;
    }
  }

  function searchSitemapEntries(entries, query, limit = 8) {
    const terms = String(query || '').normalize('NFKD').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return entries
      .filter(entry => terms.every(term => entry.searchText.includes(term)))
      .slice(0, Math.max(0, limit));
  }

  return { normalizeSitemapEntry, searchSitemapEntries };
});