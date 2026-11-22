import test from 'node:test';
import assert from 'node:assert/strict';
import { getTranslation, translations } from '../site-i18n.mjs';

test('core course and home interface strings exist in English, Spanish, and Turkish', () => {
  const landingPageKeys = [
    'page.games.title', 'page.computing.title', 'games.heading', 'games.searchPlaceholder',
    'cs.lessonOfDay', 'cs.lessonOfDayDescription', 'cs.refresh', 'cs.viewLesson',
    'cs.codeSnippetOfDay', 'cs.generatingSnippet', 'cs.copy', 'cs.download', 'cs.run', 'cs.output'
  ];
  for (const locale of ['en', 'es', 'tr']) {
    assert.ok(translations[locale]['courses.heading']);
    assert.ok(translations[locale]['courses.searchLabel']);
    assert.ok(translations[locale]['nav.courses']);
    assert.ok(translations[locale]['nav.assessments']);
    assert.ok(translations[locale]['home.description']);
    for (const key of landingPageKeys) assert.ok(translations[locale][key], `${locale} is missing ${key}`);
  }
});

test('translation templates substitute result counts and fall back to English', () => {
  assert.equal(getTranslation('courses.lessonMany', 'es', { count: 12 }), '12 lecciones');
  assert.equal(getTranslation('courses.heading', 'unsupported'), translations.en['courses.heading']);
});