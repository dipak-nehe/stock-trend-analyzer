"""Shared pytest fixtures.

Tests never call SEC: `sec_fixtures` swaps stock_data.sec_get for a reader of the trimmed real
filings in tests/fixtures/. The business-rule tests are behave scenarios in tests/features, with the same
isolation set up in tests/features/environment.py.
"""
import allure
import pytest
from helpers import FIXTURE_TODAY, _not_found, fixture_sec_get, fixture_sec_get_text

from backend import stock_data, store

# Group tests in the Allure report by layer (the report's "Suites" view).
LAYERS = {
    "test_store": "1 · Unit: data rules",  # the behave scenarios (tests/features) join this group too
    "test_regression": "2 · Regression: real SEC filings",
    "test_server": "3 · HTTP: API and static files",
}
# The browser tests (Playwright, e2e/) name their own groups, 4 and 5, in e2e/fixtures.ts.


@pytest.fixture(autouse=True)
def _allure_layer(request):
    layer = LAYERS.get(request.module.__name__.rsplit(".", 1)[-1])
    if layer:
        allure.dynamic.parent_suite(layer)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """No test downloads a document from SEC, and "today" is the saved filings' date (the insider window)."""
    def refuse(url):
        raise _not_found(url)
    monkeypatch.setattr(stock_data, "sec_get_text", refuse)
    monkeypatch.setenv("STOCK_DATA_TODAY", FIXTURE_TODAY)


@pytest.fixture(autouse=True)
def fresh_store(monkeypatch):
    """Every test starts with an empty in-memory store, so nothing stored by one test answers another."""
    mem = store.MemoryStore()
    monkeypatch.setattr(stock_data, "store", mem)
    return mem


@pytest.fixture
def sec_fixtures(monkeypatch):
    """Real (trimmed) SEC data for AAPL, KO, INTC, JPM and SMCI, served offline."""
    monkeypatch.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    monkeypatch.setattr(stock_data, "sec_get", fixture_sec_get)
    monkeypatch.setattr(stock_data, "sec_get_text", fixture_sec_get_text)
