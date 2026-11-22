import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeSitemapEntry, searchSitemapEntries } = require('../site-navigation-search.js');

test('normalizes only HouseLearning sitemap URLs and creates useful page titles', () => {
  const entry = normalizeSitemapEntry('https://www.houselearning.org/home/math/grade6/absolute-value.html?from=search#practice');
  assert.equal(entry.url, 'https://www.houselearning.org/home/math/grade6/absolute-value.html');
  assert.equal(entry.title, 'Math · Grade 6 · Absolute Value');
  assert.equal(normalizeSitemapEntry('https://example.com/unsafe.html'), null);
  assert.equal(normalizeSitemapEntry('javascript:alert(1)'), null);
});

test('sitemap search matches all terms and respects its result limit', () => {
  const entries = [
    normalizeSitemapEntry('https://www.houselearning.org/home/math/grade6/absolute-value.html'),
    normalizeSitemapEntry('https://www.houselearning.org/home/science/grade6/forces-motion.html'),
    normalizeSitemapEntry('https://www.houselearning.org/home/math/grade7/absolute-value.html')
  ];

  assert.deepEqual(searchSitemapEntries(entries, 'MATH absolute').map(entry => entry.url), [
    'https://www.houselearning.org/home/math/grade6/absolute-value.html',
    'https://www.houselearning.org/home/math/grade7/absolute-value.html'
  ]);
  assert.equal(searchSitemapEntries(entries, 'absolute', 1).length, 1);
  assert.deepEqual(searchSitemapEntries(entries, 'missing'), []);
});