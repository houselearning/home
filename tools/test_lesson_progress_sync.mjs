import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../lesson-progress.js', import.meta.url), 'utf8');

function makeStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function makeService({ localEntries = {}, existingDocuments = {}, user = { uid: 'learner-1' } } = {}) {
  const documents = new Map(Object.entries(existingDocuments).map(([path, value]) => [path, structuredClone(value)]));
  const storage = makeStorage(localEntries);

  function snapshot(path) {
    const value = documents.get(path);
    return { exists: value !== undefined, data: () => value && structuredClone(value) };
  }

  function collection(path) {
    return {
      doc(id) { return document(`${path}/${id}`); },
      async get() {
        const prefix = `${path}/`;
        const docs = [...documents.entries()]
          .filter(([name]) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
          .map(([name, value]) => ({ id: name.slice(prefix.length), data: () => structuredClone(value) }));
        return { docs, forEach(callback) { docs.forEach(callback); } };
      }
    };
  }

  function document(path) {
    return {
      collection(name) { return collection(`${path}/${name}`); },
      async get() { return snapshot(path); },
      async set(value, options = {}) {
        documents.set(path, options.merge ? { ...(documents.get(path) || {}), ...structuredClone(value) } : structuredClone(value));
      }
    };
  }

  const db = {
    collection,
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        get: ref => ref.get(),
        set: (ref, value, options) => writes.push({ ref, value, options })
      };
      const result = await callback(transaction);
      for (const write of writes) await write.ref.set(write.value, write.options);
      return result;
    }
  };
  const auth = { currentUser: user, onAuthStateChanged(callback) { callback(user); } };
  const app = { auth: () => auth, firestore: () => db };
  function firestore() { return db; }
  firestore.FieldValue = { serverTimestamp: () => new Date() };
  const firebase = { apps: [app], app: () => app, auth: () => auth, firestore };
  const sandbox = {
    console,
    crypto: { randomUUID: () => 'device-test' },
    firebase,
    localStorage: storage,
    location: { protocol: 'https:', hostname: 'www.houselearning.org' },
    document: { head: { appendChild() {} } }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  return { service: sandbox.HouseLearningLessonProgress, documents, storage };
}

const localProgressKey = 'houselearning:lesson-progress:grade6_fractions_v2';
const localAttempt = {
  type: 'lesson-quiz',
  subject: 'math',
  grade: 6,
  lessonTitle: 'Fractions',
  score: 3,
  total: 4,
  passed: true,
  completedAt: '2026-10-30T12:00:00.000Z'
};

test('authenticated reads sync local lessons and goals once without duplicating attempts', async () => {
  const { service, documents } = makeService({
    localEntries: {
      [localProgressKey]: JSON.stringify({
        ivl: { currentStep: 2, completed: false, updatedAt: '2026-10-30T11:00:00.000Z' },
        attempts: [localAttempt],
        localRevision: 2
      }),
      'houselearning:weekly-learning-goal': JSON.stringify({ target: 5, updatedAt: '2026-10-30T10:00:00.000Z' })
    }
  });

  const firstRead = await service.getAllLessonProgress();
  const lesson = documents.get('UserLessonProgress/learner-1/lessons/grade6_fractions_v2');
  assert.equal(firstRead.deviceSyncCount, 1);
  assert.equal(lesson.lessonTools.ivl.currentStep, 2);
  assert.equal(lesson.lessonTools.quiz.attemptCount, 1);
  assert.equal(lesson.attempts.length, 1);

  const goal = await service.getWeeklyGoal();
  assert.equal(goal.target, 5);
  assert.equal(goal.local, false);
  assert.equal(documents.get('studentGoals/learner-1').weeklyLessonTarget, 5);

  const secondRead = await service.getAllLessonProgress();
  assert.equal(secondRead.deviceSyncCount, 0);
  assert.equal(documents.get('UserLessonProgress/learner-1/lessons/grade6_fractions_v2').attempts.length, 1);
});

test('local progress merges monotonic steps while retaining newer account quiz data', async () => {
  const { service, documents } = makeService({
    localEntries: {
      [localProgressKey]: JSON.stringify({
        steps: { step_2: true },
        ivl: { currentStep: 2, completed: false, updatedAt: '2026-10-30T11:00:00.000Z' },
        attempts: [localAttempt],
        localRevision: 1
      })
    },
    existingDocuments: {
      'UserLessonProgress/learner-1/lessons/grade6_fractions_v2': {
        lessonTools: {
          steps: { step_1: true },
          ivl: { currentStep: 3, completed: true, updatedAt: '2026-10-29T11:00:00.000Z' },
          quiz: { attemptCount: 4, lastScore: 4, lastTotal: 4, lastPassed: true, lastCompletedAt: '2026-10-31T12:00:00.000Z' }
        },
        deviceLocalRevisions: { 'another-device': 10 }
      }
    }
  });

  await service.getAllLessonProgress();
  const lesson = documents.get('UserLessonProgress/learner-1/lessons/grade6_fractions_v2');
  assert.deepEqual(lesson.lessonTools.steps, { step_1: true, step_2: true });
  assert.equal(lesson.lessonTools.ivl.currentStep, 3);
  assert.equal(lesson.lessonTools.ivl.completed, true);
  assert.equal(lesson.lessonTools.quiz.lastScore, 4);
  assert.equal(lesson.lessonTools.quiz.attemptCount, 5);
  assert.equal(lesson.deviceLocalRevisions['device-test'], 1);
  assert.equal(lesson.deviceLocalRevisions['another-device'], 10);
});