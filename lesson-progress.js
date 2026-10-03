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

  function readLocal(lessonId) {
    try {
      return JSON.parse(localStorage.getItem(localKey(lessonId)) || '{}');
    } catch (error) {
      return {};
    }
  }

  function writeLocal(lessonId, values) {
    const existing = readLocal(lessonId);
    const updated = { ...existing, ...values };
    localStorage.setItem(localKey(lessonId), JSON.stringify(updated));
    return { saved: true, local: true };
  }

  async function getLessonProgress(lessonId) {
    if (local) return readLocal(lessonId);
    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) return null;
    const snapshot = await db.collection('UserLessonProgress')
      .doc(user.uid)
      .collection('lessons')
      .doc(lessonId)
      .get();
    return snapshot.exists ? snapshot.data().lessonTools || {} : {};
  }

  async function saveLessonProgress(lessonId, values) {
    if (local) return writeLocal(lessonId, values);
    const { auth, db } = await firebaseServices();
    const user = await currentUser(auth);
    if (!user) return { saved: false, reason: 'signed-out' };
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
    if (!user) return { saved: false, reason: 'signed-out' };
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
    saveLessonProgress,
    saveAttempt
  };
})();