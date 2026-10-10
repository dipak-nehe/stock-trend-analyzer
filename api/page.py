"""Vercel serverless function: company pages. /stock/KO is rewritten here (vercel.json) as /api/page?ticker=KO and
answered with the results page carrying that company's title, description and share preview (backend/pages.py)."""
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend import pages  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        ticker = (parse_qs(urlparse(self.path).query).get("ticker") or [""])[0]
        status, page, cache = pages.company_page(ticker)
        data = page.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
