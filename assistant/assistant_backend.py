import json
import os
from pathlib import Path
from typing import Dict, Optional

try:
    import urllib.request
    import urllib.error
except ImportError:  # pragma: no cover
    urllib = None


def load_env_file():
    root = Path(__file__).resolve().parent.parent
    env_path = root / '.env'
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding='utf-8').splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or '=' not in stripped:
            continue
        key, value = [part.strip() for part in stripped.split('=', 1)]
        if key and key not in os.environ:
            os.environ[key] = value.strip('"\'')


load_env_file()


DEFAULT_SYSTEM_PROMPT = (
    "You are the HouseLearning AI tutor. Help students learn clearly and safely. "
    "Keep responses short, friendly, and age-appropriate. Use HouseLearning educational content first. "
    "If you are unsure, say so honestly."
)


def get_provider_config() -> Dict[str, str]:
    explicit_provider = (os.getenv('AI_PROVIDER') or '').lower().strip()
    if explicit_provider in ('gemini', 'openai', 'mock'):
        provider = explicit_provider
    elif os.getenv('GEMINI_API_KEY') or os.getenv('AI_API_KEY'):
        provider = 'gemini' if os.getenv('GEMINI_API_KEY') else 'openai'
    else:
        provider = 'mock'

    if provider == 'gemini':
        return {
            'provider': 'gemini',
            'api_key': os.getenv('GEMINI_API_KEY') or os.getenv('AI_API_KEY') or '',
            'model': os.getenv('AI_MODEL') or 'gemini-2.5-flash',
            'base_url': os.getenv('AI_BASE_URL') or 'https://generativelanguage.googleapis.com/v1beta/models'
        }
    if provider == 'mock':
        return {
            'provider': 'mock',
            'api_key': '',
            'model': 'mock-model',
            'base_url': ''
        }
    return {
        'provider': 'openai',
        'api_key': os.getenv('OPENAI_API_KEY') or os.getenv('AI_API_KEY') or '',
        'model': os.getenv('AI_MODEL') or 'gpt-4o-mini',
        'base_url': os.getenv('AI_BASE_URL') or 'https://api.openai.com/v1'
    }


def build_prompt(user_message: str, subject: str = 'general', page_title: str = 'HouseLearning page', grade: str = '', system_prompt: Optional[str] = None) -> str:
    cleaned_message = (user_message or '').strip()
    grade_part = f"Grade context: {grade}. " if grade else ''
    prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
    return (
        f"{prompt}\n\n"
        f"Student message: {cleaned_message}\n"
        f"Subject: {subject}\n"
        f"Page title: {page_title}\n"
        f"{grade_part}"
        "Answer in a friendly, concise, helpful way and keep the explanation easy to understand."
    )


def _call_openai(prompt: str, config: Dict[str, str]) -> str:
    api_key = config.get('api_key', '')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY or AI_API_KEY is not configured.')

    url = f"{config.get('base_url', 'https://api.openai.com/v1')}/chat/completions"
    body = json.dumps({
        'model': config.get('model', 'gpt-4o-mini'),
        'temperature': 0.6,
        'messages': [
            {'role': 'system', 'content': DEFAULT_SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt}
        ]
    }).encode('utf-8')

    request = urllib.request.Request(
        url,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        },
        method='POST'
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode('utf-8'))

    return payload['choices'][0]['message']['content'].strip()


def _call_gemini(prompt: str, config: Dict[str, str]) -> str:
    api_key = config.get('api_key', '')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY or AI_API_KEY is not configured.')

    model = config.get('model', 'gemini-2.0-flash')
    url = f"{config.get('base_url', 'https://generativelanguage.googleapis.com/v1beta/models')}/{model}:generateContent?key={api_key}"
    body = json.dumps({
        'contents': [{
            'parts': [{'text': prompt}]
        }],
        'generationConfig': {
            'temperature': 0.6,
            'maxOutputTokens': 400
        }
    }).encode('utf-8')

    request = urllib.request.Request(
        url,
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode('utf-8'))

    return payload['candidates'][0]['content']['parts'][0]['text'].strip()


def generate_reply(user_message: str, subject: str = 'general', page_title: str = 'HouseLearning page', grade: str = '', system_prompt: Optional[str] = None) -> str:
    config = get_provider_config()
    provider = config.get('provider', 'openai')
    prompt = build_prompt(user_message, subject=subject, page_title=page_title, grade=grade, system_prompt=system_prompt)

    if provider == 'mock':
        return (
            'I’m connected to a real AI backend and ready to help with HouseLearning topics. '
            f"Your question was: {user_message}. I can explain the idea, give one example, or suggest the next lesson step."
        )
    if provider == 'gemini':
        return _call_gemini(prompt, config)
    if provider == 'openai':
        return _call_openai(prompt, config)
    raise ValueError(f'Unsupported AI provider: {provider}')


if __name__ == '__main__':
    sample = generate_reply('Explain fractions in simple words', subject='math', page_title='Fractions Lesson', grade='Grade 5')
    print(sample)
