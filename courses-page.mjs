import { filterCourses } from './course-search.mjs';
import { buildLearningPath } from './learning-path.mjs';
import { getTranslation } from './site-i18n.mjs';

const searchInput = document.getElementById('course-search');
const subjectSelect = document.getElementById('course-subject');
const gradeSelect = document.getElementById('course-grade');
const resultList = document.getElementById('course-results');
const resultCount = document.getElementById('course-count');
const status = document.getElementById('course-status');
const pathSubject = document.getElementById('path-subject');
const pathGrade = document.getElementById('path-grade');
const pathStatus = document.getElementById('path-status');
const pathOverview = document.getElementById('path-overview');
const pathProgressCopy = document.getElementById('path-progress-copy');
const pathProgressMeter = document.getElementById('path-progress-meter');
const pathProgressFill = document.getElementById('path-progress-fill');
const pathRecommendation = document.getElementById('path-recommendation');
const pathList = document.getElementById('learning-path-list');
const printPathButton = document.getElementById('print-path');
const unitReviewLink = document.getElementById('path-unit-review');
const requestedPath = new URLSearchParams(window.location.search);
let courses = [];
let progressByLessonId = {};
let masteryBySkillId = {};
let progressLoadState = 'loading';
let masteryDataAvailable = false;

if (['math', 'science'].includes(requestedPath.get('pathSubject'))) {
  pathSubject.value = requestedPath.get('pathSubject');
}
if (/^(?:0|[1-9]|1[0-2])$/.test(requestedPath.get('pathGrade') || '')) {
  pathGrade.value = requestedPath.get('pathGrade');
}

function renderCourses() {
  const results = filterCourses(courses, {
    query: searchInput.value,
    subject: subjectSelect.value,
    grade: gradeSelect.value
  });
  const fragment = document.createDocumentFragment();

  for (const course of results) {
    const row = document.createElement('article');
    row.className = 'course-row';

    const subject = document.createElement('span');
    subject.className = `subject-label subject-${course.subject}`;
    subject.textContent = getTranslation(course.subject === 'math' ? 'courses.math' : 'courses.science');

    const grade = document.createElement('span');
    grade.className = 'grade-label';
    grade.textContent = course.gradeLabel;

    const title = document.createElement('h2');
    title.textContent = course.title;

    const link = document.createElement('a');
    link.className = 'open-course';
    link.textContent = getTranslation('courses.openLesson');
    link.href = course.href;
    link.setAttribute('aria-label', `${getTranslation('courses.openLesson')}: ${course.title}, ${course.gradeLabel}`);

    const description = document.createElement('div');
    description.className = 'course-description';
    description.append(subject, grade, title);
    row.append(description, link);
    fragment.appendChild(row);
  }

  resultList.replaceChildren(fragment);
  const countKey = results.length === 1 ? 'courses.lessonOne' : 'courses.lessonMany';
  resultCount.textContent = getTranslation(countKey, undefined, { count: results.length });
  status.textContent = results.length ? '' : getTranslation('courses.empty');
}

function renderLearningPath() {
  const grade = pathGrade.value;
  pathList.replaceChildren();
  pathOverview.hidden = true;
  printPathButton.disabled = grade === '';

  if (grade === '') {
    document.getElementById('path-title').textContent = 'Build understanding, one lesson at a time';
    pathStatus.textContent = 'Choose a grade to view its lessons.';
    unitReviewLink.href = 'lesson-assessments.html';
    return;
  }
  if (progressLoadState === 'loading') {
    pathStatus.textContent = 'Checking saved lesson progress…';
    return;
  }

  const gradeLabel = grade === '0' ? 'Kindergarten' : `Grade ${grade}`;
  const subjectLabel = pathSubject.value === 'math' ? 'Math' : 'Science';
  document.getElementById('path-title').textContent = `${gradeLabel} ${subjectLabel} lesson sequence`;
  const gradeCourses = filterCourses(courses, { subject: pathSubject.value, grade });
  unitReviewLink.href = `lesson-assessments.html?subject=${encodeURIComponent(pathSubject.value)}&grade=${encodeURIComponent(grade)}`;
  if (!gradeCourses.length) {
    pathStatus.textContent = `No ${pathSubject.value} lessons are listed for ${gradeLabel}.`;
    return;
  }

  const path = buildLearningPath(gradeCourses, progressByLessonId, masteryBySkillId);
  const percent = path.totalCount ? Math.round((path.masteredCount / path.totalCount) * 100) : 0;
  const progressAvailable = progressLoadState === 'ready';
  pathStatus.textContent = progressAvailable
    ? `${path.totalCount} ${pathSubject.value} lessons for ${gradeLabel}.${masteryDataAvailable ? '' : ' Verified mastery is unavailable until the updated Firestore rules are deployed.'}`
    : 'Saved progress is unavailable. Lesson links remain open, but personal progress is hidden.';
  pathOverview.hidden = !progressAvailable;
  pathProgressCopy.textContent = `${path.masteredCount} of ${path.totalCount} lessons mastered`;
  pathProgressMeter.setAttribute('aria-valuemax', String(path.totalCount));
  pathProgressMeter.setAttribute('aria-valuenow', String(path.masteredCount));
  pathProgressFill.style.width = `${percent}%`;

  if (progressAvailable && path.recommendation) {
    const text = document.createTextNode(`Next focus: ${path.recommendation.title} `);
    const link = document.createElement('a');
    link.href = path.recommendation.href;
    link.textContent = 'Open lesson';
    pathRecommendation.replaceChildren(text, link);
  } else if (progressAvailable) {
    pathRecommendation.textContent = 'Every listed lesson has a passing quiz result. Continue with the unit review.';
  } else {
    pathRecommendation.replaceChildren();
  }

  const fragment = document.createDocumentFragment();
  let lessonNumber = 0;
  path.units.forEach(unit => {
    const unitItem = document.createElement('li');
    unitItem.className = 'learning-path-unit';
    const unitHeading = document.createElement('div');
    unitHeading.className = 'path-unit-heading';
    const unitTitle = document.createElement('h3');
    unitTitle.textContent = unit.title;
    const unitProgress = document.createElement('span');
    unitProgress.textContent = `${unit.masteredCount} of ${unit.lessons.length} mastered`;
    unitHeading.append(unitTitle, unitProgress);
    const lessonList = document.createElement('ol');
    lessonList.className = 'path-unit-lessons';
    unit.lessons.forEach(lesson => {
      lessonNumber += 1;
      const item = document.createElement('li');
      item.className = 'learning-path-item';

      const number = document.createElement('span');
      number.className = 'path-number';
      number.textContent = String(lessonNumber).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');

      const detail = document.createElement('div');
      detail.className = 'path-lesson-detail';
      const title = document.createElement('h4');
      title.textContent = lesson.title;
      const state = document.createElement('span');
      state.className = `lesson-state ${progressAvailable ? `state-${lesson.state.id}` : 'state-progress-unavailable'}`;
      state.textContent = progressAvailable ? lesson.state.label : 'Progress unavailable';
      const open = document.createElement('a');
      open.className = 'path-open-link';
      open.href = lesson.href;
      open.textContent = 'Open lesson';
      detail.append(title, state);

      item.append(number, detail, open);
      lessonList.append(item);
    });
    unitItem.append(unitHeading, lessonList);
    fragment.append(unitItem);
  });
  pathList.append(fragment);
}

async function loadLearningProgress() {
  try {
    const service = window.HouseLearningLessonProgress;
    if (!service) throw new Error('Lesson progress service is unavailable.');
    const result = await service.getAllLessonProgress();
    progressByLessonId = Object.fromEntries(Object.entries(result.records).map(([id, record]) => {
      const localRecord = record.lessonTools ? record : { ...record, lessonTools: record };
      return [id, localRecord];
    }));
    masteryBySkillId = result.mastery || {};
    masteryDataAvailable = result.masteryAvailable === true;
    progressLoadState = 'ready';
    renderLearningPath();
  } catch (error) {
    progressLoadState = 'failed';
    renderLearningPath();
    console.error('Unable to load learning-path progress:', error);
  }
}

async function loadCourses() {
  try {
    const response = await fetch('./course-catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
    const catalog = await response.json();
    if (!Array.isArray(catalog) || catalog.some(course => (
      !course || !['math', 'science'].includes(course.subject)
      || !Number.isInteger(course.grade) || course.grade < 0 || course.grade > 12
      || typeof course.title !== 'string' || !course.title.trim()
      || typeof course.href !== 'string' || !course.href.startsWith('/home/')
    ))) {
      throw new Error('The course catalog has an invalid record.');
    }
    courses = catalog;
    status.textContent = '';
    renderCourses();
    renderLearningPath();
  } catch (error) {
    status.textContent = getTranslation('courses.unavailable');
    resultCount.textContent = 'Catalog unavailable';
    console.error('Unable to load HouseLearning course catalog:', error);
  }
}

searchInput.addEventListener('input', renderCourses);
subjectSelect.addEventListener('change', renderCourses);
gradeSelect.addEventListener('change', renderCourses);
pathSubject.addEventListener('change', renderLearningPath);
pathGrade.addEventListener('change', renderLearningPath);
printPathButton.addEventListener('click', () => window.print());
document.addEventListener('houselearning:localechange', renderCourses);
void loadCourses();
void loadLearningProgress();