"""Local game server: scans cha for every new game. No dependencies."""
import json
import base64
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'}


def characters():
    return [{'name': p.stem, 'file': p.name}
            for p in sorted((ROOT / 'cha').iterdir(), key=lambda p: p.name.casefold())
            if p.is_file() and p.suffix.lower() in EXTENSIONS]


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/api/characters':
            data = json.dumps(characters(), ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            super().do_GET()


if __name__ == '__main__':
    # Keep direct-file and static-host copies usable after running the launcher.
    (ROOT / 'characters.js').write_text(
        'window.CARD_CHARACTERS = ' + json.dumps(characters(), ensure_ascii=False) + ';\n'
        + 'window.CARD_MASK_DATA = "data:image/png;base64,'
        + base64.b64encode((ROOT / 'mask.png').read_bytes()).decode('ascii') + '";\n',
        encoding='utf-8')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    url = f'http://127.0.0.1:{server.server_port}/index.html'
    print(f'Card game: {url}\nKeep this window open. Press Ctrl+C to stop.')
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
