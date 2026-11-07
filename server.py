"""
Warframe Liquidation Optimizer - Python Local Proxy Server
Copyright (C) 2026 polishdogge

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import json
import os
import re
import time
import subprocess
import threading

PORT = int(os.environ.get('PORT', 3000))
CACHE = {}
CACHE_TTL = 15 * 60  # 15 minutes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

ACTIVE_PROCESS = None
DOWNLOAD_STATE = {
    'active': False,
    'scope': 'all',
    'total': 239,
    'completed': 0,
    'downloaded': 0,
    'cached': 0,
    'failed': 0,
    'currentSlug': '',
    'done': False,
    'message': 'Idle'
}

class SyndicateHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        self.do_GET()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API Proxy Route: /api/orders/:slug
        if path.startswith('/api/orders/'):
            slug = path[len('/api/orders/'):].strip()
            if not slug:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Item slug is required"}')
                return

            platform = self.headers.get('Platform', 'pc').lower()
            query_params = urllib.parse.parse_qs(parsed.query)
            if 'platform' in query_params and query_params['platform']:
                platform = query_params['platform'][0].lower()

            cache_key = f"orders:{platform}:{slug}"
            now = time.time()
            if cache_key in CACHE and (now - CACHE[cache_key]['time'] < CACHE_TTL):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('X-Proxy-Cache', 'HIT')
                self.end_headers()
                self.wfile.write(CACHE[cache_key]['data'])
                return

            target_url = f"https://api.warframe.market/v2/orders/item/{urllib.parse.quote(slug)}"
            req = urllib.request.Request(
                target_url,
                headers={
                    'Accept': 'application/json',
                    'Platform': platform,
                    'Language': 'en',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read()
                    CACHE[cache_key] = {'time': now, 'data': data}
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('X-Proxy-Cache', 'MISS')
                    self.end_headers()
                    self.wfile.write(data)
            except urllib.error.HTTPError as e:
                err_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body if err_body else json.dumps({'error': f'HTTP {e.code}'}).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to reach Warframe.market', 'details': str(e)}).encode('utf-8'))
            return

        # 2. API Proxy Route: /api/statistics/:slug
        if path.startswith('/api/statistics/') or path.startswith('/api/stats/'):
            prefix = '/api/statistics/' if path.startswith('/api/statistics/') else '/api/stats/'
            slug = path[len(prefix):].strip()
            if not slug:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Item slug is required"}')
                return

            platform = self.headers.get('Platform', 'pc').lower()
            query_params = urllib.parse.parse_qs(parsed.query)
            if 'platform' in query_params and query_params['platform']:
                platform = query_params['platform'][0].lower()

            cache_key = f"stats:{platform}:{slug}"
            now = time.time()
            if cache_key in CACHE and (now - CACHE[cache_key]['time'] < CACHE_TTL):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('X-Proxy-Cache', 'HIT')
                self.end_headers()
                self.wfile.write(CACHE[cache_key]['data'])
                return

            target_url = f"https://api.warframe.market/v1/items/{urllib.parse.quote(slug)}/statistics"
            req = urllib.request.Request(
                target_url,
                headers={
                    'Accept': 'application/json',
                    'Platform': platform,
                    'Language': 'en',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )

            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = resp.read()
                    CACHE[cache_key] = {'time': now, 'data': data}
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('X-Proxy-Cache', 'MISS')
                    self.end_headers()
                    self.wfile.write(data)
            except urllib.error.HTTPError as e:
                err_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body if err_body else json.dumps({'error': f'HTTP {e.code}'}).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to reach Warframe.market statistics', 'details': str(e)}).encode('utf-8'))
            return

        # 3. Image Proxy / Cache Route: /api/image/:slug
        if path.startswith('/api/image/'):
            raw_slug = path[len('/api/image/'):]
            slug = re.sub(r'[^a-zA-Z0-9_-]', '', raw_slug)
            if not slug:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Bad slug"}')
                return

            local_png = os.path.join(ASSETS_DIR, f"{slug}.png")
            local_webp = os.path.join(ASSETS_DIR, f"{slug}.webp")

            if os.path.exists(local_webp):
                self.send_response(200)
                self.send_header('Content-Type', 'image/webp')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                with open(local_webp, 'rb') as f:
                    self.wfile.write(f.read())
                return

            if os.path.exists(local_png):
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                with open(local_png, 'rb') as f:
                    self.wfile.write(f.read())
                return

            # Fetch metadata from Warframe Market API v2
            headers = {
                'Accept': 'application/json',
                'Language': 'en',
                'Platform': 'pc',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            meta_url = f"https://api.warframe.market/v2/items/{urllib.parse.quote(slug)}"
            req = urllib.request.Request(meta_url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    meta_json = json.loads(resp.read().decode('utf-8'))
                img_path = meta_json.get('data', {}).get('i18n', {}).get('en', {}).get('icon') or meta_json.get('data', {}).get('i18n', {}).get('en', {}).get('thumb')
                if not img_path:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "No image on WM"}')
                    return

                img_url = f"https://warframe.market/static/assets/{img_path}"
                img_req = urllib.request.Request(img_url, headers={'User-Agent': headers['User-Agent']})
                with urllib.request.urlopen(img_req, timeout=10) as img_resp:
                    img_data = img_resp.read()

                ext = '.webp' if img_path.endswith('.webp') else '.png'
                content_type = 'image/webp' if ext == '.webp' else 'image/png'
                save_path = os.path.join(ASSETS_DIR, f"{slug}{ext}")
                try:
                    with open(save_path, 'wb') as f:
                        f.write(img_data)
                except Exception as save_err:
                    print(f"[Image Cache Write Warning] {slug}: {save_err}")

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                self.wfile.write(img_data)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'HTTP {e.code}'}).encode('utf-8'))
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Image proxy error', 'details': str(e)}).encode('utf-8'))
            return

        # 4. Clear Cache Route: /api/clear-cache
        if path == '/api/clear-cache':
            CACHE.clear()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true, "message": "Cache cleared"}')
            return

        # 4b. Download Assets Status Route: /api/download-status
        if path == '/api/download-status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(DOWNLOAD_STATE).encode('utf-8'))
            return

        # 4c. Download Assets Stop Route: /api/download-stop
        if path == '/api/download-stop':
            global ACTIVE_PROCESS
            if ACTIVE_PROCESS:
                try:
                    ACTIVE_PROCESS.terminate()
                except Exception:
                    pass
                ACTIVE_PROCESS = None
            DOWNLOAD_STATE['active'] = False
            DOWNLOAD_STATE['message'] = 'Download stopped by user'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Download stopped', 'state': DOWNLOAD_STATE}).encode('utf-8'))
            return

        # 4d. Trigger Asset Downloader Route: /api/download-assets
        if path == '/api/download-assets':
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            scope = query_params.get('scope', ['all'])[0].lower()
            force = query_params.get('force', ['false'])[0].lower() == 'true'

            if DOWNLOAD_STATE.get('active'):
                self.send_response(409)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'Download already running', 'state': DOWNLOAD_STATE}).encode('utf-8'))
                return

            script_path = os.path.join(BASE_DIR, 'scripts', 'download-assets.js')
            args = ['node', script_path, f'--port={PORT}']
            if scope == 'syndicates':
                args.append('--syndicates')
            if scope == 'traders':
                args.append('--traders')
            if force:
                args.append('--force')

            DOWNLOAD_STATE.update({
                'active': True,
                'scope': scope,
                'force': force,
                'total': 136 if scope == 'syndicates' else (103 if scope == 'traders' else 239),
                'completed': 0,
                'downloaded': 0,
                'cached': 0,
                'failed': 0,
                'currentSlug': 'Initializing...',
                'done': False,
                'message': 'Starting asset downloader...'
            })

            def run_downloader():
                global ACTIVE_PROCESS
                try:
                    ACTIVE_PROCESS = subprocess.Popen(
                        args,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=1
                    )
                    line_re = re.compile(r'\[\s*(\d+)\s*/\s*(\d+)\]\s+([a-z0-9_-]+)\s+\[(ok|cached|fail)', re.IGNORECASE)
                    for line in ACTIVE_PROCESS.stdout:
                        m = line_re.search(line)
                        if m:
                            DOWNLOAD_STATE['completed'] = int(m.group(1))
                            DOWNLOAD_STATE['total'] = int(m.group(2))
                            DOWNLOAD_STATE['currentSlug'] = m.group(3)
                            status = m.group(4).lower()
                            if status == 'ok':
                                DOWNLOAD_STATE['downloaded'] += 1
                            elif status == 'cached':
                                DOWNLOAD_STATE['cached'] += 1
                            elif status.startswith('fail'):
                                DOWNLOAD_STATE['failed'] += 1
                    ACTIVE_PROCESS.wait()
                    code = ACTIVE_PROCESS.returncode
                    DOWNLOAD_STATE['active'] = False
                    DOWNLOAD_STATE['done'] = True
                    DOWNLOAD_STATE['message'] = 'Download completed successfully' if code == 0 else f'Finished with exit code {code}'
                except Exception as e:
                    DOWNLOAD_STATE['active'] = False
                    DOWNLOAD_STATE['message'] = f'Download process error: {str(e)}'
                finally:
                    ACTIVE_PROCESS = None

            t = threading.Thread(target=run_downloader, daemon=True)
            t.start()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Download started', 'state': DOWNLOAD_STATE}).encode('utf-8'))
            return

        # 5. Static Assets (/assets/*) with Automatic Extension Resolution
        if path.startswith('/assets/'):
            filename = path[len('/assets/'):].strip()
            exact_path = os.path.join(ASSETS_DIR, filename)

            if os.path.isfile(exact_path):
                content_type = 'image/svg+xml' if filename.lower().endswith('.svg') else ('image/webp' if filename.lower().endswith('.webp') else 'image/png')
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                with open(exact_path, 'rb') as f:
                    self.wfile.write(f.read())
                return

            base_slug = os.path.splitext(filename)[0]
            alt_webp = os.path.join(ASSETS_DIR, f"{base_slug}.webp")
            alt_png = os.path.join(ASSETS_DIR, f"{base_slug}.png")

            if os.path.isfile(alt_webp):
                self.send_response(200)
                self.send_header('Content-Type', 'image/webp')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                with open(alt_webp, 'rb') as f:
                    self.wfile.write(f.read())
                return

            if os.path.isfile(alt_png):
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                with open(alt_png, 'rb') as f:
                    self.wfile.write(f.read())
                return

            # Asset not found locally: return 404 (do not fall back to index.html for images)
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Asset not found')
            return

        # 6. General Static Files
        clean_path = path.lstrip('/')
        file_path = os.path.join(BASE_DIR, 'index.html' if not clean_path else clean_path)
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(BASE_DIR, 'index.html')

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }
        content_type = mime_types.get(ext, 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(f"Error reading file: {e}".encode('utf-8'))

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), SyndicateHandler) as httpd:
        print("Warframe Syndicate Standing Optimizer")
        print(f"Server running on: http://localhost:{PORT}")
        print(f"CORS Proxy: http://localhost:{PORT}/api/orders/:slug")
        print(f"Image Proxy: http://localhost:{PORT}/api/image/:slug")
        print("======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == '__main__':
    run()
