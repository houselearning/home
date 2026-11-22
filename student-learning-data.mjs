import {
  getCourseMasteryId,
  getCourseProgressId,
  getLessonProgressState
} from './learning-path.mjs';

function timestampValue(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isSavedActivity(record) {
  return Boolean(record && (
    || Object.keys(record.lessonTools || {}).length
    || Object.keys(record).some(key => ['ivl', 'quiz', 'unitTest'].includes(key))
    || (Array.isArray(record.attempts) && record.attempts.length)
  ));
}

function getAttemptCount(record) {
  const tools = record.lessonTools || record;
  const summaries = ['quiz', 'unitTest'].reduce((sum, key) => sum + Number(tools[key]?.attemptCount || 0), 0);
  if (summaries) return summaries;
  return Array.isArray(record.attempts) ? record.attempts.length : 0;
}

function activityTime(record) {
  const tools = record.lessonTools || record;
  return Math.max(
    timestampValue(record.lastUpdated),
    timestampValue(record.lessonToolsUpdatedAt),
    timestampValue(tools.quiz?.lastCompletedAt),
    timestampValue(tools.unitTest?.lastCompletedAt)
  );
}

export function summarizeStudentLearning(courses, records = {}, mastery = {}, now = Date.now()) {
  const courseByProgressId = new Map(courses.map(course => [getCourseProgressId(course), course]));
  const savedLessons = Object.entries(records)
    .filter(([, record]) => isSavedActivity(record))
    .map(([progressId, record]) => {
      const course = courseByProgressId.get(progressId);
      const masteryRecord = course ? mastery[getCourseMasteryId(course)] : null;
      return {
        progressId,
        record,
        course,
        masteryRecord,
        state: getLessonProgressState(record, masteryRecord),
        updatedAt: activityTime(record)
      };
    })
    .filter(item => item.course)
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return {
    savedLessonCount: savedLessons.length,
    practiceAttemptCount: Object.values(records).reduce((sum, record) => sum + getAttemptCount(record), 0),
    weeklyLessonCount: savedLessons.filter(item => item.updatedAt >= now - 7 * 24 * 60 * 60 * 1000).length,
    masteredSkillCount: Object.values(mastery).filter(record => (
      record.status === 'mastered' && record.verifiedBy === 'assessment'
    )).length,
    continueLesson: savedLessons[0] || null,
    recentLessons: savedLessons.slice(0, 5)
  };
}