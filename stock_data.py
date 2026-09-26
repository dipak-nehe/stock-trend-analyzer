"""Stock Trend Analyzer - data layer.

Pulls up to 10 years of annual (10-K / 20-F / 40-F) financials for a ticker
from SEC EDGAR's free XBRL API. Shared by the local server (server.py) and the
Vercel serverless function (api/financials.py). Standard library only.
"""
import gzip
import json
import logging
import os
import re
import socket
import ssl
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone

import store as store_module

YEARS = 10
TICKER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.\-]{0,9}$")

# Cache on the CDN only (s-maxage): filings change at most a few times a year, so a day is plenty.
# Browsers always revalidate (max-age=0), so a new app version never sees an old-format response.
CACHE_OK = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
CACHE_NOT_FOUND = "public, max-age=0, s-maxage=3600"
CACHE_NONE = "no-store"


# ---------- stored results (see store.py) ----------
# Bump CACHE_VERSION whenever the response format changes (together with API_VERSION in public/js/app.js),
# so stored entries in the old format are simply ignored.
CACHE_VERSION = "v4"
FRESH_SECONDS = 24 * 3600          # serve a stored result without asking SEC at all for this long
FACTS_MAX_SECONDS = 90 * 24 * 3600 # re-download the (large) financial figures at least this often
KEEP_SECONDS = 120 * 24 * 3600     # keep entries this long: re-checked cheaply, and a fallback if SEC is down
TICKERS_SECONDS = 7 * 24 * 3600    # ticker -> company lookup table
log = logging.getLogger("stock_data")
store = None                       # set at the bottom of this module (tests replace it)


def safe_get(key):
    """Read and decode a stored JSON value; any storage problem counts as 'not stored'."""
    if store is None:
        return None
    try:
        raw = store.get(key)
        return None if raw is None else json.loads(gzip.decompress(raw))
    except Exception as e:  # noqa: BLE001
        log.warning("store read failed for %s: %s", key, e)
        return None


def safe_set(key, value, ttl):
    if store is None:
        return
    try:
        store.set(key, gzip.compress(json.dumps(value, separators=(",", ":")).encode(), 6), ttl)
    except Exception as e:  # noqa: BLE001
        log.warning("store write failed for %s: %s", key, e)


def normalize_ticker(ticker):
    return ticker.strip().upper().replace(".", "-").replace("/", "-")


class ConfigError(Exception):
    pass


def user_agent():
    # SEC's fair-access policy requires a contact in the User-Agent of every request.
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if "@" not in ua:
        raise ConfigError("Server not configured: set SEC_USER_AGENT to \"AppName your-email@example.com\".")
    return ua


ANNUAL_FORMS = {"10-K", "10-K/A", "10-KT", "20-F", "20-F/A", "40-F", "40-F/A"}

# metric -> (kind, [(taxonomy, concept), ...]) in priority order.
# "duration" = income/cash-flow items (one fiscal year), "instant" = balance sheet.
CONCEPTS = {
    "revenue": ("duration", [
        ("us-gaap", "Revenues"),
        ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"),
        ("us-gaap", "RevenueFromContractWithCustomerIncludingAssessedTax"),
        ("us-gaap", "SalesRevenueNet"),
        ("us-gaap", "SalesRevenueGoodsNet"),
        ("us-gaap", "RevenuesNetOfInterestExpense"),
        ("ifrs-full", "Revenue"),
    ]),
    "netIncome": ("duration", [
        ("us-gaap", "NetIncomeLoss"),
        ("us-gaap", "NetIncomeLossAvailableToCommonStockholdersBasic"),
        ("us-gaap", "ProfitLoss"),
        ("ifrs-full", "ProfitLossAttributableToOwnersOfParent"),
        ("ifrs-full", "ProfitLoss"),
    ]),
    "grossProfit": ("duration", [("us-gaap", "GrossProfit"), ("ifrs-full", "GrossProfit")]),
    "operatingIncome": ("duration", [
        ("us-gaap", "OperatingIncomeLoss"),
        ("ifrs-full", "ProfitLossFromOperatingActivities"),
    ]),
    "eps": ("duration", [
        ("us-gaap", "EarningsPerShareDiluted"),
        ("us-gaap", "EarningsPerShareBasicAndDiluted"),
        ("us-gaap", "EarningsPerShareBasic"),
        ("ifrs-full", "DilutedEarningsLossPerShare"),
        ("ifrs-full", "BasicEarningsLossPerShare"),
    ]),
    "dps": ("duration", [
        ("us-gaap", "CommonStockDividendsPerShareDeclared"),
        ("us-gaap", "CommonStockDividendsPerShareCashPaid"),
    ]),
    "dividendsPaid": ("duration", [
        ("us-gaap", "PaymentsOfDividendsCommonStock"),
        ("us-gaap", "PaymentsOfDividends"),
        ("us-gaap", "DividendsCommonStockCash"),
        ("us-gaap", "DividendsCommonStock"),
        ("ifrs-full", "DividendsPaidClassifiedAsFinancingActivities"),
        ("ifrs-full", "DividendsPaid"),
    ]),
    "operatingCashFlow": ("duration", [
        ("us-gaap", "NetCashProvidedByUsedInOperatingActivities"),
        ("us-gaap", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"),
        ("ifrs-full", "CashFlowsFromUsedInOperatingActivities"),
    ]),
    "capex": ("duration", [
        ("us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"),
        ("us-gaap", "PaymentsToAcquireProductiveAssets"),
        ("ifrs-full", "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"),
    ]),
    "interestExpense": ("duration", [
        ("us-gaap", "InterestExpense"),
        ("us-gaap", "InterestExpenseNonoperating"),
        ("us-gaap", "InterestExpenseDebt"),
        ("ifrs-full", "FinanceCosts"),
    ]),
    "dilutedShares": ("duration", [
        ("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding"),
        ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic"),
        ("ifrs-full", "AdjustedWeightedAverageShares"),
        ("ifrs-full", "WeightedAverageShares"),
    ]),
    "totalAssets": ("instant", [("us-gaap", "Assets"), ("ifrs-full", "Assets")]),
    "totalLiabilities": ("instant", [("us-gaap", "Liabilities"), ("ifrs-full", "Liabilities")]),
    "equity": ("instant", [
        ("us-gaap", "StockholdersEquity"),
        ("us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
        ("ifrs-full", "EquityAttributableToOwnersOfParent"),
        ("ifrs-full", "Equity"),
    ]),
    "liabilitiesAndEquity": ("instant", [
        ("us-gaap", "LiabilitiesAndStockholdersEquity"),
        ("ifrs-full", "EquityAndLiabilities"),
    ]),
    "currentAssets": ("instant", [("us-gaap", "AssetsCurrent"), ("ifrs-full", "CurrentAssets")]),
    "currentLiabilities": ("instant", [("us-gaap", "LiabilitiesCurrent"), ("ifrs-full", "CurrentLiabilities")]),
    "cash": ("instant", [
        ("us-gaap", "CashAndCashEquivalentsAtCarryingValue"),
        ("us-gaap", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"),
        ("us-gaap", "Cash"),
        ("ifrs-full", "CashAndCashEquivalents"),
    ]),
    # Debt and liability building blocks, combined into consistent series in build_financials().
    # Companies switch tags over the years (e.g. total vs non-current only), so tags are never mixed
    # across definitions: each helper holds one definition.
    "_ltdTotal": ("instant", [  # long-term debt INCLUDING the portion due within a year
        ("us-gaap", "LongTermDebt"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"),
        ("ifrs-full", "Borrowings"),
    ]),
    "_ltdNoncurrent": ("instant", [  # long-term debt EXCLUDING the portion due within a year
        ("us-gaap", "LongTermDebtNoncurrent"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligations"),
        ("ifrs-full", "NoncurrentPortionOfNoncurrentBorrowings"),
    ]),
    "_ltdCurrent": ("instant", [  # portion of long-term debt due within a year
        ("us-gaap", "LongTermDebtCurrent"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligationsCurrent"),
        ("ifrs-full", "CurrentPortionOfNoncurrentBorrowings"),
    ]),
    "_shortTermBorrowings": ("instant", [  # one tag only: ShortTermBorrowings usually already includes commercial paper
        ("us-gaap", "ShortTermBorrowings"),
        ("us-gaap", "CommercialPaper"),
        ("ifrs-full", "ShorttermBorrowings"),
    ]),
    "_equityInclNci": ("instant", [
        ("us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
        ("ifrs-full", "Equity"),
    ]),
    "_minorityInterest": ("instant", [
        ("us-gaap", "MinorityInterest"),
        ("ifrs-full", "NoncontrollingInterests"),
    ]),
    "goodwill": ("instant", [("us-gaap", "Goodwill"), ("ifrs-full", "Goodwill")]),
    "receivables": ("instant", [
        ("us-gaap", "AccountsReceivableNetCurrent"),
        ("ifrs-full", "TradeAndOtherCurrentReceivables"),
    ]),
    "inventory": ("instant", [("us-gaap", "InventoryNet"), ("ifrs-full", "Inventories")]),
}



def _ssl_context():
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
_cache = {}  # url -> (timestamp, parsed json)
CACHE_SECONDS = 6 * 3600


def sec_get(url):
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    req = urllib.request.Request(url, headers={"User-Agent": user_agent(), "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _cache[url] = (time.time(), data)
    return data


def ticker_table():
    """{TICKER: [cik, title, ticker]}: stored for a week instead of downloading SEC's multi-MB list each time."""
    key = f"{CACHE_VERSION}:tickers"
    table = safe_get(key)
    if table is None:
        table = {row["ticker"].upper(): [row["cik_str"], row["title"], row["ticker"]]
                 for row in sec_get("https://www.sec.gov/files/company_tickers.json").values()}
        safe_set(key, table, TICKERS_SECONDS)
    return table


def lookup_cik(ticker):
    row = ticker_table().get(normalize_ticker(ticker))
    return tuple(row) if row else None


def _d(s):
    return date.fromisoformat(s)


def reporting_currency(facts):
    """The currency the company reports in (most facts on its net income / revenue line)."""
    for metric in ("netIncome", "revenue"):
        for tax, concept in CONCEPTS[metric][1]:
            node = facts.get(tax, {}).get(concept)
            if node:
                return max(node["units"], key=lambda u: len(node["units"][u]))
    return "USD"


def _pick_unit(units, currency):
    for pref in (currency, f"{currency}/shares", "shares"):
        if pref in units:
            return pref
    return None  # only in some other currency (e.g. a convenience translation) - skip it


def _is_annual(f, kind):
    if f.get("form") not in ANNUAL_FORMS or "end" not in f:
        return False
    if kind == "duration":
        return "start" in f and 330 <= (_d(f["end"]) - _d(f["start"])).days <= 380
    return "start" not in f


def annual_values(facts, taxonomy, concept, kind, currency):
    """Return {period_end: (value, filed)} of annual values; the latest filing wins (restated)."""
    node = facts.get(taxonomy, {}).get(concept)
    unit = node and _pick_unit(node["units"], currency)
    if not unit:
        return {}
    best = {}
    for f in node["units"][unit]:
        if _is_annual(f, kind):
            prev = best.get(f["end"])
            if prev is None or f["filed"] > prev[1]:
                best[f["end"]] = (f["val"], f["filed"])
    return best


NICE_SPLIT_RATIOS = (1.5, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50)


def split_events(facts, currency):
    """Detect stock splits from EPS values that were restated by a later filing.

    Returns [(first_filing_date_after_split, factor)]; factor > 1 is a forward split.
    Older, never-restated per-share values filed before that date must be divided by factor.
    """
    events = []
    for tax, concept in CONCEPTS["eps"][1]:
        node = facts.get(tax, {}).get(concept)
        unit = node and _pick_unit(node["units"], currency)
        if not unit:
            continue
        by_end = {}
        for f in node["units"][unit]:
            if _is_annual(f, "duration") and f["val"]:
                by_end.setdefault(f["end"], []).append((f["filed"], f["val"]))
        for reports in by_end.values():
            reports.sort()
            for (_, old), (filed, new) in zip(reports, reports[1:]):
                r = old / new
                if r <= 0:
                    continue
                inv = r < 1
                x = 1 / r if inv else r
                nice = next((n for n in NICE_SPLIT_RATIOS if abs(x - n) / n < 0.03), None)
                if nice:
                    factor = 1 / nice if inv else nice
                    if not any(abs(factor - f0) < 1e-9 and abs((_d(filed) - _d(d0)).days) < 400
                               for d0, f0 in events):
                        events.append((filed, factor))
        if events:
            break
    # keep the earliest restating filing per split
    events.sort()
    return events


def latest_shares_outstanding(facts):
    """Most recent common shares outstanding (cover page or balance sheet), summed across share classes."""
    best = None  # (end, filed, value, source)
    for tax, concept in (("dei", "EntityCommonStockSharesOutstanding"), ("us-gaap", "CommonStockSharesOutstanding"),
                         ("ifrs-full", "NumberOfSharesOutstanding")):
        node = facts.get(tax, {}).get(concept)
        if not node or "shares" not in node["units"]:
            continue
        rows = node["units"]["shares"]
        end = max(r["end"] for r in rows)
        latest = [r for r in rows if r["end"] == end]
        accn = max(latest, key=lambda r: r["filed"])["accn"]
        same_filing = [r for r in latest if r["accn"] == accn]
        cand = (end, same_filing[0]["filed"], sum(r["val"] for r in same_filing), concept)
        if best is None or cand[:2] > best[:2]:
            best = cand
    return best


# ---------- SEC filing history ("remarks") ----------
AMENDMENT_FORMS = {"10-K/A", "20-F/A", "40-F/A"}
# Reports that can change the figures we show: annual reports (the yearly numbers) and quarterly reports
# (the latest share count). A new one of these means the stored figures must be refreshed.
FINANCIAL_FORMS = ANNUAL_FORMS | {"10-Q", "10-Q/A", "10-QT"}


def submissions(cik):
    return sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")


def financial_marker(sub):
    """Identifies the latest annual or quarterly report, e.g. "2026-08-01:0000320193-26-000020"."""
    t = sub["filings"]["recent"]
    latest = max(((t["filingDate"][i], t["accessionNumber"][i]) for i, form in enumerate(t["form"]) if form in FINANCIAL_FORMS),
                 default=None)
    return f"{latest[0]}:{latest[1]}" if latest else None


def _classify_filing(form, items):
    """Map one filing to a notable event type, or None."""
    items = {i.strip() for i in (items or "").split(",")}
    if form in ("8-K", "8-K/A") and "4.02" in items:
        return "non_reliance", "Company said earlier financial statements can't be relied on (restatement)"
    if form in ("8-K", "8-K/A") and "4.01" in items:
        return "auditor_change", "Change in the company's independent auditor"
    if form.startswith("NT "):
        return "late_filing", f"Notice of late filing: couldn't file its {form[3:]} on time"
    if form in AMENDMENT_FORMS:
        return "amendment", f"Amended annual report ({form[:-2]})"
    if form == "UPLOAD":
        return "sec_letter", "SEC staff letter from a filing review"
    if form == "CORRESP":
        return "company_response", "Company letter to SEC staff (usually a response to review comments)"
    return None


def filing_history(cik, since, sub=None):
    """Notable filings on or after `since` (YYYY-MM-DD) from EDGAR's submissions index (pass `sub` if already fetched)."""
    base = "https://data.sec.gov/submissions/"
    sub = sub or submissions(cik)
    tables = [sub["filings"]["recent"]]
    for f in sub["filings"].get("files", []):
        if f.get("filingTo", "") >= since:  # older pages, only if they overlap the window
            tables.append(sec_get(base + f["name"]))
    events = []
    for t in tables:
        for i, form in enumerate(t["form"]):
            filed = t["filingDate"][i]
            if filed < since:
                continue
            kind = _classify_filing(form, t["items"][i] if "items" in t else "")
            if not kind:
                continue
            accn = t["accessionNumber"][i].replace("-", "")
            doc = t["primaryDocument"][i]
            folder = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/"
            events.append({"date": filed, "type": kind[0], "form": form, "description": kind[1],
                           "url": folder + doc if doc else folder})
    events.sort(key=lambda e: e["date"], reverse=True)
    counts = {}
    for e in events:
        counts[e["type"]] = counts.get(e["type"], 0) + 1
    return {"since": since, "events": events, "counts": counts,
            "industry": sub.get("sicDescription") or None,
            "filingsUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=&dateb=&owner=include&count=40"}


def fiscal_year_ends(facts, currency):
    """Fiscal year end dates, taken from annual income-statement periods."""
    ends = set()
    for metric in ("netIncome", "revenue"):
        for tax, concept in CONCEPTS[metric][1]:
            ends.update(annual_values(facts, tax, concept, "duration", currency).keys())
    by_year = {}
    for e in sorted(ends):
        by_year[_d(e).year] = e  # later end wins if fiscal year changed
    return by_year  # {fiscal_year: 'YYYY-MM-DD'}


PER_SHARE = {"eps": -1, "dps": -1, "dilutedShares": 1}  # exponent applied to the split factor


def build_financials(ticker):
    found = lookup_cik(ticker)
    if not found:
        raise LookupError(f"Ticker '{ticker}' not found in SEC EDGAR (only SEC-registered companies are supported).")
    cik, name, sec_ticker = found
    facts = sec_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")["facts"]

    currency = reporting_currency(facts)
    fy_ends = fiscal_year_ends(facts, currency)
    if not fy_ends:
        raise LookupError(f"No annual report data found in SEC XBRL filings for {sec_ticker}.")
    years = sorted(fy_ends)[-YEARS:]
    splits = split_events(facts, currency)

    series, sources = {}, {}
    for metric, (kind, candidates) in CONCEPTS.items():
        vals, used = [], []
        per_concept = [(c, annual_values(facts, tax, c, kind, currency)) for tax, c in candidates]
        for y in years:
            end = _d(fy_ends[y])
            v = None
            for concept, values in per_concept:
                # balance-sheet dates can differ by a few days from the P&L end (52/53-week years)
                match = next((values[e] for e in values if abs((_d(e) - end).days) <= 7), None)
                if match is not None:
                    v, filed = match
                    if metric in PER_SHARE:
                        for split_filed, factor in splits:
                            if filed < split_filed:
                                v = v * factor ** PER_SHARE[metric]
                    if concept not in used:
                        used.append(concept)
                    break
            vals.append(v)
        series[metric] = vals
        sources[metric] = used

    shares = latest_shares_outstanding(facts)
    try:
        sub = submissions(cik)
        history = filing_history(cik, f"{years[0]}-01-01", sub)
        marker = financial_marker(sub)
    except Exception:  # noqa: BLE001 - the financials are still useful without it
        history, marker = None, None

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
        if series["totalLiabilities"][i] is None and series["liabilitiesAndEquity"][i] is not None:
            eq_all = series["_equityInclNci"][i]
            if eq_all is None and series["equity"][i] is not None:
                eq_all = series["equity"][i] + (series["_minorityInterest"][i] or 0)
            if eq_all is not None:
                series["totalLiabilities"][i] = series["liabilitiesAndEquity"][i] - eq_all
        if series["dps"][i] is None and series["dividendsPaid"][i] is not None and series["dilutedShares"][i]:
            series["dps"][i] = round(series["dividendsPaid"][i] / series["dilutedShares"][i], 4)

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
        "_marker": marker,  # latest annual/quarterly report; kept in storage, removed from the response
        "sharesOutstanding": {"value": shares[2], "asOf": shares[0], "source": shares[3]} if shares else None,
        "secUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K",
    }


def api_response(ticker, now=time.time):
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

    def stale_or(status, body, cache):
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
    except (urllib.error.URLError, socket.timeout, TimeoutError):
        return stale_or(504, {"error": "SEC EDGAR took too long to respond. Please try again."}, CACHE_NONE)
    except Exception:  # noqa: BLE001
        log.exception("failed to build financials for %s", ticker)
        return stale_or(500, {"error": "Something went wrong while processing this company's filings."}, CACHE_NONE)

    ts = now()
    data["dataAsOf"] = datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds")  # last checked with SEC
    safe_set(key, {"fetchedTs": ts, "factsTs": facts_ts, "marker": marker, "data": data}, KEEP_SECONDS)
    return 200, data, CACHE_OK, source


def revalidate(stored):
    """Download only the filing list. If no annual or quarterly report has appeared since the stored figures,
    reuse them with a refreshed filing history; return None when a full refresh is needed."""
    d = stored["data"]
    sub = submissions(d["cik"])
    if financial_marker(sub) != stored["marker"]:
        return None
    since = (d.get("secHistory") or {}).get("since") or f"{d['years'][0]}-01-01"
    return {**d, "secHistory": filing_history(d["cik"], since, sub)}


store = store_module.from_environment(ssl_context=SSL_CTX)
