import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse


HOME = Path(__file__).resolve().parents[1]
PROJECTS = HOME.parent
WEB_REPOSITORIES = (
    'houselearning-home',
    'houselearning.github.io',
    'auth',
    'docs',
    'gists',
    'cookbook',
    'safe-library',
)
SKIP_DIRECTORIES = {'.git', 'node_modules', '.venv', '__pycache__'}


class SiteRuntimeCoverageTests(unittest.TestCase):
    def test_sitemap_pages_are_present_nonempty_and_bootstrapped(self):
        tree = ET.parse(HOME / 'meta' / 'sitemap.xml')
        namespace = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        locations = [node.text.strip() for node in tree.findall('.//s:loc', namespace) if node.text]
        self.assertGreater(len(locations), 0)

        for location in locations:
            path = urlparse(location).path
            if path == '/home/':
                relative_path = 'index.html'
            elif path.startswith('/home/'):
                relative_path = path.removeprefix('/home/')
            else:
                continue

            page = HOME / relative_path
            with self.subTest(page=relative_path):
                self.assertTrue(page.is_file(), f'Missing sitemap page: {location}')
                content = page.read_bytes()
                self.assertTrue(content.strip(), f'Empty sitemap page: {location}')
                self.assertTrue(
                    b'analytics.js' in content.lower() or b'site-runtime.js' in content.lower(),
                    f'Sitemap page has no shared runtime: {location}'
                )

    def test_every_static_web_repository_html_page_has_shared_navigation_bootstrap(self):
        for repository_name in WEB_REPOSITORIES:
            repository = PROJECTS / repository_name
            pages = []
            for current in repository.rglob('*'):
                if any(part in SKIP_DIRECTORIES for part in current.parts):
                    continue
                if current.is_file() and current.suffix.lower() in {'.html', '.htm'}:
                    if current.name == 'googlec1bf7e591f96a649.html':
                        continue
                    pages.append(current)

            self.assertTrue(pages, f'No HTML pages found for {repository_name}')
            for page in pages:
                content = page.read_bytes().lower()
                covered = (
                    b'site-runtime.js' in content
                    or (repository_name == 'houselearning-home' and b'analytics.js' in content)
                    or (repository_name == 'houselearning.github.io' and b'assets/js/nav.js' in content)
                )
                with self.subTest(repository=repository_name, page=page.relative_to(repository)):
                    self.assertTrue(covered, f'No shared navigation bootstrap in {page}')


if __name__ == '__main__':
    unittest.main()