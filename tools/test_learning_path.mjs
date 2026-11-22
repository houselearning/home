import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildLearningPath,
  getCourseMasteryId,
  getCourseProgressId,
  getLessonProgressState
} from '../learning-path.mjs';

test('maps catalog lessons to their existing saved-progress identifiers', () => {
  assert.equal(getCourseProgressId({ href: '/home/math/grade1/add-within-20.html' }), 'grade1_add-within-20_v3');
  assert.equal(getCourseProgressId({ href: '/home/math/grade6/absolute-value.html' }), 'grade6_absolute-value_v2');
  assert.equal(getCourseProgressId({ href: '/home/math/grade12/derivatives-basics.html' }), 'grade12_derivatives-basics_v3');
  assert.equal(getCourseProgressId({ href: '/home/math/k/counting-10.html' }), 'math_k_counting-10_expansion_v1');
  assert.equal(getCourseProgressId({ href: '/home/science/grade6/forces.html' }), 'science_grade6_forces_v1');
  assert.equal(getCourseMasteryId({ href: '/home/math/k/counting-10.html' }), 'math_0_counting-10');
  assert.equal(getCourseMasteryId({ href: '/home/science/grade6/forces.html' }), 'science_6_forces');
  assert.throws(() => getCourseProgressId({ href: '/home/computerscience/python/intro.html' }), /supported/);
});

test('all generated catalog lessons have unique progress and mastery identifiers', async () => {
  const catalog = JSON.parse(await readFile(new URL('../course-catalog.json', import.meta.url), 'utf8'));
  const progressIds = catalog.map(getCourseProgressId);
  const masteryIds = catalog.map(getCourseMasteryId);

  assert.equal(catalog.length, 195);
  assert.equal(new Set(progressIds).size, catalog.length);
  assert.equal(new Set(masteryIds).size, catalog.length);
});

test('lesson progress requires a passing assessment for mastery', () => {
  assert.equal(getLessonProgressState().id, 'not-started');
  assert.equal(getLessonProgressState({ steps: { step_0: true } }).id, 'in-progress');
  assert.equal(getLessonProgressState({ lessonTools: { ivl: { currentStep: 2 } } }).id, 'in-progress');
  assert.equal(getLessonProgressState({ lessonTools: { quiz: { attemptCount: 1, lastScore: 1, lastTotal: 3 } } }).id, 'practicing');
  assert.equal(getLessonProgressState({ lessonTools: { quiz: { attemptCount: 2, lastScore: 2, lastTotal: 3 } } }).id, 'practicing');
  assert.equal(getLessonProgressState({ attempts: [{ type: 'lesson-quiz', score: 2, total: 3, passed: true }] }).id, 'quiz-passed');
  assert.equal(getLessonProgressState({ lessonTools: { quiz: { lastPassed: true } } }).id, 'quiz-passed');
  assert.equal(getLessonProgressState({}, { status: 'mastered', verifiedBy: 'assessment' }).id, 'mastered');
  assert.equal(getLessonProgressState({}, { status: 'developing-mastery', verifiedBy: 'assessment' }).id, 'developing-mastery');
  assert.notEqual(getLessonProgressState({ steps: { step_8: true } }).id, 'mastered');
});

test('path recommends unfinished lessons and only counts verified mastery', () => {
  const path = buildLearningPath([
    { subject: 'math', grade: 1, title: 'Addition', href: '/home/math/grade1/add.html' },
    { subject: 'math', grade: 1, title: 'Shapes', href: '/home/math/grade1/shapes.html' }
  ], {
    grade1_add_v3: { lessonTools: { quiz: { lastPassed: true } } }
  }, {
    math_1_add: { status: 'mastered', verifiedBy: 'assessment' }
  });

  assert.equal(path.masteredCount, 1);
  assert.equal(path.totalCount, 2);
  assert.equal(path.recommendation.title, 'Shapes');
});

test('path groups lessons into topic-based units without losing lesson links', () => {
  const path = buildLearningPath([
    { subject: 'math', grade: 6, title: 'Equivalent Fractions', href: '/home/math/grade6/equivalent-fractions.html' },
    { subject: 'math', grade: 6, title: 'Triangle Area', href: '/home/math/grade6/triangle-area.html' },
    { subject: 'science', grade: 6, title: 'Cell Structure', href: '/home/science/grade6/cell-structure.html' }
  ]);

  assert.deepEqual(path.units.map(unit => unit.title), [
    'Fractions, decimals, and percents',
    'Geometry and measurement',
    'Life science'
  ]);
  assert.equal(path.units.reduce((count, unit) => count + unit.lessons.length, 0), 3);
  assert.equal(path.units[0].lessons[0].href, '/home/math/grade6/equivalent-fractions.html');
});