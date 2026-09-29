"""Vercel serverless function: GET /api/insiders?ticker=AAPL (insider trades, loaded after the main results)"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend import stock_data, store  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        ticker = (parse_qs(urlparse(self.path).query).get("ticker") or [""])[0]
        status, body, cache, data_cache = stock_data.insider_response(ticker)
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", cache)
        if data_cache:
            self.send_header("X-Data-Cache", data_cache)
            self.send_header("X-Data-Store", store.describe(stock_data.store))  # redis | memory | file
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
