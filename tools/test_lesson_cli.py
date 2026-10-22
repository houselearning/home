import unittest

from lesson_cli import select_courses, validate_catalog


SAMPLE = [
    {'subject': 'math', 'grade': 0, 'gradeLabel': 'Kindergarten', 'title': 'Counting to Ten', 'href': '/home/math/k/counting-10.html'},
    {'subject': 'math', 'grade': 4, 'gradeLabel': 'Grade 4', 'title': 'Fractions on a Number Line', 'href': '/home/math/grade4/fractions.html'},
    {'subject': 'science', 'grade': 4, 'gradeLabel': 'Grade 4', 'title': 'Energy and Motion', 'href': '/home/science/grade4/energy.html'},
]


class LessonCliTests(unittest.TestCase):
    def test_search_filters_all_terms_and_grade(self):
        results = select_courses(SAMPLE, query='number FRACTIONS', subject='math', grade='4')
        self.assertEqual([course['title'] for course in results], ['Fractions on a Number Line'])

    def test_validation_requires_all_subject_grade_groups_and_local_paths(self):
        issues = validate_catalog(SAMPLE)
        self.assertTrue(any('missing subject/grade groups' in issue.casefold() for issue in issues))
        self.assertTrue(any('missing lesson file' in issue.casefold() for issue in issues))


if __name__ == '__main__':
    unittest.main()