const test = require('node:test');
const assert = require('node:assert/strict');
const { isForumPath, needsForumModeration } = require('./queue-legacy-forum-content');

test('migration recognizes only Forum post and comment paths', () => {
  assert.equal(isForumPath('artifacts/default-app-id/public/data/forum_posts/post-1', 'post'), true);
  assert.equal(isForumPath('artifacts/default-app-id/public/data/forum_posts/post-1/comments/comment-1', 'comment'), true);
  assert.equal(isForumPath('users/user-1/comments/comment-1', 'comment'), false);
  assert.equal(isForumPath('artifacts/default-app-id/public/data/forum_posts/post-1/comments/comment-1', 'post'), false);
});

test('migration queues only items with missing moderation state', () => {
  assert.equal(needsForumModeration({ title: 'Legacy post' }), true);
  assert.equal(needsForumModeration({ moderationStatus: null }), true);
  assert.equal(needsForumModeration({ moderationStatus: 'approved' }), false);
  assert.equal(needsForumModeration(null), false);
});