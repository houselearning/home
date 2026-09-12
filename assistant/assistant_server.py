import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    from assistant.assistant_backend import generate_reply
except ModuleNotFoundError:  # pragma: no cover
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    from assistant.assistant_backend import generate_reply


class AssistantRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({'ok': True}, status=200)

    def do_POST(self):
        if self.path not in ('/api/assistant', '/assistant/api'):
            self._send_json({'error': 'Not found'}, status=404)
            return

        length = int(self.headers.get('Content-Length', '0'))
        raw = self.rfile.read(length) if length > 0 else b'{}'

        try:
            payload = json.loads(raw.decode('utf-8')) if raw else {}
        except json.JSONDecodeError:
            self._send_json({'error': 'Invalid JSON'}, status=400)
            return

        user_message = str(payload.get('message') or payload.get('prompt') or '').strip()
        if not user_message:
            self._send_json({'error': 'Missing message'}, status=400)
            return

        subject = str(payload.get('subject') or 'general')
        page_title = str(payload.get('pageTitle') or payload.get('page_title') or 'HouseLearning page')
        grade = str(payload.get('grade') or '')

        try:
            reply = generate_reply(user_message, subject=subject, page_title=page_title, grade=grade)
            self._send_json({
                'text': reply,
                'suggestions': []
            }, status=200)
        except Exception as exc:  # pragma: no cover
            self._send_json({
                'error': f'AI backend failed: {exc}',
                'text': 'I could not reach the AI backend right now. Please try again in a moment.'
            }, status=500)


def main():
    port = int(os.getenv('PORT', '8001'))
    server = HTTPServer(('0.0.0.0', port), AssistantRequestHandler)
    print(f'HouseLearning AI server running on http://0.0.0.0:{port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
