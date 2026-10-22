function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function filterCourses(courses, { query = '', subject = 'all', grade = 'all' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const selectedGrade = grade === 'all' ? null : Number(grade);

  return courses.filter(course => {
    if (subject !== 'all' && course.subject !== subject) return false;
    if (selectedGrade !== null && course.grade !== selectedGrade) return false;
    if (!terms.length) return true;

    const text = normalize(`${course.title} ${course.subject} ${course.gradeLabel}`);
    return terms.every(term => text.includes(term));
  }).sort((left, right) => (
    left.grade - right.grade
    || left.subject.localeCompare(right.subject)
    || left.title.localeCompare(right.title)
  ));
}