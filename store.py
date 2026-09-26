"""Small key-value store for finished SEC results, so each ticker is fetched from SEC once, not on every visit.

Three backends with the same interface, get(key) -> bytes | None and set(key, value, ttl_seconds):
- RedisStore: Upstash Redis over its REST API (the live site), chosen when Vercel's Redis variables are set
- FileStore: files in .cache/ (local development)
- MemoryStore: a dict (tests, and the Vercel fallback when no Redis is connected)

A failing store never breaks a request: callers treat errors as a cache miss (see stock_data.safe_get/safe_set).
Standard library only.
"""
import base64
import hashlib
import json
import os
import time
import urllib.request


class MemoryStore:
    def __init__(self, clock=time.time):
        self._data, self._clock = {}, clock

    def get(self, key):
        item = self._data.get(key)
        if item is None or item[1] <= self._clock():
            self._data.pop(key, None)
            return None
        return item[0]

    def set(self, key, value, ttl_seconds):
        self._data[key] = (value, self._clock() + ttl_seconds)


class FileStore:
    """One file per key: an 8-byte big-endian expiry timestamp, then the value."""

    def __init__(self, directory, clock=time.time):
        self._dir, self._clock = directory, clock
        os.makedirs(directory, exist_ok=True)

    def _path(self, key):
        return os.path.join(self._dir, hashlib.sha1(key.encode()).hexdigest())

    def get(self, key):
        try:
            with open(self._path(key), "rb") as fh:
                raw = fh.read()
        except FileNotFoundError:
            return None
        if int.from_bytes(raw[:8], "big") <= self._clock():
            return None
        return raw[8:]

    def set(self, key, value, ttl_seconds):
        tmp = self._path(key) + ".tmp"
        with open(tmp, "wb") as fh:
            fh.write(int(self._clock() + ttl_seconds).to_bytes(8, "big") + value)
        os.replace(tmp, self._path(key))  # atomic: a reader never sees a half-written file


class RedisStore:
    """Upstash Redis REST API: POST a command as a JSON array, e.g. ["SET", key, value, "EX", 60]."""

    def __init__(self, url, token, ssl_context=None, timeout=5):
        self._url, self._token, self._ssl, self._timeout = url.rstrip("/"), token, ssl_context, timeout

    def _command(self, *args):
        req = urllib.request.Request(self._url, data=json.dumps(args).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self._timeout, context=self._ssl) as resp:
            reply = json.loads(resp.read())
        if "error" in reply:
            raise RuntimeError(f"Redis error: {reply['error']}")
        return reply.get("result")

    def get(self, key):
        value = self._command("GET", key)
        return None if value is None else base64.b64decode(value)  # stored as base64: values are bytes

    def set(self, key, value, ttl_seconds):
        self._command("SET", key, base64.b64encode(value).decode(), "EX", int(ttl_seconds))


def from_environment(ssl_context=None):
    """Pick the backend: Redis if connected (Vercel sets KV_* or UPSTASH_* variables), else memory on Vercel
    (its disk is read-only), else files in .cache/ locally. STOCK_CACHE=off disables storage."""
    if os.environ.get("STOCK_CACHE", "").lower() == "off":
        return None
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    token = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if url and token:
        return RedisStore(url, token, ssl_context=ssl_context)
    if os.environ.get("VERCEL"):
        return MemoryStore()
    return FileStore(os.environ.get("STOCK_CACHE_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")))


def describe(store):
    return {RedisStore: "redis", FileStore: "file", MemoryStore: "memory"}.get(type(store), "off")


__all__ = ["MemoryStore", "FileStore", "RedisStore", "from_environment", "describe"]
