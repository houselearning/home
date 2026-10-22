import unittest

from build_course_catalog import build_catalog, grade_number, summarize


class CourseCatalogTests(unittest.TestCase):
    def test_grade_folders_map_to_k_through_12(self):
        self.assertEqual(grade_number('k'), 0)
        self.assertEqual(grade_number('grade12'), 12)
        with self.assertRaises(ValueError):
            grade_number('grade13')

    def test_live_math_and_science_pages_produce_complete_records(self):
        records = build_catalog()

        self.assertGreaterEqual(len(records), 190)
        self.assertEqual({record['subject'] for record in records}, {'math', 'science'})
        self.assertTrue(all(0 <= record['grade'] <= 12 for record in records))
        self.assertTrue(all(record['title'] and record['href'].startswith('/') for record in records))

    def test_catalog_covers_every_k12_grade_for_each_subject(self):
        coverage = summarize(build_catalog())

        for subject in ('math', 'science'):
            self.assertEqual(set(coverage[subject]['grades']), {'K', *(str(grade) for grade in range(1, 13))})


if __name__ == '__main__':
    unittest.main()