const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectImageContentType,
  parseNotificationTarget,
  plainTextFromHtml,
  selectRecipients
} = require('./push-notification-email');

test('parses supported notification subjects and rejects other subjects', () => {
  assert.deepEqual(parseNotificationTarget('@everyone'), { type: 'everyone' });
  assert.deepEqual(parseNotificationTarget('@admins-only'), { type: 'admins' });
  assert.deepEqual(parseNotificationTarget('@students'), { type: 'students' });
  assert.deepEqual(parseNotificationTarget('@teachers'), { type: 'teachers' });
  assert.deepEqual(parseNotificationTarget('@user Learner@Example.com'), {
    type: 'user',
    email: 'learner@example.com'
  });
  assert.equal(parseNotificationTarget('@everyone please'), null);
  assert.equal(parseNotificationTarget('@user learner@example.com extra'), null);
});

test('routes students to non-admin and non-teacher accounts', () => {
  const users = [
    { uid: 'student', email: 'student@example.com' },
    { uid: 'teacher', email: 'teacher@example.com' },
    { uid: 'admin', email: 'admin@example.com', customClaims: { admin: true } }
  ];
  const roles = new Map([['teacher', 'teacher']]);
  assert.deepEqual(selectRecipients(users, roles, { type: 'students' }).map(user => user.uid), ['student']);
  assert.deepEqual(selectRecipients(users, roles, { type: 'teachers' }).map(user => user.uid), ['teacher']);
  assert.deepEqual(selectRecipients(users, roles, { type: 'admins' }).map(user => user.uid), ['admin']);
  assert.deepEqual(selectRecipients(users, roles, { type: 'user', email: 'teacher@example.com' }).map(user => user.uid), ['teacher']);
});

test('converts HTML bodies to inert plain text', () => {
  assert.equal(plainTextFromHtml('<p>Hello &amp; welcome</p><script>bad()</script><p>World</p>').trim(), 'Hello & welcome\nWorld');
});

test('accepts raster image signatures but not arbitrary or SVG data', () => {
  assert.equal(detectImageContentType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(detectImageContentType(Buffer.from('GIF89a')), 'image/gif');
  assert.equal(detectImageContentType(Buffer.from('<svg></svg>')), null);
  assert.equal(detectImageContentType(Buffer.from('not an image')), null);
});