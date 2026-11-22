import argparse
import json
import sys
from pathlib import Path

from build_course_catalog import OUTPUT, build_catalog, summarize


ROOT = Path(__file__).resolve().parents[1]
SUBJECTS = {'math', 'science'}


def select_courses(records, query='', subject='all', grade='all'):
    terms = str(query or '').casefold().split()
    selected_grade = None if grade == 'all' else int(grade)
    results = []
    for course in records:
        if subject != 'all' and course['subject'] != subject:
            continue
        if selected_grade is not None and course['grade'] != selected_grade:
            continue
        searchable = ' '.join((course['title'], course['subject'], course['gradeLabel'])).casefold()
        if all(term in searchable for term in terms):
            results.append(course)
    return sorted(results, key=lambda course: (course['grade'], course['subject'], course['title'].casefold()))


def load_catalog(path=OUTPUT):
    try:
        records = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise ValueError(f'Could not read course catalog: {error}') from error
    if not isinstance(records, list) or not records:
        raise ValueError('Course catalog must be a non-empty JSON array.')
    return records


def validate_catalog(records):
    issues = []
    seen = set()
    coverage = {(subject, grade) for subject in SUBJECTS for grade in range(13)}
    for index, course in enumerate(records, start=1):
        if not isinstance(course, dict):
            issues.append(f'Record {index} must be an object.')
            continue
        subject = course.get('subject')
        grade = course.get('grade')
        title = course.get('title')
        href = course.get('href')
        if subject not in SUBJECTS or not isinstance(grade, int) or not 0 <= grade <= 12:
            issues.append(f'Record {index} has an invalid subject or grade.')
            continue
        if not isinstance(title, str) or not title.strip():
            issues.append(f'Record {index} has no title.')
        if not isinstance(href, str) or not href.startswith('/home/'):
            issues.append(f'Record {index} has an invalid local lesson path.')
        else:
            target = ROOT / href.removeprefix('/home/')
            if not target.is_file():
                issues.append(f'Record {index} points to missing lesson file: {href}')
            key = (subject, href)
            if key in seen:
                issues.append(f'Record {index} duplicates a lesson path: {href}')
            seen.add(key)
        coverage.discard((subject, grade))
    if coverage:
        missing = ', '.join(f'{subject} grade {grade if grade else "K"}' for subject, grade in sorted(coverage))
        issues.append(f'Missing subject/grade groups: {missing}')
    return issues


def write_catalog(records, path=OUTPUT):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def build_parser():
    parser = argparse.ArgumentParser(prog='houselearning-lesson', description='Search and validate real HouseLearning K-12 Math and Science lessons.')
    commands = parser.add_subparsers(dest='command', required=True)

    commands.add_parser('build', help='Regenerate the checked-in course catalog from lesson pages.')
    commands.add_parser('check', help='Validate the catalog, grade coverage, and every local lesson link.')

    for name, help_text in (
        ('list', 'List lessons, optionally filtered by subject and grade.'),
        ('search', 'Search lesson titles and filter by subject and grade.'),
    ):
        command = commands.add_parser(name, help=help_text)
        if name == 'search':
            command.add_argument('query', nargs='+', help='Words to find in lesson titles or subjects.')
        else:
            command.add_argument('query', nargs='?', default='')
        command.add_argument('--subject', choices=['all', 'math', 'science'], default='all')
        command.add_argument('--grade', choices=['all', 'K'] + [str(grade) for grade in range(1, 13)], default='all')
        command.add_argument('--json', action='store_true', help='Print matching records as JSON.')
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.command == 'build':
            records = build_catalog()
            write_catalog(records)
            print(f'Built {len(records)} courses at {OUTPUT}.')
            return 0

        records = load_catalog()
        if args.command == 'check':
            records = build_catalog()
            issues = validate_catalog(records)
            if issues:
                print('\n'.join(issues), file=sys.stderr)
                return 1
            coverage = summarize(records)
            print(f'Catalog valid: {len(records)} lessons; all 26 subject/grade groups and local paths resolve.')
            for subject, details in coverage.items():
                print(f"{subject}: {details['total']} lessons")
            return 0

        query = ' '.join(args.query)
        selected_grade = '0' if args.grade == 'K' else args.grade
        results = select_courses(records, query=query, subject=args.subject, grade=selected_grade)
        if args.json:
            print(json.dumps(results, ensure_ascii=False, indent=2))
            return 0
        if not results:
            print('No lessons match those filters.')
            return 0
        for course in results:
            print(f"[{course['gradeLabel']} {course['subject']}] {course['title']}  {course['href']}")
        print(f'{len(results)} lessons.')
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(f'Lesson CLI error: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())