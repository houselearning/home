import { filterCourses } from './course-search.mjs';
import { getTranslation } from './site-i18n.mjs';

const searchInput = document.getElementById('course-search');
const subjectSelect = document.getElementById('course-subject');
const gradeSelect = document.getElementById('course-grade');
const resultList = document.getElementById('course-results');
const resultCount = document.getElementById('course-count');
const status = document.getElementById('course-status');
let courses = [];

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
  } catch (error) {
    status.textContent = getTranslation('courses.unavailable');
    resultCount.textContent = 'Catalog unavailable';
    console.error('Unable to load HouseLearning course catalog:', error);
  }
}

searchInput.addEventListener('input', renderCourses);
subjectSelect.addEventListener('change', renderCourses);
gradeSelect.addEventListener('change', renderCourses);
document.addEventListener('houselearning:localechange', renderCourses);
void loadCourses();