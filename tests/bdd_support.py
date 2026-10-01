"""Shared helpers for the behave steps in tests/features/steps (no step definitions here, so importing this from
several step files doesn't register any step twice)."""
from helpers import FakeSec, year

from backend import stock_data

YEARS = list(range(2016, 2026))  # a fixed decade, so expectations don't change with the calendar


def company(context):
    """The fake SEC data for this scenario's company TEST, created on first use: SEC is swapped for it until the
    scenario ends."""
    if not hasattr(context, "sec"):
        context.sec = FakeSec()
        context.us_gaap, context.ifrs, context.dei = {}, {}, {}
        context.patches.attr(stock_data, "sec_get", context.sec.sec_get)
        context.patches.env("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    return context


def add_facts(context, tag, rows, unit="USD", taxonomy="us_gaap"):
    """Add XBRL facts for one tag, keeping any rows already given for it."""
    facts = getattr(company(context), taxonomy)
    facts.setdefault(tag, {"units": {}})["units"].setdefault(unit, []).extend(rows)


def split_filings(old, new):
    """EPS-style values for 2019 reported as `old` in the 2020 filing and restated as `new` in 2021 (after a split).
    2016-2018 are only ever reported before the split."""
    return [
        *[year(y, old, filed=f"{y + 1}-02-15") for y in (2016, 2017, 2018)],
        year(2019, old, filed="2020-02-15"),
        year(2019, new, filed="2021-02-15"),
        *[year(y, new, filed=f"{y + 1}-02-15") for y in range(2020, 2026)],
    ]
