"""HTTP-level tests for the local server and the Vercel functions, on offline fixture data."""
import importlib.util
import json
import os
import threading
import urllib.error
import urllib.request
from http.server import HTTPServer, ThreadingHTTPServer

import pytest

import server
import stock_data
from helpers import ROOT


def load_vercel_handler():
    spec = importlib.util.spec_from_file_location("vercel_financials", os.path.join(ROOT, "api", "financials.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.handler


@pytest.fixture
def serve(sec_fixtures):
    """Start a handler class on a free port; yields a GET helper returning (status, headers, body)."""
    servers = []

    def start(handler_cls, threading_server=True):
        cls = ThreadingHTTPServer if threading_server else HTTPServer
        httpd = cls(("127.0.0.1", 0), handler_cls)
        threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()
        servers.append(httpd)
        base = f"http://127.0.0.1:{httpd.server_address[1]}"

        def get(path):
            try:
                with urllib.request.urlopen(base + path, timeout=10) as resp:
                    return resp.status, resp.headers, resp.read()
            except urllib.error.HTTPError as e:
                return e.code, e.headers, e.read()
        return get

    yield start
    for s in servers:
        s.shutdown()
        s.server_close()


@pytest.fixture
def local(serve):
    server.Handler.log_message = lambda *a: None  # keep test output quiet
    return serve(server.Handler)


def test_home_page_is_served(local):
    status, headers, body = local("/")
    assert status == 200 and headers["Content-Type"].startswith("text/html")
    assert b"Stock Trend Analyzer" in body


@pytest.mark.parametrize("path, ctype", [("/favicon.svg", "image/svg+xml"), ("/og.png", "image/png"),
                                         ("/js/app.js", "text/javascript"), ("/js/flags.js", "text/javascript")])
def test_static_assets_are_served(local, path, ctype):
    status, headers, _ = local(path)
    assert status == 200 and headers["Content-Type"].startswith(ctype)


@pytest.mark.parametrize("path", ["/server.py", "/stock_data.py", "/../server.py", "/%2e%2e/server.py",
                                  "/api/financials.py", "/README.md", "/nope.html"])
def test_source_files_and_unknown_paths_are_not_served(local, path):
    assert local(path)[0] == 404


def test_api_returns_financials_with_cdn_caching(local):
    status, headers, body = local("/api/financials?ticker=AAPL")
    data = json.loads(body)
    assert status == 200 and data["ticker"] == "AAPL" and len(data["years"]) == 10
    assert headers["Cache-Control"] == stock_data.CACHE_OK


@pytest.mark.parametrize("query, status", [("", 400), ("?ticker=", 400), ("?ticker=%3Cscript%3E", 400),
                                           ("?ticker=ZZZZQ", 404)])
def test_api_rejects_bad_input(local, query, status):
    code, headers, body = local("/api/financials" + query)
    assert code == status and "error" in json.loads(body)
    assert headers["Cache-Control"] != stock_data.CACHE_OK


def test_vercel_function_matches_local_server(serve, local):
    vercel = serve(load_vercel_handler(), threading_server=False)
    for query in ("?ticker=KO", "?ticker=ZZZZQ", "?ticker=%3Cx%3E"):
        a, b = local("/api/financials" + query), vercel("/api/financials" + query)
        assert a[0] == b[0], query
        assert json.loads(a[2]) == json.loads(b[2]), query
        assert a[1]["Cache-Control"] == b[1]["Cache-Control"], query


def test_vercel_config_bundles_the_shared_module():
    with open(os.path.join(ROOT, "vercel.json")) as fh:
        config = json.load(fh)
    assert config["outputDirectory"] == "public"
    for fn in config["functions"].values():
        assert fn["includeFiles"] == "stock_data.py"
    assert os.path.exists(os.path.join(ROOT, "public", "index.html"))
