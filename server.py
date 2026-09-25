"""Stock Trend Analyzer - tiny backend.

Pulls up to 10 years of annual (10-K / 20-F / 40-F) financials for a ticker
from SEC EDGAR's free XBRL API and serves them, plus the one-page UI.

Run:  python3 server.py   then open http://localhost:8000
No third-party packages needed.
"""
import json
import os
import ssl
import time
import urllib.error
import urllib.request
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", "8000"))
# SEC asks every client to identify itself with a contact in the User-Agent.
# Set SEC_USER_AGENT="YourApp your-email@domain.com" before running.
USER_AGENT = os.environ.get("SEC_USER_AGENT", "StockTrendAnalyzer/1.0 admin@example.com")
YEARS = 10
HERE = os.path.dirname(os.path.abspath(__file__))

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
    "longTermDebt": ("instant", [
        ("us-gaap", "LongTermDebt"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"),
        ("us-gaap", "DebtLongtermAndShorttermCombinedAmount"),
        ("us-gaap", "LongTermDebtNoncurrent"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligations"),
        ("ifrs-full", "NoncurrentPortionOfNoncurrentBorrowings"),
        ("ifrs-full", "Borrowings"),
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
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _cache[url] = (time.time(), data)
    return data


def lookup_cik(ticker):
    t = ticker.strip().upper().replace(".", "-").replace("/", "-")
    for row in sec_get("https://www.sec.gov/files/company_tickers.json").values():
        if row["ticker"].upper() == t:
            return row["cik_str"], row["title"], row["ticker"]
    return None


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

    # Derived fallbacks
    for i in range(len(years)):
        if series["totalLiabilities"][i] is None and series["liabilitiesAndEquity"][i] is not None \
                and series["equity"][i] is not None:
            series["totalLiabilities"][i] = series["liabilitiesAndEquity"][i] - series["equity"][i]
        if series["dps"][i] is None and series["dividendsPaid"][i] is not None and series["dilutedShares"][i]:
            series["dps"][i] = round(series["dividendsPaid"][i] / series["dilutedShares"][i], 4)

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
        "secUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K",
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in ("/", "/index.html"):
            with open(os.path.join(HERE, "index.html"), "rb") as fh:
                return self._send(200, fh.read(), "text/html")
        if url.path == "/api/financials":
            ticker = (parse_qs(url.query).get("ticker") or [""])[0].strip()
            if not ticker:
                return self._send(400, json.dumps({"error": "Please provide a ticker."}))
            try:
                return self._send(200, json.dumps(build_financials(ticker)))
            except LookupError as e:
                return self._send(404, json.dumps({"error": str(e)}))
            except urllib.error.HTTPError as e:
                return self._send(502, json.dumps({"error": f"SEC EDGAR returned HTTP {e.code}. Try again shortly."}))
            except Exception as e:  # noqa: BLE001
                return self._send(500, json.dumps({"error": f"Unexpected error: {e}"}))
        self._send(404, json.dumps({"error": "Not found"}))

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        if e.errno not in (48, 98):  # EADDRINUSE on macOS / Linux
            raise
        raise SystemExit(f"Port {PORT} is already in use. Stop the other server (lsof -iTCP:{PORT} -sTCP:LISTEN) "
                         f"or pick another port: PORT=8001 python3 server.py")
    print(f"Stock Trend Analyzer running at http://localhost:{PORT}")
    httpd.serve_forever()
