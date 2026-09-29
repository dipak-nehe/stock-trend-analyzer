"""10-Year Stock Value Analysis - data layer.

Pulls up to 10 years of annual (10-K / 20-F / 40-F) financials for a ticker
from SEC EDGAR's free XBRL API. Shared by the local server (server.py) and the
Vercel serverless function (api/financials.py). Standard library only.
"""
import gzip
import json
import logging
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from . import filings, xbrl
from . import insiders as insiders_module
from . import store as store_module

# Moved to their own modules; re-exported for callers and tests that use stock_data.X.
from .filings import FINANCIAL_FORMS as FINANCIAL_FORMS
from .filings import _classify_filing as _classify_filing
from .xbrl import ANNUAL_FORMS as ANNUAL_FORMS
from .xbrl import CONCEPTS as CONCEPTS

YEARS = 10
TICKER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.\-]{0,9}$")

# Cache on the CDN only (s-maxage): filings change at most a few times a year, so a day is plenty.
# Browsers always revalidate (max-age=0), so a new app version never sees an old-format response.
CACHE_OK = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
CACHE_NOT_FOUND = "public, max-age=0, s-maxage=3600"
CACHE_NONE = "no-store"


# ---------- stored results (see store.py) ----------
# Bump CACHE_VERSION whenever the response format changes (together with API_VERSION in public/js/page.js),
# so stored entries in the old format are simply ignored.
CACHE_VERSION = "v9"
FRESH_SECONDS = 24 * 3600          # serve a stored result without asking SEC at all for this long
FACTS_MAX_SECONDS = 90 * 24 * 3600 # re-download the (large) financial figures at least this often
KEEP_SECONDS = 120 * 24 * 3600     # keep entries this long: re-checked cheaply, and a fallback if SEC is down
TICKERS_SECONDS = 7 * 24 * 3600    # ticker -> company lookup table
log = logging.getLogger("stock_data")
store = None                       # set at the bottom of this module (tests replace it)


def safe_get(key: str) -> Any:
    """Read and decode a stored JSON value; any storage problem counts as 'not stored'."""
    if store is None:
        return None
    try:
        raw = store.get(key)
        return None if raw is None else json.loads(gzip.decompress(raw))
    except Exception as e:  # noqa: BLE001
        log.warning("store read failed for %s: %s", key, e)
        return None


def safe_set(key: str, value: Any, ttl: int) -> None:
    if store is None:
        return
    try:
        store.set(key, gzip.compress(json.dumps(value, separators=(",", ":")).encode(), 6), ttl)
    except Exception as e:  # noqa: BLE001
        log.warning("store write failed for %s: %s", key, e)


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper().replace(".", "-").replace("/", "-")


# (status, body, Cache-Control, where the data came from: "HIT" | "MISS" | "STALE" | "REVALIDATED" | None)
Response = tuple[int, dict[str, Any], str, str | None]


class ConfigError(Exception):
    pass


def user_agent() -> str:
    # SEC's fair-access policy requires a contact in the User-Agent of every request.
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if "@" not in ua:
        raise ConfigError("Server not configured: set SEC_USER_AGENT to \"AppName your-email@example.com\".")
    return ua




def _ssl_context() -> ssl.SSLContext:
    # python.org macOS builds ship without root certs; fall back to certifi or the system bundle.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if os.path.exists("/etc/ssl/cert.pem"):
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


SSL_CTX = _ssl_context()
_cache: dict[str, tuple[float, Any]] = {}  # url -> (timestamp, parsed json)
CACHE_SECONDS = 6 * 3600


def sec_get(url: str) -> Any:
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    req = urllib.request.Request(url, headers={"User-Agent": user_agent(), "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _cache[url] = (time.time(), data)
    return data


_rate_lock = threading.Lock()
_last_request = [0.0]
MIN_INTERVAL = 0.125  # at most 8 requests a second, under SEC's limit of 10, even with parallel downloads


def sec_get_text(url: str) -> str:
    """Download a text document (e.g. a Form 4's XML), spacing requests to stay within SEC's rate limit."""
    with _rate_lock:
        wait = _last_request[0] + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_request[0] = time.monotonic()
    req = urllib.request.Request(url, headers={"User-Agent": user_agent(), "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
        return str(resp.read().decode("utf-8"))


def today() -> date:
    """Today's date; STOCK_DATA_TODAY (YYYY-MM-DD) fixes it for tests on saved filings."""
    fixed = os.environ.get("STOCK_DATA_TODAY")
    return date.fromisoformat(fixed) if fixed else date.today()


FORM4_KEEP_SECONDS = 400 * 24 * 3600  # a filed Form 4 never changes


def insider_activity(cik: int, sub: dict[str, Any]) -> dict[str, Any] | None:
    """Open-market insider buys and sales in the last 12 months (backend/insiders.py). Parsed filings are stored
    under their own version, so a CACHE_VERSION bump doesn't download them all again."""
    result: dict[str, Any] | None = insiders_module.insider_activity(
        cik, sub, fetch_text=lambda url: sec_get_text(url),
        cache_get=lambda accession: safe_get(f"f4v1:{accession}"),
        cache_set=lambda accession, value: safe_set(f"f4v1:{accession}", value, FORM4_KEEP_SECONDS),
        today=today())
    return result


def ticker_table() -> dict[str, list[Any]]:
    """{TICKER: [cik, title, ticker]}: stored for a week instead of downloading SEC's multi-MB list each time."""
    key = f"{CACHE_VERSION}:tickers"
    table: dict[str, list[Any]] | None = safe_get(key)
    if table is None:
        table = {row["ticker"].upper(): [row["cik_str"], row["title"], row["ticker"]]
                 for row in sec_get("https://www.sec.gov/files/company_tickers.json").values()}
        safe_set(key, table, TICKERS_SECONDS)
    return table


def lookup_cik(ticker: str) -> tuple[Any, ...] | None:
    row = ticker_table().get(normalize_ticker(ticker))
    return tuple(row) if row else None


def submissions(cik: int) -> dict[str, Any]:
    sub: dict[str, Any] = sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    return sub


def filing_history(cik: int, since: str, sub: dict[str, Any] | None = None) -> dict[str, Any]:
    """Notable filings on or after `since` (backend/filings.py), downloading older pages of the list if needed."""
    return filings.filing_history(cik, since, sub or submissions(cik), fetch=lambda url: sec_get(url))


def build_financials(ticker: str) -> dict[str, Any]:
    found = lookup_cik(ticker)
    if not found:
        raise LookupError(f"Ticker '{ticker}' not found in SEC EDGAR (only SEC-registered companies are supported).")
    cik, name, sec_ticker = found
    facts = sec_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")["facts"]

    currency = xbrl.reporting_currency(facts)
    fy_ends = xbrl.fiscal_year_ends(facts, currency)
    if not fy_ends:
        raise LookupError(f"No annual report data found in SEC XBRL filings for {sec_ticker}.")
    years = sorted(fy_ends)[-YEARS:]
    splits = xbrl.split_events(facts, currency)

    series, sources = {}, {}
    for metric, (kind, candidates) in CONCEPTS.items():
        vals, used = [], []
        per_concept = [(c, xbrl.annual_values(facts, tax, c, kind, currency)) for tax, c in candidates]
        for y in years:
            end = xbrl._d(fy_ends[y])
            v = None
            for concept, values in per_concept:
                # balance-sheet dates can differ by a few days from the P&L end (52/53-week years)
                match = next((values[e] for e in values if abs((xbrl._d(e) - end).days) <= 7), None)
                if match is not None:
                    v, filed = match
                    if metric in xbrl.PER_SHARE:
                        for split_filed, factor in splits:
                            if filed < split_filed:
                                v = v * factor ** xbrl.PER_SHARE[metric]
                    if concept not in used:
                        used.append(concept)
                    break
            vals.append(v)
        series[metric] = vals
        sources[metric] = used

    shares = xbrl.latest_shares_outstanding(facts)
    try:
        sub = submissions(cik)
        history = filing_history(cik, f"{years[0]}-01-01", sub)
        marker = filings.financial_marker(sub)
        report = filings.latest_report(cik, sub)
    except Exception:  # noqa: BLE001 - the financials are still useful without it
        sub, history, marker, report = None, None, None, None

    # Derived series
    total_debt, lt_debt = [], []
    for i in range(len(years)):
        ltd_total, ltd_nc = series["_ltdTotal"][i], series["_ltdNoncurrent"][i]
        ltd_cur, stb = series["_ltdCurrent"][i], series["_shortTermBorrowings"][i]
        if ltd_total is None and ltd_nc is not None:
            ltd_total = ltd_nc + (ltd_cur or 0)
        if ltd_nc is None and ltd_total is not None:
            ltd_nc = ltd_total - (ltd_cur or 0)
        total_debt.append(ltd_total + (stb or 0) if ltd_total is not None else stb)
        lt_debt.append(ltd_nc)

        # Total liabilities = everything that isn't equity. Minority owners' stakes in subsidiaries are
        # equity, not liabilities, so subtract equity INCLUDING non-controlling interests.
        liabilities, liab_and_eq = series["totalLiabilities"][i], series["liabilitiesAndEquity"][i]
        if liabilities is None and liab_and_eq is not None:
            eq_all, eq = series["_equityInclNci"][i], series["equity"][i]
            if eq_all is None and eq is not None:
                eq_all = eq + (series["_minorityInterest"][i] or 0)
            if eq_all is not None:
                series["totalLiabilities"][i] = liab_and_eq - eq_all
        dps, paid, diluted = series["dps"][i], series["dividendsPaid"][i], series["dilutedShares"][i]
        if dps is None and paid is not None and diluted:
            series["dps"][i] = round(paid / diluted, 4)

    series["totalDebt"], series["longTermDebt"] = total_debt, lt_debt
    sources["totalDebt"] = sources["_ltdTotal"] + sources["_ltdNoncurrent"] + sources["_ltdCurrent"] + sources["_shortTermBorrowings"]
    sources["longTermDebt"] = sources["_ltdNoncurrent"] + sources["_ltdTotal"] + sources["_ltdCurrent"]
    for k in [k for k in series if k.startswith("_")]:
        series.pop(k), sources.pop(k)

    return {
        "ticker": sec_ticker,
        "name": name,
        "cik": cik,
        "currency": currency,
        "years": years,
        "periodEnds": [fy_ends[y] for y in years],
        "series": series,
        "sources": sources,
        "splits": [{"detectedInFiling": d, "ratio": round(f, 4)} for d, f in splits],
        "secHistory": history,
        "latestReport": report,
        "_marker": marker,  # latest annual/quarterly report; kept in storage, removed from the response
        "sharesOutstanding": {"value": shares[2], "asOf": shares[0], "source": shares[3]} if shares else None,
        "secUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K",
    }


def api_response(ticker: str, now: Callable[[], float] = time.time) -> Response:
    """Handle one /api/financials request.

    Returns (status, body_dict, cache_control, data_cache) where data_cache says where the data came from:
    "HIT" (stored, fresh), "MISS" (fetched from SEC now), "STALE" (SEC failed, stored copy served) or None.
    """
    ticker = (ticker or "").strip()
    if not ticker:
        return 400, {"error": "Please enter a ticker."}, CACHE_NONE, None
    if not TICKER_RE.match(ticker):
        return 400, {"error": "That doesn't look like a ticker. Use letters, digits, '.' or '-' (e.g. AAPL, BRK.B)."}, CACHE_NONE, None

    key = f"{CACHE_VERSION}:fin:{normalize_ticker(ticker)}"
    stored = safe_get(key)
    if stored and now() - stored["fetchedTs"] < FRESH_SECONDS:
        return 200, stored["data"], CACHE_OK, "HIT"
    # Stored figures can be re-checked cheaply (filing list only) if they're under 90 days old and we know
    # which report they came from; otherwise do a full refresh.
    recheck = bool(stored and stored.get("marker")
                   and now() - stored.get("factsTs", stored["fetchedTs"]) < FACTS_MAX_SECONDS)

    def stale_or(status: int, body: dict[str, Any], cache: str) -> Response:
        # SEC failed: a stored copy (even an old one) beats an error page
        if stored:
            return 200, {**stored["data"], "stale": True}, CACHE_NONE, "STALE"
        return status, body, cache, None

    try:
        data = revalidate(stored) if recheck else None
        if data is not None:
            source, marker, facts_ts = "REVALIDATED", stored["marker"], stored.get("factsTs", stored["fetchedTs"])
        else:
            data = build_financials(ticker)
            source, marker, facts_ts = "MISS", data.pop("_marker", None), now()
    except ConfigError as e:
        return stale_or(500, {"error": str(e)}, CACHE_NONE)
    except LookupError as e:
        return 404, {"error": str(e)}, CACHE_NOT_FOUND, None
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            msg = "SEC EDGAR is limiting requests right now. Please try again in a minute."
        elif e.code == 404:
            return 404, {"error": f"SEC EDGAR has no financial data (XBRL) for '{ticker.upper()}'."}, CACHE_NOT_FOUND, None
        else:
            msg = f"SEC EDGAR returned an error (HTTP {e.code}). Please try again shortly."
        return stale_or(502, {"error": msg}, CACHE_NONE)
    except (urllib.error.URLError, TimeoutError):
        return stale_or(504, {"error": "SEC EDGAR took too long to respond. Please try again."}, CACHE_NONE)
    except Exception:  # noqa: BLE001
        log.exception("failed to build financials for %s", ticker)
        return stale_or(500, {"error": "Something went wrong while processing this company's filings."}, CACHE_NONE)

    ts = now()
    data["dataAsOf"] = datetime.fromtimestamp(ts, UTC).isoformat(timespec="seconds")  # last checked with SEC
    safe_set(key, {"fetchedTs": ts, "factsTs": facts_ts, "marker": marker, "data": data}, KEEP_SECONDS)
    return 200, data, CACHE_OK, source


def insider_response(ticker: str, now: Callable[[], float] = time.time) -> Response:
    """Handle one /api/insiders request: the insider-trades summary, asked for by the page after the main results.

    It's separate because reading a company's Form 4s the first time takes several seconds (one download each,
    within SEC's rate limit), and the rest of the page shouldn't wait for it. Same return shape as api_response.
    A failure is never stored, so the next request simply tries again.
    """
    ticker = (ticker or "").strip()
    if not TICKER_RE.match(ticker):
        return 400, {"error": "That doesn't look like a ticker."}, CACHE_NONE, None
    key = f"{CACHE_VERSION}:ins:{normalize_ticker(ticker)}"
    stored = safe_get(key)
    if stored and now() - stored["fetchedTs"] < FRESH_SECONDS:
        return 200, stored["data"], CACHE_OK, "HIT"
    try:
        found = lookup_cik(ticker)
        if not found:
            return 404, {"error": f"Ticker '{ticker.upper()}' not found in SEC EDGAR."}, CACHE_NOT_FOUND, None
        cik = found[0]
        data = {"ticker": found[2], "insiders": insider_activity(cik, submissions(cik))}
    except ConfigError as e:
        return 500, {"error": str(e)}, CACHE_NONE, None
    except Exception:  # noqa: BLE001 - SEC unreachable or limiting: an older summary beats none
        log.exception("insider summary failed for %s", ticker)
        if stored:
            return 200, {**stored["data"], "stale": True}, CACHE_NONE, "STALE"
        return 502, {"error": "Insider trades couldn't be loaded from SEC EDGAR right now."}, CACHE_NONE, None
    safe_set(key, {"fetchedTs": now(), "data": data}, KEEP_SECONDS)
    return 200, data, CACHE_OK, "MISS"


def revalidate(stored: dict[str, Any]) -> dict[str, Any] | None:
    """Download only the filing list. If no annual or quarterly report has appeared since the stored figures,
    reuse them with a refreshed filing history; return None when a full refresh is needed."""
    d = stored["data"]
    sub = submissions(d["cik"])
    if filings.financial_marker(sub) != stored["marker"]:
        return None
    since = (d.get("secHistory") or {}).get("since") or f"{d['years'][0]}-01-01"
    return {**d, "secHistory": filing_history(d["cik"], since, sub)}


store = store_module.from_environment(ssl_context=SSL_CTX)
