(function () {
  const config = {
    apiKey: 'AIzaSyDoXSwni65CuY1_32ZE8B1nwfQO_3VNpTw',
    authDomain: 'contract-center-llc-10.firebaseapp.com',
    projectId: 'contract-center-llc-10',
    storageBucket: 'contract-center-llc-10.firebasestorage.app',
    messagingSenderId: '323221512767',
    appId: '1:323221512767:web:6421260f875997dbf64e8a'
  };
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
  let firebasePromise;
  let initialAuthStatePromise;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function firebaseServices() {
    if (local) return null;
    if (!firebasePromise) {
      firebasePromise = (async () => {
        if (!window.firebase) await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
        if (!firebase.auth) await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js');
        if (!firebase.firestore) await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
        return { auth: app.auth(), db: app.firestore() };
      })().catch(error => {
        firebasePromise = null;
        throw error;
      });
    }
    return firebasePromise;
  }

  function currentUser(auth) {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (!initialAuthStatePromise) {
      initialAuthStatePromise = new Promise(resolve => {
        auth.onAuthStateChanged(resolve, () => resolve(null));
      });
    }
    return initialAuthStatePromise.then(() => auth.currentUser);
  }

  function localKey(lessonId) {
    return `houselearning:lesson-progress:${lessonId}`;
  }

  const weeklyGoalKey = 'houselearning:weekly-learning-goal';
  const deviceIdKey = 'houselearning:device-id';

  function getDeviceId() {
    let deviceId = localStorage.getItem(deviceIdKey);
    if (!deviceId) {
      deviceId = window.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(deviceIdKey, deviceId);
    }
    return deviceId;
  }

  function readWeeklyGoal() {
    try {
      const saved = JSON.parse(localStorage.getItem(weeklyGoalKey) || 'null');
      if (Number.isInteger(saved?.target) && saved.target >= 1 && saved.target <= 7) {
        return { target: saved.target, updatedAt: saved.updatedAt || '', saved: true };
      }
    } catch (_error) {
      return { target: 3, saved: false };
    }
    return { target: 3, saved: false };
  }

  function validateWeeklyGoal(target) {
    if (!Number.isInteger(target) || target < 1 || target > 7) {
      throw new Error('Choose a weekly goal from 1 to 7 lessons.');
    }
    return target;
  }

  async function getWeeklyGoal() {
    if (local) return { ...readWeeklyGoal(), local: true };
    try {
      const { auth, db } = await firebaseServices();
      const user = await currentUser(auth);
      if (!user) return { ...readWeeklyGoal(), local: true };
      const snapshot = await db.collection('studentGoals').doc(user.uid).get();
      const localGoal = readWeeklyGoal();
      const remoteGoal = snapshot.exists ? snapshot.data() : null;
      const localUpdatedAt = Date.parse(localGoal.updatedAt || '');
      const remoteUpdatedAt = remoteGoal ? timestampValue(remoteGoal.updatedAt) : 0;
      if (localGoal.saved && (!remoteGoal || (localUpdatedAt && localUpdatedAt > remoteUpdatedAt))) {
        await db.collection('studentGoals').doc(user.uid).set({
          weeklyLessonTarget: localGoal.target,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { ...localGoal, saved: true, local: false, synced: true };
      }
      const target = remoteGoal ? remoteGoal.weeklyLessonTarget : 3;
      return {
        target: Number.isInteger(target) && target >= 1 && target <= 7 ? target : 3,
        saved: Boolean(remoteGoal),
        local: false
      };
    } catch (error) {
      console.warn('Weekly goal storage is unavailable:', error.code || error.message);
      return { ...readWeeklyGoal(), local: true, unavailable: true };
    }
  }

  async function saveWeeklyGoal(target) {
    validateWeeklyGoal(target);
    if (local) {
      localStorage.setItem(weeklyGoalKey, JSON.stringify({ target, updatedAt: new Date().toISOString() }));
      return { saved: true, local: true };
    }

    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) {
      localStorage.setItem(weeklyGoalKey, JSON.stringify({ target, updatedAt: new Date().toISOString() }));
      return { saved: true, local: true };
    }
    await db.collection('studentGoals').doc(user.uid).set({
      weeklyLessonTarget: target,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { saved: true, local: false };
  }

  function readLocal(lessonId) {
    try {
      return JSON.parse(localStorage.getItem(localKey(lessonId)) || '{}');
    } catch (error) {
      return {};
    }
  }

  function readAllLocal() {
    const progress = {};
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith('houselearning:lesson-progress:')) continue;
        const lessonId = key.slice('houselearning:lesson-progress:'.length);
        try {
          progress[lessonId] = JSON.parse(localStorage.getItem(key) || '{}');
        } catch (_error) {
          continue;
        }
      }
    } catch (_error) {
      return progress;
    }
    return progress;
  }

  function writeLocal(lessonId, values) {
    const existing = readLocal(lessonId);
    const updated = {
      ...existing,
      ...values,
      localRevision: Number(existing.localRevision || 0) + 1,
      localUpdatedAt: new Date().toISOString()
    };
    localStorage.setItem(localKey(lessonId), JSON.stringify(updated));
    return { saved: true, local: true };
  }

  function timestampValue(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function localLessonTools(record) {
    const source = record.lessonTools && typeof record.lessonTools === 'object' ? record.lessonTools : record;
    return Object.fromEntries(Object.entries(source).filter(([key]) => ![
      'attempts', 'localRevision', 'localUpdatedAt', 'lessonToolsUpdatedAt',
      'deviceLocalRevision', 'deviceLocalRevisions', 'deviceLocalSyncedAt'
    ].includes(key)));
  }

  function mergeLessonTools(remoteTools, localTools) {
    const merged = { ...localTools, ...remoteTools };
    const remoteSteps = remoteTools.steps || {};
    const localSteps = localTools.steps || {};
    if (Object.keys(remoteSteps).length || Object.keys(localSteps).length) {
      merged.steps = { ...remoteSteps, ...localSteps };
      for (const key of Object.keys(merged.steps)) {
        merged.steps[key] = remoteSteps[key] === true || localSteps[key] === true;
      }
    }

    const remoteIvl = remoteTools.ivl || {};
    const localIvl = localTools.ivl || {};
    if (Object.keys(remoteIvl).length || Object.keys(localIvl).length) {
      const localIsNewer = timestampValue(localIvl.updatedAt) > timestampValue(remoteIvl.updatedAt);
      merged.ivl = {
        ...(localIsNewer ? remoteIvl : localIvl),
        ...(localIsNewer ? localIvl : remoteIvl),
        currentStep: Math.max(Number(remoteIvl.currentStep || 0), Number(localIvl.currentStep || 0)),
        completed: remoteIvl.completed === true || localIvl.completed === true
      };
    }

    for (const key of ['quiz', 'unitTest']) {
      const remoteSummary = remoteTools[key];
      const localSummary = localTools[key];
      if (localSummary && (!remoteSummary
        || timestampValue(localSummary.lastCompletedAt) > timestampValue(remoteSummary.lastCompletedAt))) {
        merged[key] = localSummary;
      }
    }
    return merged;
  }

  function attemptIdentity(attempt) {
    return JSON.stringify([
      attempt.type, attempt.completedAt, attempt.score, attempt.total,
      attempt.subject, attempt.grade, attempt.lessonTitle
    ]);
  }

  function mergeAttempts(remoteAttempts, localAttempts) {
    const merged = Array.isArray(remoteAttempts) ? [...remoteAttempts] : [];
    const known = new Set(merged.map(attemptIdentity));
    const added = [];
    for (const attempt of Array.isArray(localAttempts) ? localAttempts : []) {
      const identity = attemptIdentity(attempt);
      if (known.has(identity)) continue;
      known.add(identity);
      merged.push(attempt);
      added.push(attempt);
    }
    return { attempts: merged.slice(-50), added };
  }

  function buildSyncedRecord(remote, localRecord, deviceId) {
    const remoteTools = remote.lessonTools || {};
    const localTools = localLessonTools(localRecord);
    const lessonTools = mergeLessonTools(remoteTools, localTools);
    const attemptMerge = mergeAttempts(remote.attempts, localRecord.attempts);
    for (const type of ['lesson-quiz', 'unit-test']) {
      const newAttempts = attemptMerge.added.filter(attempt => attempt.type === type);
      if (!newAttempts.length) continue;
      const field = type === 'unit-test' ? 'unitTest' : 'quiz';
      const remoteSummary = remoteTools[field] || {};
      const localSummary = localTools[field] || {};
      const latest = newAttempts.reduce((current, attempt) => (
        timestampValue(attempt.completedAt) > timestampValue(current.completedAt) ? attempt : current
      ));
      const summaryIsNewer = !remoteSummary.lastCompletedAt
        || timestampValue(latest.completedAt) > timestampValue(remoteSummary.lastCompletedAt);
      lessonTools[field] = {
        ...(lessonTools[field] || {}),
        ...(summaryIsNewer ? {
          lastScore: latest.score,
          lastTotal: latest.total,
          lastPassed: latest.passed,
          lastCompletedAt: latest.completedAt
        } : {}),
        attemptCount: remoteSummary.attemptCount !== undefined
          ? Number(remoteSummary.attemptCount) + newAttempts.length
          : Math.max(Number(localSummary.attemptCount || 0), newAttempts.length)
      };
    }

    const payload = {
      lessonTools,
      lessonToolsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deviceLocalRevisions: {
        ...(remote.deviceLocalRevisions || {}),
        [deviceId]: Number(localRecord.localRevision || 0)
      },
      deviceLocalSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (attemptMerge.attempts.length) payload.attempts = attemptMerge.attempts;
    return payload;
  }

  async function syncLocalProgress(db, userId, records = readAllLocal()) {
    let syncedCount = 0;
    const deviceId = getDeviceId();
    for (const [lessonId, localRecord] of Object.entries(records)) {
      if (!lessonId || lessonId.includes('/') || !localRecord || typeof localRecord !== 'object') continue;
      const localRevision = Number(localRecord.localRevision || 0);
      const ref = db.collection('UserLessonProgress').doc(userId).collection('lessons').doc(lessonId);
      const synced = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const remote = snapshot.exists ? snapshot.data() : {};
        const revisions = remote.deviceLocalRevisions || {};
        if (snapshot.exists && Number(revisions[deviceId] ?? -1) >= localRevision) return false;
        transaction.set(ref, buildSyncedRecord(remote, localRecord, deviceId), { merge: true });
        return true;
      });
      if (synced) syncedCount += 1;
    }
    return syncedCount;
  }

  async function getLessonProgress(lessonId) {
    if (local) return readLocal(lessonId);
    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) return readLocal(lessonId);
    const localRecord = readLocal(lessonId);
    if (Object.keys(localRecord).length) await syncLocalProgress(db, user.uid, { [lessonId]: localRecord });
    const snapshot = await db.collection('UserLessonProgress')
      .doc(user.uid)
      .collection('lessons')
      .doc(lessonId)
      .get();
    return snapshot.exists ? snapshot.data().lessonTools || {} : {};
  }

  async function getAllLessonProgress() {
    const localProgress = readAllLocal();
    if (local) return { records: localProgress, mastery: {}, masteryAvailable: false, signedIn: false, local: true };

    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) return { records: localProgress, mastery: {}, masteryAvailable: false, signedIn: false, local: true };

    let deviceSyncAvailable = true;
    let deviceSyncCount = 0;
    try {
      deviceSyncCount = await syncLocalProgress(db, user.uid, localProgress);
    } catch (error) {
      deviceSyncAvailable = false;
      console.warn('Device-saved lesson progress could not be synced:', error.code || error.message);
    }

    const [snapshot, masteryResult] = await Promise.all([
      db.collection('UserLessonProgress').doc(user.uid).collection('lessons').get(),
      db.collection('studentSkillMastery').doc(user.uid).collection('skills').get()
        .then(masterySnapshot => ({ masterySnapshot, available: true }))
        .catch(error => {
          console.warn('Verified skill mastery is not available:', error.code || error.message);
          return { masterySnapshot: null, available: false };
        })
    ]);
    const records = {};
    snapshot.forEach(lesson => { records[lesson.id] = lesson.data(); });
    for (const [lessonId, record] of Object.entries(localProgress)) {
      if (!records[lessonId]) records[lessonId] = record;
    }
    const mastery = {};
    masteryResult.masterySnapshot?.forEach(skill => { mastery[skill.id] = skill.data(); });
    return {
      records,
      mastery,
      masteryAvailable: masteryResult.available,
      signedIn: true,
      local: false,
      deviceSyncAvailable,
      deviceSyncCount
    };
  }

  async function saveLessonProgress(lessonId, values) {
    if (local) return writeLocal(lessonId, values);
    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) return writeLocal(lessonId, values);
    const localRecord = readLocal(lessonId);
    if (Object.keys(localRecord).length) await syncLocalProgress(db, user.uid, { [lessonId]: localRecord });
    const ref = db.collection('UserLessonProgress')
      .doc(user.uid)
      .collection('lessons')
      .doc(lessonId);
    await ref.set({
      lessonTools: values,
      lessonToolsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { saved: true, local: false };
  }

  async function saveAttempt(lessonId, attempt) {
    if (local) {
      const state = readLocal(lessonId);
      const attempts = Array.isArray(state.attempts) ? state.attempts : [];
      attempts.push({ ...attempt, completedAt: new Date().toISOString() });
      return writeLocal(lessonId, { attempts: attempts.slice(-20) });
    }
    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) {
      const state = readLocal(lessonId);
      const attempts = Array.isArray(state.attempts) ? state.attempts : [];
      attempts.push({ ...attempt, completedAt: new Date().toISOString() });
      return writeLocal(lessonId, { attempts: attempts.slice(-20) });
    }
    const localRecord = readLocal(lessonId);
    if (Object.keys(localRecord).length) await syncLocalProgress(db, user.uid, { [lessonId]: localRecord });
    const lessonRef = db.collection('UserLessonProgress')
      .doc(user.uid)
      .collection('lessons')
      .doc(lessonId);
    const attemptRef = lessonRef.collection('attempts').doc();
    const summaryField = attempt.type === 'unit-test' ? 'unitTest' : 'quiz';
    const batch = db.batch();
    batch.set(attemptRef, {
      type: attempt.type,
      subject: attempt.subject,
      grade: attempt.grade,
      lessonId,
      lessonTitle: attempt.lessonTitle,
      score: attempt.score,
      total: attempt.total,
      passed: attempt.passed,
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.set(lessonRef, {
      lessonTools: {
        [summaryField]: {
          lastScore: attempt.score,
          lastTotal: attempt.total,
          lastPassed: attempt.passed,
          lastCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
          attemptCount: firebase.firestore.FieldValue.increment(1)
        }
      },
      lessonToolsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();
    return { saved: true, local: false };
  }

  window.HouseLearningLessonProgress = {
    getLessonProgress,
    getAllLessonProgress,
    getWeeklyGoal,
    saveWeeklyGoal,
    saveLessonProgress,
    saveAttempt
  };
})();