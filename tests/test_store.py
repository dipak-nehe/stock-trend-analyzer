"""Stored results: the three storage backends, backend selection, and the caching rules in api_response."""
import base64
import json
import threading
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

import stock_data
import store
from helpers import fixture_sec_get


class Clock:
    def __init__(self, t=1_000_000.0):
        self.t = t

    def __call__(self):
        return self.t


# ---------- backends ----------

@pytest.mark.parametrize("make", [lambda c, tmp: store.MemoryStore(clock=c), lambda c, tmp: store.FileStore(tmp, clock=c)],
                         ids=["memory", "file"])
def test_backend_round_trip_and_expiry(make, tmp_path):
    clock = Clock()
    s = make(clock, str(tmp_path))
    assert s.get("k") is None
    s.set("k", b"\x00binary\xff", 60)
    assert s.get("k") == b"\x00binary\xff"
    clock.t += 59
    assert s.get("k") == b"\x00binary\xff"
    clock.t += 2
    assert s.get("k") is None


def test_file_store_survives_a_restart(tmp_path):
    clock = Clock()
    store.FileStore(str(tmp_path), clock=clock).set("AAPL", b"data", 60)
    assert store.FileStore(str(tmp_path), clock=clock).get("AAPL") == b"data"   # a new process reads it back


class FakeUpstash(BaseHTTPRequestHandler):
    """Speaks the Upstash REST protocol: POST a JSON command array, get {"result": ...}."""
    data, auth = {}, []

    def do_POST(self):
        FakeUpstash.auth.append(self.headers["Authorization"])
        cmd = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if cmd[0] == "SET":
            FakeUpstash.data[cmd[1]] = cmd[2]
            assert cmd[3:] == ["EX", 120]
            reply = {"result": "OK"}
        elif cmd[0] == "GET":
            reply = {"result": FakeUpstash.data.get(cmd[1])}
        else:
            reply = {"error": "ERR unknown command"}
        out = json.dumps(reply).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


@pytest.fixture
def upstash():
    FakeUpstash.data, FakeUpstash.auth = {}, []
    httpd = HTTPServer(("127.0.0.1", 0), FakeUpstash)
    threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def test_redis_store_speaks_upstash_rest(upstash):
    s = store.RedisStore(upstash, "secret-token")
    assert s.get("k") is None
    s.set("k", b"\x00gz\xff", 120)
    assert s.get("k") == b"\x00gz\xff"
    assert base64.b64decode(FakeUpstash.data["k"]) == b"\x00gz\xff"      # bytes travel as base64 text
    assert set(FakeUpstash.auth) == {"Bearer secret-token"}


def test_redis_errors_are_raised(upstash):
    with pytest.raises(RuntimeError, match="Redis error"):
        store.RedisStore(upstash, "t")._command("NOPE")


@pytest.mark.parametrize("env, expected", [
    ({"KV_REST_API_URL": "https://x.upstash.io", "KV_REST_API_TOKEN": "t"}, "redis"),
    ({"UPSTASH_REDIS_REST_URL": "https://x.upstash.io", "UPSTASH_REDIS_REST_TOKEN": "t"}, "redis"),
    ({"VERCEL": "1"}, "memory"),        # Vercel's disk is read-only
    ({}, "file"),                        # local development
    ({"STOCK_CACHE": "off"}, "off"),
])
def test_backend_is_chosen_from_the_environment(monkeypatch, tmp_path, env, expected):
    for var in ("KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VERCEL", "STOCK_CACHE"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("STOCK_CACHE_DIR", str(tmp_path))
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    assert store.describe(store.from_environment()) == expected


# ---------- caching rules ----------

@pytest.fixture
def sec(monkeypatch):
    """Offline SEC data with a call counter and a switch to make SEC fail."""
    monkeypatch.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    state = {"calls": [], "fail": None}

    def sec_get(url):
        state["calls"].append(url)
        if state["fail"]:
            raise state["fail"]
        return fixture_sec_get(url)
    monkeypatch.setattr(stock_data, "sec_get", sec_get)
    return state


def test_first_lookup_fetches_from_sec_and_the_next_one_is_served_from_storage(sec):
    status, body, cache, source = stock_data.api_response("KO")
    assert (status, source) == (200, "MISS") and body["dataAsOf"].endswith("+00:00")
    fetched = len(sec["calls"])
    status, again, cache, source = stock_data.api_response("ko")          # case doesn't matter
    assert (status, source) == (200, "HIT")
    assert len(sec["calls"]) == fetched                                   # no SEC call at all
    assert again == body and cache == stock_data.CACHE_OK


def test_class_share_spellings_share_one_stored_result():
    keys = {stock_data.normalize_ticker(t) for t in ("BRK.B", "brk.b", "BRK-B", " brk/b ")}
    assert keys == {"BRK-B"}


def test_stored_result_is_refreshed_after_24_hours(sec):
    clock = Clock()
    stock_data.api_response("KO", now=clock)
    clock.t += stock_data.FRESH_SECONDS + 1
    status, body, _, source = stock_data.api_response("KO", now=clock)
    assert source == "MISS"                                               # fetched again, stored again
    clock.t += 60
    assert stock_data.api_response("KO", now=clock)[3] == "HIT"


@pytest.mark.parametrize("failure", [urllib.error.URLError("down"), TimeoutError(),
                                     urllib.error.HTTPError("u", 429, "Too Many", {}, None), ValueError("boom")])
def test_old_copy_is_served_when_sec_fails(sec, failure):
    clock = Clock()
    stock_data.api_response("KO", now=clock)
    clock.t += stock_data.FRESH_SECONDS + 3600                            # stale...
    sec["fail"] = failure                                                 # ...and SEC is down
    status, body, cache, source = stock_data.api_response("KO", now=clock)
    assert (status, source) == (200, "STALE") and body["stale"] is True
    assert cache == stock_data.CACHE_NONE                                 # the CDN must not keep a stale answer
    assert body["name"] == "COCA COLA CO"


def test_without_a_stored_copy_sec_errors_are_reported(sec):
    sec["fail"] = urllib.error.URLError("down")
    status, body, _, source = stock_data.api_response("KO")
    assert status == 504 and source is None and "too long" in body["error"]


def test_unknown_tickers_are_not_stored(sec, fresh_store):
    assert stock_data.api_response("ZZZZQ")[0] == 404
    assert fresh_store.get(f"{stock_data.CACHE_VERSION}:fin:ZZZZQ") is None


def test_results_from_an_older_format_version_are_ignored(sec, monkeypatch):
    stock_data.api_response("KO")
    monkeypatch.setattr(stock_data, "CACHE_VERSION", "v5")
    assert stock_data.api_response("KO")[3] == "MISS"


def test_ticker_list_is_stored_instead_of_downloaded_each_time(sec):
    stock_data.api_response("KO")
    stock_data.api_response("AAPL")
    assert sum("company_tickers" in c for c in sec["calls"]) == 1


def test_a_broken_store_never_breaks_a_request(sec, monkeypatch):
    class Broken:
        def get(self, key): raise ConnectionError("store down")
        def set(self, key, value, ttl): raise ConnectionError("store down")
    monkeypatch.setattr(stock_data, "store", Broken())
    for _ in range(2):
        status, body, _, source = stock_data.api_response("KO")
        assert (status, source) == (200, "MISS") and body["ticker"] == "KO"


def test_stored_values_are_compressed(sec, fresh_store):
    stock_data.api_response("AAPL")
    raw = fresh_store.get(f"{stock_data.CACHE_VERSION}:fin:AAPL")
    assert raw[:2] == b"\x1f\x8b"                                          # gzip
    assert len(raw) < 40_000
