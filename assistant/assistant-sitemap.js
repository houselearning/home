(function () {
  const DEFAULT_SITEMAP_URL = 'https://www.houselearning.org/meta/sitemap.xml';
  const DEFAULT_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;
  const LOCAL_CACHE_KEY = 'hl-assistant-sitemap-cache-v1';

  const VALID_HOUSELEARNING_PATHS = new Set([
    '/',
    '/index.html',
    '/home/',
    '/home/index.html',
    '/home/about.html',
    '/home/blog.html',
    '/home/games.html',
    '/home/math-page.html',
    '/home/science-page.html',
    '/home/computer-science-page.html',
    '/about.html',
    '/blog.html',
    '/games.html',
    '/math-page.html',
    '/science-page.html',
    '/computer-science-page.html'
  ]);

  function normalizeUrl(value) {
    try {
      const parsed = new URL(value, window.location.origin);
      const pathname = parsed.pathname.replace(/\/index\.html$/i, '/');
      const candidate = new URL(parsed.href);
      candidate.hash = '';
      candidate.search = '';

      if (!/^https?:\/\//i.test(candidate.href)) return value;
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return candidate.href.replace(/^http:\/\/localhost:\d+/i, 'http://localhost:8000');
      }

      if (candidate.hostname === 'houselearning.org' || candidate.hostname === 'www.houselearning.org') {
        const normalizedPath = pathname === '' ? '/' : pathname;
        if (!VALID_HOUSELEARNING_PATHS.has(normalizedPath) && !VALID_HOUSELEARNING_PATHS.has(normalizedPath.replace(/\/$/, ''))) {
          return null;
        }
        return candidate.href;
      }

      return candidate.href;
    } catch (_error) {
      return value;
    }
  }

  function slugify(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function decodeHtmlEntities(value) {
    const el = document.createElement('textarea');
    el.innerHTML = value;
    return el.value;
  }

  function safeTitleFromUrl(url) {
    try {
      const pathname = new URL(url).pathname.replace(/\/+$/, '') || '/';
      const parts = pathname.split('/').filter(Boolean);
      if (!parts.length) return 'HouseLearning';
      return parts
        .map((part) => part.replace(/[-_]/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (_error) {
      return 'HouseLearning';
    }
  }

  function inferCategory(pathname, title) {
    const text = `${pathname} ${title}`.toLowerCase();
    if (text.includes('/math') || text.includes('math')) return 'math';
    if (text.includes('/science') || text.includes('science')) return 'science';
    if (text.includes('/comput') || text.includes('python') || text.includes('coding') || text.includes('programming') || text.includes('javascript')) return 'coding';
    if (text.includes('/games') || text.includes('game')) return 'games';
    if (text.includes('/blog')) return 'blog';
    return 'general';
  }

  function inferGrade(pathname, title) {
    const text = `${pathname} ${title}`.toLowerCase();
    const gradeMatch = text.match(/grade\s*([1-9]|1[0-2])/i);
    if (gradeMatch) return `Grade ${gradeMatch[1]}`;
    return 'general';
  }

  function inferSubject(pathname, title) {
    const text = `${pathname} ${title}`.toLowerCase();
    if (text.includes('algebra') || text.includes('fractions') || text.includes('equation')) return 'math';
    if (text.includes('python') || text.includes('javascript') || text.includes('coding') || text.includes('html') || text.includes('css')) return 'coding';
    if (text.includes('biology') || text.includes('science') || text.includes('physics') || text.includes('chemistry')) return 'science';
    if (text.includes('/math')) return 'math';
    if (text.includes('/science')) return 'science';
    return 'general';
  }

  async function fetchHtmlTitle(url) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) return '';
      const html = await response.text();
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!match) return '';
      return decodeHtmlEntities(match[1].replace(/\s+/g, ' ').trim());
    } catch (_error) {
      return '';
    }
  }

  function hasAssetExtension(pathname) {
    return /\.(?:jpg|jpeg|png|gif|svg|webp|mp4|webm|pdf|zip|ico|xml|json|js|css|txt|map|mp3|wav|ogg)(?:$|[?#])/i.test(pathname);
  }

  function parseSitemapUrls(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    if (!doc || doc.getElementsByTagName('parsererror').length > 0) {
      return [];
    }

    const locNodes = Array.from(doc.querySelectorAll('loc'))
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean)
      .map((value) => normalizeUrl(value))
      .filter(Boolean);

    if (locNodes.length) return locNodes;

    const urls = Array.from(doc.getElementsByTagName('url'))
      .map((entry) => entry.getElementsByTagName('loc')[0]?.textContent || '')
      .map((value) => value.trim())
      .map((value) => normalizeUrl(value))
      .filter(Boolean);

    return urls;
  }

  class SitemapIndexer {
    constructor(options = {}) {
      this.sitemapUrl = options.sitemapUrl || DEFAULT_SITEMAP_URL;
      this.refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL;
      this.cacheKey = options.cacheKey || LOCAL_CACHE_KEY;
      this.index = [];
      this.loadingPromise = null;
    }

    readCache() {
      try {
        const raw = localStorage.getItem(this.cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    }

    writeCache(entries) {
      try {
        localStorage.setItem(this.cacheKey, JSON.stringify({
          fetchedAt: Date.now(),
          entries
        }));
      } catch (_error) {
        // ignore storage errors
      }
    }

    async fetchSitemapIndex(url) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status}`);
      const xmlText = await response.text();
      const locs = parseSitemapUrls(xmlText);
      const urls = locs.filter((candidate) => /sitemap|xml/i.test(candidate) || candidate.includes('meta'));
      if (urls.length && urls.length !== locs.length) {
        return urls;
      }
      return locs;
    }

    async load() {
      const cached = this.readCache();
      if (cached && Date.now() - cached.fetchedAt < this.refreshInterval) {
        this.index = cached.entries;
        return cached.entries;
      }

      if (this.loadingPromise) return this.loadingPromise;

      this.loadingPromise = this.rebuildIndex().finally(() => {
        this.loadingPromise = null;
      });

      return this.loadingPromise;
    }

    async rebuildIndex() {
      let urls = [];
      try {
        const pageUrls = await this.fetchSitemapIndex(this.sitemapUrl);
        const uniqueUrls = [...new Set(pageUrls.map((value) => normalizeUrl(value)).filter(Boolean))];
        urls = uniqueUrls.filter((entry) => {
          try {
            const parsed = new URL(entry);
            return !hasAssetExtension(parsed.pathname) && VALID_HOUSELEARNING_PATHS.has(parsed.pathname.replace(/\/$/, '') || '/')
              && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'houselearning.org' || parsed.hostname === 'www.houselearning.org');
          } catch (_error) {
            return false;
          }
        });
      } catch (error) {
        const cached = this.readCache();
        if (cached && cached.entries?.length) {
          this.index = cached.entries;
          return cached.entries;
        }
        this.index = [];
        return [];
      }

      const indexedEntries = [];
      for (const url of urls) {
        const entry = await this.buildEntryFromUrl(url);
        if (entry) indexedEntries.push(entry);
      }

      this.index = indexedEntries;
      this.writeCache(indexedEntries);
      return indexedEntries;
    }

    async buildEntryFromUrl(url) {
      try {
        const parsed = new URL(url);
        if (hasAssetExtension(parsed.pathname)) return null;
        const title = await fetchHtmlTitle(url);
        const finalTitle = title || safeTitleFromUrl(url);
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        const words = slugify(pathname)
          .split(/\s+|[-_/]+/)
          .map((part) => part.trim())
          .filter(Boolean);

        const item = {
          url,
          title: finalTitle,
          description: finalTitle,
          keywords: [...new Set(words.concat(finalTitle.toLowerCase().split(/\s+/).slice(0, 20)))],
          subject: inferSubject(pathname, finalTitle),
          grade: inferGrade(pathname, finalTitle),
          category: inferCategory(pathname, finalTitle),
          path: pathname
        };

        return item;
      } catch (_error) {
        return null;
      }
    }

    getSearchScores(query, item) {
      const text = `${item.title} ${item.description} ${item.url} ${item.keywords.join(' ')}`.toLowerCase();
      const normalizedQuery = query.toLowerCase();
      const terms = normalizedQuery.split(/\s+/).filter(Boolean);
      let score = 0;

      for (const term of terms) {
        if (!term) continue;
        if (text.includes(term)) score += 8;
        if (item.url.toLowerCase().includes(term)) score += 10;
        if (item.title.toLowerCase().includes(term)) score += 12;
        if (item.keywords.some((keyword) => keyword.toLowerCase().includes(term))) score += 7;
      }

      const synonyms = {
        programming: ['programming', 'coding', 'python', 'javascript', 'html', 'css', 'java', 'computer science'],
        math: ['math', 'mathematics', 'algebra', 'fractions', 'equation', 'grade'],
        science: ['science', 'biology', 'physics', 'chemistry', 'earth'],
        lesson: ['lesson', 'lesson', 'learn', 'study', 'tutorial']
      };

      for (const [concept, phrases] of Object.entries(synonyms)) {
        if (terms.some((term) => concept === term || phrases.some((phrase) => phrase.includes(term) || term.includes(phrase)))) {
          if (item.category === concept || item.subject === concept || text.includes(concept)) score += 5;
        }
      }

      return score;
    }

    findRelevant(query, limit = 5) {
      const normalized = String(query || '').trim();
      if (!normalized) return this.index.slice(0, limit);

      return [...this.index]
        .map((item) => ({ item, score: this.getSearchScores(normalized, item) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.item);
    }
  }

  const indexer = new SitemapIndexer();
  window.HLAssistantSitemap = {
    indexer,
    async init() {
      await indexer.load();
      return indexer.index;
    },
    async getRelevant(query, limit = 5) {
      await indexer.load();
      return indexer.findRelevant(query, limit);
    },
    async getIndex() {
      await indexer.load();
      return indexer.index;
    },
    DEFAULT_SITEMAP_URL,
    DEFAULT_REFRESH_INTERVAL
  };
})();
