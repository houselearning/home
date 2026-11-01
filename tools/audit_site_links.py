import argparse
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET


HOME = Path(__file__).resolve().parents[1]
PROJECTS = HOME.parent
SITEMAP = HOME / 'meta' / 'sitemap.xml'
SITEMAP_NAMESPACE = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
HOST_ROOTS = {
    'houselearning.org': PROJECTS / 'houselearning.github.io',
    'www.houselearning.org': PROJECTS / 'houselearning.github.io',
    'gists.houselearning.org': PROJECTS / 'gists',
}
PREFIX_ROOTS = (
    ('/home', PROJECTS / 'houselearning-home'),
    ('/auth', PROJECTS / 'auth'),
    ('/safe-library', PROJECTS / 'safe-library'),
    ('/docs', PROJECTS / 'docs'),
    ('/gists', PROJECTS / 'gists'),
    ('/cookbook', PROJECTS / 'cookbook'),
    ('/meta', PROJECTS / 'houselearning-home'),
)
SKIP_SCHEMES = {'data', 'javascript', 'mailto', 'tel', 'blob'}
SKIP_DIRECTORIES = {'.git', 'node_modules', '.venv', '__pycache__'}


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.base_href = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag.lower() == 'base' and values.get('href'):
            self.base_href = values['href']
        for attribute in ('href', 'src', 'poster'):
            value = values.get(attribute)
            if value:
                self.links.append(value.strip())


def sitemap_pages():
    tree = ET.parse(SITEMAP)
    locations = [node.text.strip() for node in tree.findall('.//s:loc', SITEMAP_NAMESPACE) if node.text]
    pages = []
    for location in locations:
        path = urlparse(location).path
        if path == '/home/':
            path = '/home/index.html'
        if path.startswith('/home/'):
            file = HOME / path.removeprefix('/home/')
            if file.is_dir():
                file = file / 'index.html'
            if file.is_file() and file.suffix.lower() in {'.html', '.htm'}:
                pages.append((location, file))
    return pages


def map_internal_target(url):
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    if scheme in SKIP_SCHEMES:
        return None
    if scheme not in {'http', 'https'}:
        return None

    host = parsed.hostname.lower() if parsed.hostname else ''
    if host not in HOST_ROOTS:
        return None

    path = parsed.path or '/'
    for prefix, root in PREFIX_ROOTS:
        if path == prefix or path.startswith(prefix + '/'):
            relative = path.removeprefix(prefix).lstrip('/')
            target = root / relative
            break
    else:
        target = HOST_ROOTS.get(host, PROJECTS / 'houselearning.github.io') / path.lstrip('/')

    if path.endswith('/') or not target.name:
        target = target / 'index.html'
    elif not target.suffix:
        candidates = [target.with_suffix('.html'), target.with_suffix('.htm'), target / 'index.html']
        target = next((candidate for candidate in candidates if candidate.is_file()), candidates[0])
    return target


def audit_links():
    broken = []
    checked = Counter()
    pages = sitemap_pages()
    for page_url, page in pages:
        parser = LinkParser()
        try:
            parser.feed(page.read_text(encoding='utf-8', errors='replace'))
        except OSError:
            broken.append((page_url, page_url, 'page-unreadable'))
            continue

        base_url = urljoin(page_url, parser.base_href) if parser.base_href else page_url
        for raw_link in parser.links:
            if not raw_link or raw_link.startswith('#'):
                continue
            target_url = urljoin(base_url, raw_link)
            target = map_internal_target(target_url)
            if target is None:
                continue
            checked['internal'] += 1
            if not target.is_file():
                broken.append((page_url, target_url, 'missing-file'))
    return pages, checked, broken


def main():
    parser = argparse.ArgumentParser(description='Audit same-site links from the HouseLearning home sitemap.')
    parser.add_argument('--limit', type=int, default=30, help='Maximum broken-link examples to print.')
    args = parser.parse_args()
    pages, checked, broken = audit_links()
    print(f'Sitemap HTML pages checked: {len(pages)}')
    print(f'Same-site file links checked: {checked["internal"]}')
    print(f'Broken same-site file links: {len(broken)}')
    for source, target, reason in broken[:max(0, args.limit)]:
        print(f'{reason}: {source} -> {target}')
    if broken:
        raise SystemExit(1)


if __name__ == '__main__':
    main()