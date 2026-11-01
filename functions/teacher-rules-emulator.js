const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} = require('firebase/firestore');

const projectId = 'demo-houselearning-teacher';
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  });
});

after(async () => {
  await environment?.cleanup();
});

beforeEach(async () => {
  await environment.clearFirestore();
});

function db(uid, claims = {}) {
  return environment.authenticatedContext(uid, claims).firestore();
}

async function seedDocuments(documents) {
  await environment.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore();
    await Promise.all(documents.map(([documentPath, data]) =>
      setDoc(doc(firestore, documentPath), data)));
  });
}

const activeClass = (teacherId = 'teacher-a', extra = {}) => ({
  name: 'Algebra',
  description: '',
  teacherId,
  coTeacherIds: ['co-teacher'],
  archived: false,
  ...extra
});

test('collection-group membership discovery returns only the authenticated student records', async () => {
  await seedDocuments([
    ['classes/class-a', activeClass()],
    ['classes/class-a/members/student-a', { studentId: 'student-a' }],
    ['classes/class-b', activeClass('teacher-b')],
    ['classes/class-b/members/student-a', { studentId: 'student-a' }],
    ['classes/class-b/members/student-b', { studentId: 'student-b' }]
  ]);

  const student = db('student-a');
  const ownMemberships = await assertSucceeds(getDocs(query(
    collectionGroup(student, 'members'),
    where('studentId', '==', 'student-a')
  )));
  assert.equal(ownMemberships.size, 2);
  await assertFails(getDocs(query(
    collectionGroup(student, 'members'),
    where('studentId', '==', 'student-b')
  )));
});

test('lesson progress collection reads are limited to the owning student', async () => {
  await seedDocuments([
    ['UserLessonProgress/student-a/lessons/math-grade6-topic', {
      lessonTools: { quiz: { lastScore: 2, lastTotal: 3, lastPassed: true } }
    }],
    ['UserLessonProgress/student-b/lessons/math-grade6-topic', {
      lessonTools: { quiz: { lastScore: 1, lastTotal: 3, lastPassed: false } }
    }]
  ]);

  const ownLessons = await assertSucceeds(getDocs(collection(db('student-a'), 'UserLessonProgress', 'student-a', 'lessons')));
  assert.equal(ownLessons.size, 1);
  await assertFails(getDocs(collection(db('student-a'), 'UserLessonProgress', 'student-b', 'lessons')));
});

test('mastery evidence is readable only by its student and never client-writable', async () => {
  await seedDocuments([
    ['studentSkillMastery/student-a/skills/math_6_fractions', {
      status: 'mastered', verifiedBy: 'assessment', assessmentId: 'math-6-review'
    }],
    ['studentSkillMastery/student-b/skills/math_6_fractions', {
      status: 'mastered', verifiedBy: 'assessment', assessmentId: 'math-6-review'
    }]
  ]);

  const ownSkill = doc(db('student-a'), 'studentSkillMastery/student-a/skills/math_6_fractions');
  await assertSucceeds(getDoc(ownSkill));
  await assertFails(getDoc(doc(db('student-a'), 'studentSkillMastery/student-b/skills/math_6_fractions')));
  await assertFails(setDoc(doc(db('student-a'), 'studentSkillMastery/student-a/skills/new-skill'), {
    status: 'mastered', verifiedBy: 'assessment'
  }));
  await assertFails(updateDoc(ownSkill, { status: 'mastered' }));
});

test('profile fields cannot self-grant teacher or administrator access', async () => {
  await assertFails(setDoc(doc(db('student-a'), 'user_profiles/student-a'), {
    role: 'teacher'
  }));
  await assertFails(setDoc(doc(db('student-a'), 'user_profiles/student-a'), {
    admin: true
  }));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'classes/class-a')));
});

test('class and roster access is scoped to the lead teacher, co-teachers, and members', async () => {
  await seedDocuments([
    ['classes/class-a', activeClass()],
    ['classes/class-a/members/student-a', { studentId: 'student-a' }],
    ['classes/class-a/members/student-b', { studentId: 'student-b' }]
  ]);

  await assertSucceeds(getDoc(doc(db('teacher-a', { role: 'teacher' }), 'classes/class-a')));
  await assertSucceeds(getDoc(doc(db('co-teacher', { role: 'teacher' }), 'classes/class-a')));
  await assertSucceeds(getDoc(doc(db('student-a'), 'classes/class-a')));
  await assertFails(getDoc(doc(db('teacher-b', { role: 'teacher' }), 'classes/class-a')));
  await assertFails(getDoc(doc(db('student-a'), 'classes/class-a/members/student-b')));
  await assertFails(setDoc(doc(db('student-a'), 'classes/class-a/members/student-c'), {
    studentId: 'student-c'
  }));
  await assertFails(updateDoc(doc(db('teacher-b', { role: 'teacher' }), 'classes/class-a'), {
    teacherId: 'teacher-b',
    updatedAt: serverTimestamp()
  }));
});

test('verified students may apply, but unverified students and non-admins cannot review applications', async () => {
  const application = {
    userId: 'student-a',
    email: 'student@example.org',
    displayName: 'Student A',
    school: '',
    experience: 'For class work',
    status: 'pending',
    submittedAt: serverTimestamp()
  };
  await assertSucceeds(setDoc(
    doc(db('student-a', { email: 'student@example.org', email_verified: true }), 'teacherApplications/student-a'),
    application
  ));
  await assertFails(setDoc(
    doc(db('student-b', { email: 'student@example.org', email_verified: false }), 'teacherApplications/student-b'),
    { ...application, userId: 'student-b' }
  ));
  await assertFails(updateDoc(doc(db('student-a'), 'teacherApplications/student-a'), {
    status: 'approved',
    reviewedBy: 'student-a',
    reviewedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db('admin-a', { admin: true }), 'teacherApplications/student-a'), {
    status: 'approved',
    reviewedBy: 'admin-a',
    reviewedAt: serverTimestamp()
  }));
});

test('students read published class assignments and only their own ungraded work', async () => {
  await seedDocuments([
    ['classes/class-a', activeClass()],
    ['classes/class-a/members/student-a', { studentId: 'student-a' }],
    ['classes/class-a/members/student-b', { studentId: 'student-b' }],
    ['assignments/published-a', {
      classId: 'class-a', teacherId: 'teacher-a', title: 'Practice', points: 10, status: 'published'
    }],
    ['assignments/draft-a', {
      classId: 'class-a', teacherId: 'teacher-a', title: 'Draft', points: 10, status: 'draft'
    }],
    ['assignments/published-a/submissions/student-b', {
      studentId: 'student-b', response: 'private work', attachmentUrls: [], submittedAt: Timestamp.now()
    }]
  ]);

  const student = db('student-a');
  const published = await assertSucceeds(getDocs(query(
    collection(student, 'assignments'),
    where('classId', '==', 'class-a'),
    where('status', '==', 'published')
  )));
  assert.equal(published.size, 1);
  await assertFails(getDoc(doc(student, 'assignments/draft-a')));
  await assertFails(getDoc(doc(student, 'assignments/published-a/submissions/student-b')));

  const ownWork = doc(student, 'assignments/published-a/submissions/student-a');
  await assertSucceeds(setDoc(ownWork, {
    studentId: 'student-a', response: 'first answer', attachmentUrls: [], submittedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(ownWork, {
    response: 'updated answer', submittedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(ownWork, {
    score: 10, feedback: 'Perfect', gradedBy: 'student-a', gradedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db('teacher-a', { role: 'teacher' }), 'assignments/published-a/submissions/student-a'), {
    score: 8, feedback: 'Good work', gradedBy: 'teacher-a', gradedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(ownWork, {
    response: 'changed after grading', submittedAt: serverTimestamp()
  }));
});

test('class activity is readable to members and writable only by instructors', async () => {
  await seedDocuments([
    ['classes/class-a', activeClass()],
    ['classes/class-a/members/student-a', { studentId: 'student-a' }]
  ]);

  const teacher = db('teacher-a', { role: 'teacher' });
  const student = db('student-a');
  const outsider = db('student-b');
  const startsAt = Timestamp.fromDate(new Date(Date.now() + 60_000));
  const endsAt = Timestamp.fromDate(new Date(Date.now() + 120_000));

  await assertSucceeds(setDoc(doc(teacher, 'classes/class-a/announcements/a1'), {
    authorId: 'teacher-a', body: 'Welcome', createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(teacher, 'classes/class-a/materials/m1'), {
    title: 'Reading', url: 'https://example.org/read', kind: 'reading',
    createdBy: 'teacher-a', createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(teacher, 'classes/class-a/sessions/s1'), {
    title: 'Live lesson', startsAt, endsAt, createdBy: 'teacher-a', createdAt: serverTimestamp()
  }));

  await assertSucceeds(getDoc(doc(student, 'classes/class-a/announcements/a1')));
  await assertSucceeds(getDoc(doc(student, 'classes/class-a/materials/m1')));
  await assertSucceeds(getDoc(doc(student, 'classes/class-a/sessions/s1')));
  await assertFails(getDoc(doc(outsider, 'classes/class-a/announcements/a1')));
  await assertFails(setDoc(doc(teacher, 'classes/class-a/materials/m2'), {
    title: 'Unsafe', url: 'http://example.org', kind: 'resource',
    createdBy: 'teacher-a', createdAt: serverTimestamp()
  }));
});

test('lead teachers can restore archived classes while members cannot access archived work', async () => {
  await seedDocuments([
    ['classes/class-a', activeClass('teacher-a', { archived: true })],
    ['classes/class-a/members/student-a', { studentId: 'student-a' }],
    ['classes/class-a/announcements/a1', { authorId: 'teacher-a', body: 'Saved', createdAt: Timestamp.now() }],
    ['assignments/published-a', {
      classId: 'class-a', teacherId: 'teacher-a', title: 'Saved work', points: 10, status: 'published'
    }]
  ]);

  const lead = db('teacher-a', { role: 'teacher' });
  const coTeacher = db('co-teacher', { role: 'teacher' });
  const student = db('student-a');
  await assertSucceeds(getDoc(doc(lead, 'classes/class-a')));
  await assertFails(getDoc(doc(coTeacher, 'classes/class-a')));
  await assertSucceeds(getDoc(doc(student, 'classes/class-a')));
  await assertFails(getDoc(doc(student, 'classes/class-a/announcements/a1')));
  await assertFails(getDoc(doc(student, 'assignments/published-a')));
  await assertFails(updateDoc(doc(db('teacher-b', { role: 'teacher' }), 'classes/class-a'), {
    archived: false, updatedAt: serverTimestamp()
  }));

  await assertSucceeds(updateDoc(doc(lead, 'classes/class-a'), {
    archived: false, updatedAt: serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(student, 'classes/class-a/announcements/a1')));
});