import unittest

from inject_shared_runtime import inject_runtime, is_covered


class SharedRuntimeInjectionTests(unittest.TestCase):
    def test_inserts_once_before_head_and_preserves_line_endings(self):
        source = b'<html>\r\n<head>\r\n<title>Page</title>\r\n</head>\r\n<body></body></html>'
        result, changed = inject_runtime(source, b'\r\n')
        self.assertTrue(changed)
        self.assertIn(b'\r\n<script src="https://www.houselearning.org/home/site-runtime.js" defer data-houselearning-shared-runtime></script>\r\n</head>', result)
        self.assertEqual(result.count(b'site-runtime.js'), 1)

    def test_is_idempotent_and_respects_home_analytics_bootstrap(self):
        runtime = b'<script src="https://www.houselearning.org/home/site-runtime.js"></script>'
        analytics = b'<script src="/home/analytics.js?v=1"></script>'
        self.assertFalse(inject_runtime(runtime)[1])
        self.assertTrue(is_covered(analytics, home_repository=True))
        self.assertFalse(is_covered(analytics, home_repository=False))

    def test_injects_before_body_when_head_is_missing(self):
        source = b'<body><main>Page</main></body>'
        result, changed = inject_runtime(source)
        self.assertTrue(changed)
        self.assertRegex(result, rb'<main>Page</main><script[^>]+site-runtime\.js[^>]+></script>\n</body>')

    def test_injects_before_unwrapped_html_fragment(self):
        result, changed = inject_runtime(b'<h4>Embedded page</h4>')
        self.assertTrue(changed)
        self.assertTrue(result.startswith(b'<script'))
        self.assertIn(b'<h4>Embedded page</h4>', result)


if __name__ == '__main__':
    unittest.main()