const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasTeacherAccess,
  isValidUserId,
  normalizeClassInput,
  normalizeCoTeacherEmails,
  normalizeJoinCode
} = require('./teacher-domain');

test('validates class name and description limits', () => {
  assert.deepEqual(normalizeClassInput({ name: ' Algebra 1 ', description: ' Fall term ' }), {
    name: 'Algebra 1',
    description: 'Fall term'
  });
  assert.throws(() => normalizeClassInput({ name: 'x' }), /3 to 80/);
  assert.throws(() => normalizeClassInput({ name: 'Math', description: 'x'.repeat(1001) }), /1000/);
});

test('normalizes only six-character join codes from the supported alphabet', () => {
  assert.equal(normalizeJoinCode('ab2cde'), 'AB2CDE');
  assert.throws(() => normalizeJoinCode('O0I1AA'), /six-character/);
  assert.throws(() => normalizeJoinCode('SHORT'), /six-character/);
});

test('validates and de-duplicates co-teacher email addresses', () => {
  assert.deepEqual(normalizeCoTeacherEmails([' Teacher@Example.org ', 'teacher@example.org']), ['teacher@example.org']);
  assert.throws(() => normalizeCoTeacherEmails(['not-an-email']), /valid email/);
  assert.throws(() => normalizeCoTeacherEmails(Array.from({ length: 6 }, (_, index) => `t${index}@example.org`)), /five/);
  assert.equal(isValidUserId('firebase_uid-123'), true);
  assert.equal(isValidUserId('../admin'), false);
});

test('teacher authorization requires a server token claim or an admin decision', () => {
  assert.equal(hasTeacherAccess({ role: 'teacher' }, false), true);
  assert.equal(hasTeacherAccess({ role: 'student' }, true), true);
  assert.equal(hasTeacherAccess({ role: 'student' }, false), false);
  assert.equal(hasTeacherAccess(null, false), false);
});