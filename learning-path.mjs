const PROGRESS_STATES = {
  notStarted: { id: 'not-started', label: 'Not started' },
  inProgress: { id: 'in-progress', label: 'In progress' },
  practicing: { id: 'practicing', label: 'Practicing' },
  developing: { id: 'developing-mastery', label: 'Developing mastery' },
  quizPassed: { id: 'quiz-passed', label: 'Quiz passed' },
  mastered: { id: 'mastered', label: 'Mastered' }
};

function getCourseCoordinates(course) {
  const url = new URL(course.href, 'https://houselearning.org');
  const match = url.pathname.match(/^\/home\/(math|science)\/(k|grade(?:[1-9]|1[0-2]))\/([^/]+)\.html$/i);
  if (!match) throw new Error('Course link is not a supported Math or Science lesson.');

  const [, subject, gradeSection, slug] = match;
  return { subject, gradeSection, slug };
}

export function getCourseProgressId(course) {
  const { subject, gradeSection, slug } = getCourseCoordinates(course);
  if (subject === 'science') return `science_${gradeSection}_${slug}_v1`;
  if (gradeSection === 'grade6') return `grade6_${slug}_v2`;
  if (/^grade\d+$/.test(gradeSection)) return `${gradeSection}_${slug}_v3`;
  return `math_${gradeSection}_${slug}_expansion_v1`;
}

export function getCourseMasteryId(course) {
  const { subject, gradeSection, slug } = getCourseCoordinates(course);
  const grade = gradeSection === 'k' ? 0 : Number(gradeSection.slice(5));
  return `${subject}_${grade}_${slug}`;
}

export function getLessonProgressState(record = {}, masteryRecord = null) {
  if (masteryRecord?.verifiedBy === 'assessment') {
    if (masteryRecord.status === 'mastered') return PROGRESS_STATES.mastered;
    if (masteryRecord.status === 'developing-mastery') return PROGRESS_STATES.developing;
    if (masteryRecord.status === 'practicing') return PROGRESS_STATES.practicing;
  }

  const tools = record.lessonTools || record;
  const latestAttempt = Array.isArray(record.attempts) ? record.attempts.at(-1) : null;
  const quiz = tools.quiz || (latestAttempt?.type === 'lesson-quiz' ? {
    lastScore: latestAttempt.score,
    lastTotal: latestAttempt.total,
    lastPassed: latestAttempt.passed,
    attemptCount: record.attempts.filter(attempt => attempt.type === 'lesson-quiz').length
  } : {});
  const hasScore = Number.isFinite(Number(quiz.lastScore)) && Number(quiz.lastTotal) > 0;
  const attemptCount = Number(quiz.attemptCount || 0);

  if (quiz.lastPassed === true) return PROGRESS_STATES.quizPassed;
  if (attemptCount > 0 || hasScore) {
    return PROGRESS_STATES.practicing;
  }

  const steps = record.steps || tools.steps || {};
  const ivl = tools.ivl || {};
  if (ivl.completed === true || Number(ivl.currentStep) > 0 || Object.values(steps).some(Boolean)) {
    return PROGRESS_STATES.inProgress;
  }
  return PROGRESS_STATES.notStarted;
}

function getCourseUnit(course) {
  const topic = `${course.title} ${course.href}`.toLowerCase();
  if (course.subject === 'math') {
    if (/ratio|rate|proportion/.test(topic)) return 'Ratios and proportional reasoning';
    if (/fraction|decimal|percent/.test(topic)) return 'Fractions, decimals, and percents';
    if (/geometry|shape|angle|triangle|circle|area|perimeter|volume|coordinate|transform|measurement/.test(topic)) return 'Geometry and measurement';
    if (/statistic|data|probability|graph|mean|median|mode/.test(topic)) return 'Data and probability';
    if (/algebra|equation|expression|function|variable|slope|polynomial|quadratic/.test(topic)) return 'Algebra and functions';
    return 'Number sense and operations';
  }

  if (/atom|matter|chemical|chemistry|molecule|acid|base|reaction/.test(topic)) return 'Matter and chemistry';
  if (/force|motion|energy|wave|sound|light|electric|magnet|heat|thermodynamic/.test(topic)) return 'Forces and energy';
  if (/plant|animal|cell|ecosystem|habitat|genetic|evolution|organism|ecology|biome/.test(topic)) return 'Life science';
  return 'Earth and space systems';
}

export function buildLearningPath(courses, progressById = {}, masteryBySkillId = {}) {
  const lessons = courses.map(course => {
    const progressId = getCourseProgressId(course);
    const masteryId = getCourseMasteryId(course);
    const state = getLessonProgressState(progressById[progressId], masteryBySkillId[masteryId]);
    const unitTitle = getCourseUnit(course);
    return { ...course, progressId, masteryId, state, unitTitle };
  });
  const unitMap = new Map();
  for (const lesson of lessons) {
    if (!unitMap.has(lesson.unitTitle)) unitMap.set(lesson.unitTitle, []);
    unitMap.get(lesson.unitTitle).push(lesson);
  }
  const units = [...unitMap.entries()].map(([title, unitLessons]) => ({
    title,
    lessons: unitLessons,
    masteredCount: unitLessons.filter(lesson => lesson.state.id === 'mastered').length
  }));
  const masteredCount = lessons.filter(lesson => lesson.state.id === 'mastered').length;
  const recommendation = lessons.find(lesson => !['mastered', 'quiz-passed'].includes(lesson.state.id)) || null;

  return {
    lessons,
    units,
    masteredCount,
    totalCount: lessons.length,
    recommendation
  };
}