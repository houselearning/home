import { summarizeStudentLearning } from './student-learning-data.mjs';

const status = document.getElementById('student-learning-status');
const savedLessonCount = document.getElementById('saved-lesson-count');
const practiceAttemptCount = document.getElementById('practice-attempt-count');
const masteredSkillCount = document.getElementById('mastered-skill-count');
const weeklyGoalForm = document.getElementById('weekly-goal-form');
const weeklyGoalTarget = document.getElementById('weekly-goal-target');
const weeklyGoalStatus = document.getElementById('weekly-goal-status');
const weeklyGoalMeter = document.getElementById('weekly-goal-meter');
const weeklyGoalCount = document.getElementById('weekly-goal-count');
const continueContent = document.getElementById('continue-learning-content');
const recentActivity = document.getElementById('recent-learning-activity');
let currentWeeklyGoal = { target: 3, local: true, saved: false };
let weeklyLessonCount = 0;
let weeklyActivityAvailable = false;

function node(tag, text, className = '') {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function formatActivityTime(value) {
  if (!value) return 'Saved activity';
  return `Last saved ${new Date(value).toLocaleDateString()}`;
}

function lessonItem(course, record, mastery, actionLabel) {
  const item = node('article', undefined, 'student-learning-item');
  const heading = node('h3', course.title);
  const grade = node('p', `${course.subject === 'math' ? 'Math' : 'Science'} · ${course.gradeLabel} · ${mastery?.status === 'mastered' && mastery.verifiedBy === 'assessment' ? 'Mastered' : 'Saved activity'}`);
  const link = node('a', actionLabel);
  link.href = course.href;
  item.append(heading, grade, link);
  return item;
}

function renderEmpty(container, message) {
  container.replaceChildren(node('p', message, 'student-empty-state'));
}

function renderWeeklyGoal() {
  const target = currentWeeklyGoal.target;
  weeklyGoalTarget.value = String(target);
  weeklyGoalMeter.max = target;
  weeklyGoalMeter.hidden = !weeklyActivityAvailable;
  weeklyGoalCount.textContent = weeklyActivityAvailable
    ? `${weeklyLessonCount} of ${target} lessons with saved activity`
    : 'Weekly activity unavailable';
  if (weeklyActivityAvailable) weeklyGoalMeter.value = Math.min(weeklyLessonCount, target);
  if (currentWeeklyGoal.unavailable) {
    weeklyGoalStatus.textContent = 'Account goal storage is unavailable. This goal is saved on this device.';
  } else if (currentWeeklyGoal.synced) {
    weeklyGoalStatus.textContent = 'Device-saved goal synced to your account.';
  } else if (currentWeeklyGoal.local) {
    weeklyGoalStatus.textContent = currentWeeklyGoal.saved
      ? 'Saved on this device.'
      : 'Choose a target to save a goal on this device.';
  } else {
    weeklyGoalStatus.textContent = currentWeeklyGoal.saved
      ? 'Saved to your account.'
      : 'Choose a target and save it to your account.';
  }
}

async function loadDashboard() {
  try {
    const [catalogResponse, progressService] = await Promise.all([
      fetch('./course-catalog.json', { cache: 'no-cache' }),
      Promise.resolve(window.HouseLearningLessonProgress)
    ]);
    if (!catalogResponse.ok) throw new Error('The course catalog is unavailable.');
    if (!progressService) throw new Error('The progress service is unavailable.');
    const [courses, learningData, goal] = await Promise.all([
      catalogResponse.json(),
      progressService.getAllLessonProgress(),
      progressService.getWeeklyGoal()
    ]);
    const records = learningData.records || {};
    const mastery = learningData.mastery || {};
    const summary = summarizeStudentLearning(courses, records, mastery);
    currentWeeklyGoal = goal;
    weeklyLessonCount = summary.weeklyLessonCount;
    weeklyActivityAvailable = true;
    renderWeeklyGoal();

    savedLessonCount.textContent = String(summary.savedLessonCount);
    practiceAttemptCount.textContent = String(summary.practiceAttemptCount);
    masteredSkillCount.textContent = learningData.masteryAvailable ? String(summary.masteredSkillCount) : '—';

    if (summary.continueLesson) {
      const current = summary.continueLesson;
      continueContent.replaceChildren(lessonItem(current.course, current.record, current.masteryRecord, 'Continue lesson'));
      recentActivity.replaceChildren(...summary.recentLessons.map(item => {
        const activity = lessonItem(item.course, item.record, item.masteryRecord, 'Review lesson');
        activity.querySelector('p').textContent = formatActivityTime(item.updatedAt);
        return activity;
      }));
    } else {
      renderEmpty(continueContent, 'No saved lesson activity yet. Choose a subject and grade to start.');
      renderEmpty(recentActivity, 'Your saved practice and lesson activity will appear here.');
    }

    if (learningData.signedIn) {
      const accountStatus = learningData.masteryAvailable
        ? 'Progress is private to your account.'
        : 'Saved lesson activity is available. Verified mastery is unavailable until the updated Firestore rules are deployed.';
      const syncStatus = learningData.deviceSyncAvailable === false
        ? ' Some device-saved activity could not be synced yet.'
        : learningData.deviceSyncCount
          ? ` Synced ${learningData.deviceSyncCount} device-saved lesson record${learningData.deviceSyncCount === 1 ? '' : 's'} to your account.`
          : '';
      status.textContent = accountStatus + syncStatus;
    } else {
      status.textContent = 'Sign in to sync device-saved progress across devices. You can still browse lessons without an account.';
    }
  } catch (error) {
    status.textContent = 'Learning activity could not be loaded. Course links remain available below.';
    renderEmpty(continueContent, 'Saved activity is unavailable right now.');
    renderEmpty(recentActivity, 'Saved activity is unavailable right now.');
    savedLessonCount.textContent = '—';
    practiceAttemptCount.textContent = '—';
    masteredSkillCount.textContent = '—';
    renderWeeklyGoal();
    weeklyGoalStatus.textContent = 'Weekly activity could not be loaded. A goal setting can still be saved.';
    console.error('Unable to load the student learning dashboard:', error);
  }
}

weeklyGoalForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!weeklyGoalForm.reportValidity()) return;
  const target = weeklyGoalTarget.valueAsNumber;
  const saveButton = weeklyGoalForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    const result = await window.HouseLearningLessonProgress.saveWeeklyGoal(target);
    currentWeeklyGoal = { target, local: result.local, saved: true };
    renderWeeklyGoal();
  } catch (error) {
    weeklyGoalStatus.textContent = error.message || 'Could not save your weekly goal.';
  } finally {
    saveButton.disabled = false;
  }
});

void loadDashboard();