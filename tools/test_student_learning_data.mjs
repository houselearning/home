import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeStudentLearning } from '../student-learning-data.mjs';

const courses = [
  { subject: 'math', grade: 6, gradeLabel: 'Grade 6', title: 'Fractions', href: '/home/math/grade6/fractions.html' },
  { subject: 'science', grade: 6, gradeLabel: 'Grade 6', title: 'Forces', href: '/home/science/grade6/forces.html' }
];

test('new learners receive honest empty activity counts', () => {
  assert.deepEqual(summarizeStudentLearning(courses), {
    savedLessonCount: 0,
    practiceAttemptCount: 0,
    weeklyLessonCount: 0,
    masteredSkillCount: 0,
    continueLesson: null,
    recentLessons: []
  });
});

test('client-authored quiz results count as practice but not verified mastery', () => {
  const summary = summarizeStudentLearning(courses, {
    grade6_fractions_v2: {
      lessonTools: { quiz: { attemptCount: 2, lastScore: 3, lastTotal: 3, lastPassed: true } },
      lessonToolsUpdatedAt: new Date('2026-01-02T00:00:00Z')
    }
  });

  assert.equal(summary.savedLessonCount, 1);
  assert.equal(summary.practiceAttemptCount, 2);
  assert.equal(summary.masteredSkillCount, 0);
  assert.equal(summary.continueLesson.course.title, 'Fractions');
});

test('only server-verified records count toward mastery and recent lessons are ordered', () => {
  const summary = summarizeStudentLearning(courses, {
    grade6_fractions_v2: { steps: { step_1: true }, lastUpdated: new Date('2026-01-01T00:00:00Z') },
    science_grade6_forces_v1: { lessonTools: { ivl: { currentStep: 2 } }, lessonToolsUpdatedAt: new Date('2026-01-03T00:00:00Z') }
  }, {
    science_6_forces: { status: 'mastered', verifiedBy: 'assessment' },
    math_6_fractions: { status: 'mastered', verifiedBy: 'student' }
  });

  assert.equal(summary.masteredSkillCount, 1);
  assert.equal(summary.continueLesson.course.title, 'Forces');
  assert.deepEqual(summary.recentLessons.map(item => item.course.title), ['Forces', 'Fractions']);
});

test('weekly activity counts distinct lessons updated within the rolling seven-day window', () => {
  const now = new Date('2026-11-01T12:00:00Z').getTime();
  const summary = summarizeStudentLearning(courses, {
    grade6_fractions_v2: { steps: { step_1: true }, lastUpdated: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    science_grade6_forces_v1: { lessonTools: { ivl: { currentStep: 2 } }, lessonToolsUpdatedAt: new Date(now - 8 * 24 * 60 * 60 * 1000) },
    unrelated_lesson: { steps: { step_1: true }, lastUpdated: new Date(now) }
  }, {}, now);

  assert.equal(summary.weeklyLessonCount, 1);
});