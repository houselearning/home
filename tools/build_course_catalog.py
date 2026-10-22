import argparse
import json
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'math': ROOT / 'math',
    'science': ROOT / 'science',
}
OUTPUT = ROOT / 'course-catalog.json'
GRADE_FOLDERS = ['k'] + [f'grade{grade}' for grade in range(1, 13)]


class PageTitleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.inside_title = False
        self.parts = []

    def handle_starttag(self, tag, _attrs):
        if tag.lower() == 'title':
            self.inside_title = True

    def handle_endtag(self, tag):
        if tag.lower() == 'title':
            self.inside_title = False

    def handle_data(self, data):
        if self.inside_title:
            self.parts.append(data)


def grade_number(folder):
    if folder not in GRADE_FOLDERS:
        raise ValueError(f'Unsupported grade folder: {folder}')
    return 0 if folder == 'k' else int(folder.removeprefix('grade'))


def page_title(source):
    parser = PageTitleParser()
    parser.feed(source.read_text(encoding='utf-8', errors='replace'))
    parser.close()
    return ' '.join(''.join(parser.parts).split()).strip()


def build_catalog():
    records = []
    for subject, subject_root in SOURCES.items():
        for grade_folder in GRADE_FOLDERS:
            grade_root = subject_root / grade_folder
            if not grade_root.is_dir():
                raise ValueError(f'Missing course directory: {grade_root.relative_to(ROOT)}')
            for source in sorted(grade_root.glob('*.html')):
                source_text = source.read_text(encoding='utf-8', errors='replace')
                if not source_text.strip():
                    continue
                title = page_title(source)
                if not title:
                    raise ValueError(f'Lesson page has no title: {source.relative_to(ROOT)}')
                grade = grade_number(grade_folder)
                records.append({
                    'subject': subject,
                    'grade': grade,
                    'gradeLabel': 'Kindergarten' if grade == 0 else f'Grade {grade}',
                    'title': title,
                    'href': f'/home/{source.relative_to(ROOT).as_posix()}',
                })

    records.sort(key=lambda item: (item['subject'], item['grade'], item['title'].casefold(), item['href']))
    seen = set()
    for record in records:
        key = (record['subject'], record['href'])
        if key in seen:
            raise ValueError(f"Duplicate course destination: {record['subject']} {record['href']}")
        seen.add(key)
        if not record['href'].startswith('/home/'):
            raise ValueError(f"Course links must use the published HouseLearning home path: {record['href']}")
    if not records:
        raise ValueError('No lesson cards were found in the Math or Science catalogs.')
    return records


def summarize(records):
    counts = Counter((record['subject'], record['grade']) for record in records)
    return {
        subject: {
            'total': sum(count for (item_subject, _), count in counts.items() if item_subject == subject),
            'grades': {
                ('K' if grade == 0 else str(grade)): counts[(subject, grade)]
                for grade in range(13)
                if counts[(subject, grade)]
            },
        }
        for subject in SOURCES
    }


def main():
    parser = argparse.ArgumentParser(description='Build the HouseLearning K-12 Math and Science course catalog.')
    parser.add_argument('--check', action='store_true', help='Validate and report catalog coverage without writing a file.')
    parser.add_argument('--output', type=Path, default=OUTPUT, help='Output JSON path (defaults to course-catalog.json).')
    args = parser.parse_args()

    try:
        records = build_catalog()
        coverage = summarize(records)
        if args.check:
            print(json.dumps({'courseCount': len(records), 'coverage': coverage}, indent=2))
            return
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Wrote {len(records)} courses to {args.output}')
    except (OSError, ValueError) as error:
        print(f'Course catalog error: {error}', file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == '__main__':
    main()