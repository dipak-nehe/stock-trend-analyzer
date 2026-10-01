"""Shared test helpers (plain functions; pytest fixtures live in conftest.py).

Tests never call SEC: `sec_fixtures` swaps stock_data.sec_get for a reader of the trimmed real
filings in tests/fixtures/, and `FakeSec` serves hand-built data for the behave scenarios (tests/features).
"""
import json
import os
import re
import sys
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from backend import stock_data  # noqa: E402

REAL_SEC_GET = stock_data.sec_get  # captured before any test swaps it out

FIXTURES = os.path.join(ROOT, "tests", "fixtures")


def _not_found(url):
    return urllib.error.HTTPError(url, 404, "Not Found", {}, None)


FIXTURE_TODAY = "2026-09-26"  # "today" for tests on the saved filings (see tests/make_fixtures.py)


def _form4_fixture(cik):
    path = os.path.join(FIXTURES, f"form4_{cik}.json")
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        return json.load(fh)


def fixture_sec_get_text(url):
    """Stand-in for stock_data.sec_get_text: a Form 4's (trimmed) XML from tests/fixtures/form4_<cik>.json."""
    m = re.search(r"/Archives/edgar/data/(\d+)/(\d{10})(\d{2})(\d{6})/", url)
    saved = _form4_fixture(int(m.group(1))) if m else None
    accession = f"{m.group(2)}-{m.group(3)}-{m.group(4)}" if m else ""
    if not saved or accession not in saved["documents"]:
        raise _not_found(url)
    return saved["documents"][accession]


def fixture_sec_get(url):
    """Stand-in for stock_data.sec_get that reads tests/fixtures/ instead of the network."""
    if url.endswith("/company_tickers.json"):
        name = "company_tickers.json"
    elif m := re.search(r"companyfacts/CIK(\d{10})\.json$", url):
        name = f"companyfacts_{int(m.group(1))}.json"
    elif m := re.search(r"submissions/CIK(\d{10})\.json$", url):
        name = f"submissions_{int(m.group(1))}.json"
    else:
        raise _not_found(url)
    path = os.path.join(FIXTURES, name)
    if not os.path.exists(path):
        raise _not_found(url)
    with open(path) as fh:
        data = json.load(fh)
    if name.startswith("submissions_"):
        # The saved filing lists predate the insider fixtures: add the saved Form 4 rows to them.
        form4 = _form4_fixture(int(m.group(1)))
        if form4:
            recent = data["filings"]["recent"]
            for row in form4["filings"]:
                for k in recent:
                    recent[k].append(row.get(k, ""))
    return data


# ---------- builders for hand-made SEC data ----------

def fact(val, end, start=None, form="10-K", filed=None, accn=None):
    """One XBRL fact. Omit `start` for balance-sheet (instant) values."""
    filed = filed or f"{int(end[:4]) + 1}-02-15"
    row = {"end": end, "val": val, "form": form, "filed": filed, "accn": accn or f"0000000001-{filed[2:4]}-000001"}
    if start:
        row["start"] = start
    return row


def year(y, val, instant=False, **kw):
    """A full fiscal-year (calendar) fact for year `y`."""
    return fact(val, f"{y}-12-31", None if instant else f"{y}-01-01", **kw)


def concept(rows, unit="USD"):
    return {"units": {unit: rows}}


def net_income_years(years, val=100):
    """Net income for each year: it defines the fiscal years build_financials analyses."""
    return concept([year(y, val) for y in years])


class FakeSec:
    """Hand-built company facts for ticker TEST (CIK 1), served in place of stock_data.sec_get.

    install(us_gaap={...}, ifrs={...}, dei={...}, submissions={...}, pages={...}) sets what SEC "returns";
    `calls` records every URL asked for. The ticker list also holds BRK-B (CIK 2) for class-share lookups.
    """

    def __init__(self):
        self.install()

    def install(self, us_gaap=None, ifrs=None, dei=None, submissions=None, pages=None):
        facts = {}
        if us_gaap:
            facts["us-gaap"] = us_gaap
        if ifrs:
            facts["ifrs-full"] = ifrs
        if dei:
            facts["dei"] = dei
        self.facts = {"cik": 1, "entityName": "Test Co", "facts": facts}
        self.submissions = submissions or {"filings": {"recent": {k: [] for k in
                                           ("accessionNumber", "filingDate", "form", "items", "primaryDocument")}}}
        self.pages = pages or {}
        self.calls = []

    def sec_get(self, url):
        self.calls.append(url)
        if url.endswith("/company_tickers.json"):
            return {"0": {"cik_str": 1, "ticker": "TEST", "title": "Test Co"},
                    "1": {"cik_str": 2, "ticker": "BRK-B", "title": "Berkshire"}}
        if url.endswith("companyfacts/CIK0000000001.json"):
            return self.facts
        if url.endswith("submissions/CIK0000000001.json"):
            return self.submissions
        for name, page in self.pages.items():
            if url.endswith(name):
                return page
        raise _not_found(url)


def submission_rows(rows):
    """A filing list's columns from (accession, filed, form, items, document) rows."""
    cols = ("accessionNumber", "filingDate", "form", "items", "primaryDocument")
    return {k: [r[i] for r in rows] for i, k in enumerate(cols)}


# ---------- builders for hand-made Form 4 filings ----------

def form4(issuer="1", owner="Doe Jane", rel="<isOfficer>1</isOfficer><officerTitle>CEO</officerTitle>", planned="0",
          lines=()):
    """A minimal Form 4: lines are (code, date, shares, price, acquired/disposed)."""
    txs = "".join(
        f"<nonDerivativeTransaction><transactionDate><value>{d}</value></transactionDate>"
        f"<transactionCoding><transactionCode>{code}</transactionCode></transactionCoding>"
        f"<transactionAmounts><transactionShares><value>{shares}</value></transactionShares>"
        f"<transactionPricePerShare><value>{price}</value></transactionPricePerShare>"
        f"<transactionAcquiredDisposedCode><value>{ad}</value></transactionAcquiredDisposedCode></transactionAmounts>"
        f"</nonDerivativeTransaction>" for code, d, shares, price, ad in lines)
    return (f"<ownershipDocument><issuer><issuerCik>{int(issuer):010d}</issuerCik></issuer>"
            f"<reportingOwner><reportingOwnerId><rptOwnerName>{owner}</rptOwnerName></reportingOwnerId>"
            f"<reportingOwnerRelationship>{rel}</reportingOwnerRelationship></reportingOwner>"
            f"<aff10b5One>{planned}</aff10b5One><nonDerivativeTable>{txs}</nonDerivativeTable></ownershipDocument>")


def form4_filings(*rows):
    """A submissions index with Form 4 rows: (accession, filed[, form])."""
    cols = {k: [] for k in ("accessionNumber", "filingDate", "form", "items", "primaryDocument")}
    for row in rows:
        accession, filed, form = (*row, "4")[:3]
        for k, v in (("accessionNumber", accession), ("filingDate", filed), ("form", form), ("items", ""),
                     ("primaryDocument", "xslF345X06/form4.xml")):
            cols[k].append(v)
    return {"filings": {"recent": cols}}
