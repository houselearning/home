import argparse
import os
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPOSITORIES = (
    'houselearning-home',
    'houselearning.github.io',
    'auth',
    'docs',
    'gists',
    'cookbook',
    'safe-library',
)
RUNTIME_SOURCE = b'https://www.houselearning.org/home/site-runtime.js'
RUNTIME_SCRIPT = (
    b'<script src="https://www.houselearning.org/home/site-runtime.js" '
    b'defer data-houselearning-shared-runtime></script>'
)
RUNTIME_RE = re.compile(rb'<script\b[^>]*site-runtime\.js[^>]*>', re.IGNORECASE)
ANALYTICS_RE = re.compile(
    rb'<script\b[^>]*\bsrc\s*=\s*["\'][^"\']*analytics\.js(?:[?#][^"\']*)?["\'][^>]*>',
    re.IGNORECASE,
)
HEAD_RE = re.compile(rb'</head\s*>', re.IGNORECASE)
BODY_RE = re.compile(rb'</body\s*>', re.IGNORECASE)
SKIP_DIRECTORIES = {'.git', 'node_modules', '.venv', '__pycache__'}


def is_covered(content, home_repository=False):
    return bool(RUNTIME_RE.search(content) or (home_repository and ANALYTICS_RE.search(content)))


def inject_runtime(content, newline=b'\n'):
    if RUNTIME_RE.search(content):
        return content, False
    head_match = HEAD_RE.search(content)
    if head_match:
        updated = content[:head_match.start()] + RUNTIME_SCRIPT + newline + content[head_match.start():]
        return updated, True
    body_match = BODY_RE.search(content)
    if body_match:
        updated = content[:body_match.start()] + RUNTIME_SCRIPT + newline + content[body_match.start():]
        return updated, True
    if content.strip():
        return RUNTIME_SCRIPT + newline + content, True
    return content, False


def iter_html_files(repository):
    for current, directories, filenames in os.walk(repository):
        directories[:] = [directory for directory in directories if directory not in SKIP_DIRECTORIES]
        for filename in filenames:
            if filename.lower().endswith(('.html', '.htm')):
                yield Path(current) / filename


def update_repository(repository_name):
    repository = PROJECT_ROOT / repository_name
    if not repository.is_dir():
        return 0, 0, []

    changed = 0
    skipped = 0
    unsupported = []
    is_home = repository_name == 'houselearning-home'
    for page in iter_html_files(repository):
        if page.name.lower() == 'googlec1bf7e591f96a649.html':
            skipped += 1
            continue
        content = page.read_bytes()
        if is_covered(content, home_repository=is_home):
            skipped += 1
            continue
        newline = b'\r\n' if b'\r\n' in content else b'\n'
        updated, did_update = inject_runtime(content, newline)
        if did_update:
            page.write_bytes(updated)
            changed += 1
        else:
            unsupported.append(str(page.relative_to(repository)))
    return changed, skipped, unsupported


def main():
    parser = argparse.ArgumentParser(description='Add the shared HouseLearning navigation and SafeAI runtime to static web pages.')
    parser.add_argument('--repo', action='append', choices=DEFAULT_REPOSITORIES, help='Repository to update; repeat to select multiple.')
    args = parser.parse_args()
    repositories = args.repo or DEFAULT_REPOSITORIES

    for name in repositories:
        changed, skipped, unsupported = update_repository(name)
        print(f'{name}: inserted={changed}, already-covered={skipped}, no-head-or-body={len(unsupported)}')
        for page in unsupported[:10]:
            print(f'  skipped: {page}')


if __name__ == '__main__':
    main()