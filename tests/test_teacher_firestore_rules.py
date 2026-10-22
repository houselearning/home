import re
import unittest
from pathlib import Path


RULES = Path(__file__).resolve().parents[1] / 'firestore.rules'


def rule_block(source, header, next_header):
    start = source.index(header)
    end = source.index(next_header, start)
    return source[start:end]


class TeacherFirestoreRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = RULES.read_text(encoding='utf-8')

    def test_teacher_role_requires_a_server_issued_claim(self):
        teacher = rule_block(self.source, 'function isTeacher()', 'function isAdmin()')
        self.assertIn("request.auth.token.role == 'teacher'", teacher)
        self.assertNotIn('cookbookRole', self.source)

    def test_users_cannot_promote_their_own_profile(self):
        profile = rule_block(self.source, 'match /user_profiles/{userId}', 'match /assignments/{assignmentId}')
        self.assertIn("request.resource.data.role == 'student'", profile)
        self.assertIn("hasAny(['role', 'admin', 'teacher', 'banned'])", profile)

    def test_class_creation_and_membership_mutation_are_server_only(self):
        classes = rule_block(self.source, 'match /classes/{classId}', 'match /assignments/{assignmentId}')
        self.assertIn('allow create, delete: if false;', classes)
        self.assertIn('allow create, update, delete: if false;', classes)
        self.assertIn('isClassInstructor(classId)', classes)
        self.assertIn('isOwner(studentId)', classes)

    def test_assignments_and_grades_are_scoped_to_class_membership(self):
        assignments = rule_block(self.source, 'match /assignments/{assignmentId}', 'match /notifications/{notificationId}')
        self.assertIn("resource.data.status == 'published'", assignments)
        self.assertIn('assignmentRecord(assignmentId).status == \'published\'', assignments)
        self.assertIn('request.resource.data.score <= assignmentRecord(assignmentId).points', assignments)
        self.assertIn("hasOnly(['score', 'feedback', 'gradedBy', 'gradedAt'])", assignments)
        self.assertRegex(assignments, re.compile(r"isOwner\(studentId\)[\s\S]*?isClassMember\(assignmentRecord\(assignmentId\).classId\)"))

    def test_teacher_applications_are_pending_and_admin_reviewed(self):
        application = rule_block(self.source, 'match /teacherApplications/{userId}', 'match /teacherClassInvites/')
        self.assertIn('request.auth.token.email_verified == true', application)
        self.assertIn("request.resource.data.status == 'pending'", application)
        self.assertIn('allow update: if (isAdmin()', application)
        self.assertIn("request.resource.data.status in ['approved', 'rejected']", application)


if __name__ == '__main__':
    unittest.main()
