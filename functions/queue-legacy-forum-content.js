const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

const PAGE_SIZE = 400;

function isForumPath(path, type) {
  const segments = String(path || '').split('/');
  if (type === 'post') {
    return segments.length === 6
      && segments[0] === 'artifacts'
      && segments[2] === 'public'
      && segments[3] === 'data'
      && segments[4] === 'forum_posts';
  }
  if (type === 'comment') {
    return segments.length === 8
      && segments[0] === 'artifacts'
      && segments[2] === 'public'
      && segments[3] === 'data'
      && segments[4] === 'forum_posts'
      && segments[6] === 'comments';
  }
  return false;
}

function needsForumModeration(data) {
  return Boolean(data)
    && (!Object.prototype.hasOwnProperty.call(data, 'moderationStatus') || data.moderationStatus == null);
}

async function queueLegacyCollection(db, collectionName, type) {
  let cursor = null;
  let scanned = 0;
  let queued = 0;
  while (true) {
    let pageQuery = db.collectionGroup(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    if (page.empty) break;

    const batch = db.batch();
    let pageQueued = 0;
    for (const document of page.docs) {
      scanned += 1;
      if (!isForumPath(document.ref.path, type) || !needsForumModeration(document.data())) continue;
      batch.update(document.ref, { moderationStatus: 'pending' });
      pageQueued += 1;
    }
    if (pageQueued) {
      await batch.commit();
      queued += pageQueued;
    }
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  }
  return { scanned, queued };
}

async function queueLegacyForumContent(db) {
  const posts = await queueLegacyCollection(db, 'forum_posts', 'post');
  const comments = await queueLegacyCollection(db, 'comments', 'comment');
  return { posts, comments };
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to an authorized service-account JSON file.');
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const result = await queueLegacyForumContent(admin.firestore());
  process.stdout.write(
    `Scanned ${result.posts.scanned} forum posts and ${result.comments.scanned} comments; `
    + `queued ${result.posts.queued} posts and ${result.comments.queued} comments.\n`
  );
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Legacy forum moderation queue failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { isForumPath, needsForumModeration, queueLegacyCollection, queueLegacyForumContent };