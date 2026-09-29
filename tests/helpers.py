"""Shared test helpers (plain functions; pytest fixtures live in conftest.py).

Tests never call SEC: `sec_fixtures` swaps stock_data.sec_get for a reader of the trimmed real
filings in tests/fixtures/, and `fake_sec` serves hand-built data for precise unit tests.
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
