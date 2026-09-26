"""Shared pytest fixtures.

Tests never call SEC: `sec_fixtures` swaps stock_data.sec_get for a reader of the trimmed real
filings in tests/fixtures/, and `fake_sec` serves hand-built data for precise unit tests.
"""
import pytest

import stock_data
from helpers import _not_found, fixture_sec_get


@pytest.fixture
def sec_fixtures(monkeypatch):
    """Real (trimmed) SEC data for AAPL, KO, INTC, JPM and SMCI, served offline."""
    monkeypatch.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    monkeypatch.setattr(stock_data, "sec_get", fixture_sec_get)


@pytest.fixture
def fake_sec(monkeypatch):
    """Serve hand-built company facts for ticker TEST (CIK 1).

    Usage: fake_sec(us_gaap={...}, ifrs={...}, dei={...}, submissions={...}); returns the setter.
    """
    monkeypatch.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    state = {}

    def install(us_gaap=None, ifrs=None, dei=None, submissions=None, pages=None):
        facts = {}
        if us_gaap:
            facts["us-gaap"] = us_gaap
        if ifrs:
            facts["ifrs-full"] = ifrs
        if dei:
            facts["dei"] = dei
        state["facts"] = {"cik": 1, "entityName": "Test Co", "facts": facts}
        state["submissions"] = submissions or {"filings": {"recent": {k: [] for k in
                                               ("accessionNumber", "filingDate", "form", "items", "primaryDocument")}}}
        state["pages"] = pages or {}
        state["calls"] = []

    def sec_get(url):
        state["calls"].append(url)
        if url.endswith("/company_tickers.json"):
            return {"0": {"cik_str": 1, "ticker": "TEST", "title": "Test Co"},
                    "1": {"cik_str": 2, "ticker": "BRK-B", "title": "Berkshire"}}
        if url.endswith("companyfacts/CIK0000000001.json"):
            return state["facts"]
        if url.endswith("submissions/CIK0000000001.json"):
            return state["submissions"]
        for name, page in state["pages"].items():
            if url.endswith(name):
                return page
        raise _not_found(url)

    monkeypatch.setattr(stock_data, "sec_get", sec_get)
    install.state = state
    return install
