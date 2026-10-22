import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCourses } from '../course-search.mjs';

const courses = [
  { subject: 'science', grade: 4, gradeLabel: 'Grade 4', title: 'Energy and Motion', href: '/home/science/grade4/energy.html' },
  { subject: 'math', grade: 4, gradeLabel: 'Grade 4', title: 'Fractions on a Number Line', href: '/home/math/grade4/fractions.html' },
  { subject: 'math', grade: 0, gradeLabel: 'Kindergarten', title: 'Counting to Ten', href: '/home/math/k/counting.html' }
];

test('filters by subject and grade without losing real course destinations', () => {
  assert.deepEqual(filterCourses(courses, { subject: 'math', grade: '4' }).map(course => course.href), [
    '/home/math/grade4/fractions.html'
  ]);
});

test('search matches all terms independent of order and case', () => {
  assert.deepEqual(filterCourses(courses, { query: 'MOTION energy' }).map(course => course.title), [
    'Energy and Motion'
  ]);
});

test('kindergarten remains selectable as grade zero', () => {
  assert.deepEqual(filterCourses(courses, { grade: '0' }).map(course => course.gradeLabel), ['Kindergarten']);
});