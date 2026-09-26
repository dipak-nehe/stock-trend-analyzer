"""Stock Value Analyzer - local development server.

Serves public/index.html and /api/financials (same API as the Vercel function).

Run:  export SEC_USER_AGENT="StockTrendAnalyzer your-email@example.com"
      python3 server.py      then open http://localhost:8000
No third-party packages needed.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import stock_data
import store

PORT = int(os.environ.get("PORT", "8000"))
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
STATIC_TYPES = {".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon"}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json", cache=None, data_cache=None):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text", "application/json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        if cache:
            self.send_header("Cache-Control", cache)
        if data_cache:
            self.send_header("X-Data-Cache", data_cache)
            self.send_header("X-Data-Store", store.describe(stock_data.store))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/financials":
            ticker = (parse_qs(url.query).get("ticker") or [""])[0]
            status, body, cache, data_cache = stock_data.api_response(ticker)
            return self._send(status, json.dumps(body), cache=cache, data_cache=data_cache)
        name = "index.html" if url.path in ("/", "") else url.path.lstrip("/")
        path = os.path.realpath(os.path.join(PUBLIC, name))
        ext = os.path.splitext(path)[1]
        if path.startswith(PUBLIC + os.sep) and ext in STATIC_TYPES and os.path.isfile(path):
            with open(path, "rb") as fh:
                return self._send(200, fh.read(), STATIC_TYPES[ext])
        self._send(404, json.dumps({"error": "Not found"}))

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    try:
        stock_data.user_agent()
    except stock_data.ConfigError as e:
        raise SystemExit(f"{e}\nExample: export SEC_USER_AGENT=\"StockTrendAnalyzer you@example.com\"")
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        if e.errno not in (48, 98):  # EADDRINUSE on macOS / Linux
            raise
        raise SystemExit(f"Port {PORT} is already in use. Stop the other server (lsof -iTCP:{PORT} -sTCP:LISTEN) "
                         f"or pick another port: PORT=8001 python3 server.py")
    print(f"Stock Value Analyzer running at http://localhost:{PORT}")
    httpd.serve_forever()
