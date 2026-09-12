import os
import unittest


class AssistantBackendTests(unittest.TestCase):
    def test_build_prompt_includes_context(self):
        from assistant.assistant_backend import build_prompt

        prompt = build_prompt(
            user_message='Explain fractions in simple words',
            subject='math',
            page_title='Fractions Lesson',
            grade='Grade 5',
        )

        self.assertIn('Explain fractions in simple words', prompt)
        self.assertIn('math', prompt.lower())
        self.assertIn('Fractions Lesson', prompt)
        self.assertIn('Grade 5', prompt)

    def test_provider_config_is_loaded_from_env(self):
        from assistant.assistant_backend import get_provider_config

        os.environ['AI_PROVIDER'] = 'openai'
        os.environ['AI_API_KEY'] = 'demo-key'
        os.environ['AI_MODEL'] = 'gpt-4o-mini'

        config = get_provider_config()

        self.assertEqual(config['provider'], 'openai')
        self.assertEqual(config['api_key'], 'demo-key')
        self.assertEqual(config['model'], 'gpt-4o-mini')


if __name__ == '__main__':
    unittest.main()
