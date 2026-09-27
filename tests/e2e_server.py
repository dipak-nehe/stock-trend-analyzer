"""The real local server with SEC replaced by the saved fixtures and in-memory storage: for the browser tests.

Playwright (playwright.config.ts) starts it with `python tests/e2e_server.py`; PORT picks the port (default 8799).
Offline and repeatable: no SEC requests, nothing written to disk.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.dirname(HERE), HERE]

os.environ.setdefault("SEC_USER_AGENT", "StockTrendTests tests@example.com")

from helpers import fixture_sec_get  # noqa: E402

import server  # noqa: E402
from backend import stock_data, store  # noqa: E402


def main():
    stock_data.sec_get = fixture_sec_get
    stock_data.store = store.MemoryStore()
    server.Handler.log_message = lambda *a: None
    port = int(os.environ.get("PORT", "8799"))
    httpd = server.Server(("127.0.0.1", port), server.Handler)
    print(f"e2e server with SEC fixtures on http://127.0.0.1:{port}", flush=True)
    httpd.serve_forever(poll_interval=0.05)


if __name__ == "__main__":
    main()
