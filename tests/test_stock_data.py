"""Unit tests for the SEC data layer, using small hand-built filings."""
import socket
import urllib.error

import pytest

import stock_data
from helpers import REAL_SEC_GET, concept, fact, net_income_years, year

YEARS = list(range(2016, 2026))  # a fixed decade so expectations don't change with the calendar; the app uses the latest 10 filed years


def build(fake_sec, **tags):
    """Build financials for TEST from us-gaap tags; net income for 2016-2025 defines the years."""
    us_gaap = {"NetIncomeLoss": net_income_years(YEARS)}
    us_gaap.update(tags)
    fake_sec(us_gaap=us_gaap)
    return stock_data.build_financials("TEST")


def by_year(result, metric):
    return dict(zip(result["years"], result["series"][metric]))


# ---------- picking the right annual value ----------

def test_latest_filing_wins_so_restated_values_are_used(fake_sec):
    revenue = concept([
        year(2020, 1000, filed="2021-02-01"),
        year(2020, 950, filed="2022-02-01"),  # restated in the next annual report
    ])
    assert by_year(build(fake_sec, Revenues=revenue), "revenue")[2020] == 950


def test_quarterly_periods_and_quarterly_reports_are_ignored(fake_sec):
    revenue = concept([
        year(2020, 1000),
        fact(300, "2020-12-31", "2020-10-01"),                # Q4 figure inside the 10-K
        fact(4000, "2020-12-31", "2020-01-01", form="10-Q"),  # wrong form
    ])
    assert by_year(build(fake_sec, Revenues=revenue), "revenue")[2020] == 1000


def test_falls_back_through_alternative_tags_year_by_year(fake_sec):
    # Apple-style: SalesRevenueNet until 2017, then the newer revenue tag
    result = build(fake_sec,
                   SalesRevenueNet=concept([year(y, 10 * y) for y in (2016, 2017)]),
                   RevenueFromContractWithCustomerExcludingAssessedTax=concept([year(y, 10 * y) for y in range(2018, 2026)]))
    assert None not in result["series"]["revenue"]
    assert set(result["sources"]["revenue"]) == {"RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"}


# ---------- stock splits ----------

def split_filings(old, new, unit="USD/shares"):
    """EPS for 2019 reported as `old` in the 2020 filing and restated as `new` a year later (after a split).
    2016-2018 are only ever reported before the split."""
    return concept([
        *[year(y, old, filed=f"{y + 1}-02-15") for y in (2016, 2017, 2018)],
        year(2019, old, filed="2020-02-15"),
        year(2019, new, filed="2021-02-15"),
        *[year(y, new, filed=f"{y + 1}-02-15") for y in range(2020, 2026)],
    ], unit)


def test_forward_split_adjusts_older_per_share_values(fake_sec):
    shares = concept([year(y, 1000 if y < 2019 else 4000, filed=f"{y + 1}-02-15") for y in YEARS], "shares")
    result = build(fake_sec, EarningsPerShareDiluted=split_filings(12.0, 3.0),
                   CommonStockDividendsPerShareDeclared=split_filings(4.0, 1.0),
                   WeightedAverageNumberOfDilutedSharesOutstanding=shares)
    assert result["splits"] == [{"detectedInFiling": "2021-02-15", "ratio": 4}]
    eps, dps, sh = by_year(result, "eps"), by_year(result, "dps"), by_year(result, "dilutedShares")
    assert eps[2016] == pytest.approx(3.0) and eps[2025] == pytest.approx(3.0)
    assert dps[2017] == pytest.approx(1.0)
    assert sh[2016] == 4000  # share counts scale the other way


def test_reverse_split_is_detected(fake_sec):
    result = build(fake_sec, EarningsPerShareDiluted=split_filings(1.0, 8.0))
    assert result["splits"][0]["ratio"] == pytest.approx(0.125)
    assert by_year(result, "eps")[2016] == pytest.approx(8.0)


def test_small_restatement_is_not_mistaken_for_a_split(fake_sec):
    result = build(fake_sec, EarningsPerShareDiluted=split_filings(2.00, 1.90))
    assert result["splits"] == []
    assert by_year(result, "eps")[2016] == pytest.approx(2.00)


# ---------- currency ----------

def test_foreign_filer_is_pinned_to_its_reporting_currency(fake_sec):
    twd = [year(y, 1_000_000 + y, form="20-F") for y in YEARS]
    usd = [year(2025, 33_000, form="20-F")]  # convenience translation of the latest year only
    fake_sec(ifrs={"ProfitLoss": {"units": {"TWD": twd, "USD": usd}},
                   "Revenue": {"units": {"TWD": twd, "USD": usd}}})
    result = stock_data.build_financials("TEST")
    assert result["currency"] == "TWD"
    assert by_year(result, "revenue")[2025] == 1_002_025


# ---------- total liabilities ----------

BALANCE = {"LiabilitiesAndStockholdersEquity": concept([year(y, 100, instant=True) for y in YEARS]),
           "StockholdersEquity": concept([year(y, 30, instant=True) for y in YEARS])}


def test_reported_total_liabilities_are_used_as_is(fake_sec):
    result = build(fake_sec, **BALANCE, Liabilities=concept([year(y, 55, instant=True) for y in YEARS]))
    assert set(result["series"]["totalLiabilities"]) == {55}


def test_derived_liabilities_exclude_minority_interest(fake_sec):
    # Minority owners' stakes (10) are equity, not liabilities: 100 - (30 + 10) = 60
    nci = concept([year(y, 40, instant=True) for y in YEARS])
    result = build(fake_sec, **BALANCE, StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest=nci)
    assert set(result["series"]["totalLiabilities"]) == {60}


def test_derived_liabilities_use_minority_interest_tag_as_fallback(fake_sec):
    result = build(fake_sec, **BALANCE, MinorityInterest=concept([year(y, 10, instant=True) for y in YEARS]))
    assert set(result["series"]["totalLiabilities"]) == {60}


def test_derived_liabilities_without_minority_interest(fake_sec):
    assert set(build(fake_sec, **BALANCE)["series"]["totalLiabilities"]) == {70}


# ---------- debt ----------

def test_debt_stays_consistent_when_the_company_switches_tags(fake_sec):
    # 2016-2020: only non-current + current parts reported; 2021+: total long-term debt reported
    result = build(fake_sec,
                   LongTermDebtNoncurrent=concept([year(y, 90, instant=True) for y in YEARS]),
                   LongTermDebtCurrent=concept([year(y, 10, instant=True) for y in YEARS]),
                   LongTermDebt=concept([year(y, 100, instant=True) for y in range(2021, 2026)]))
    assert set(result["series"]["totalDebt"]) == {100}      # no fake jump in 2021
    assert set(result["series"]["longTermDebt"]) == {90}    # non-current only, every year


def test_long_term_debt_is_derived_when_only_the_total_is_reported(fake_sec):
    result = build(fake_sec, LongTermDebt=concept([year(y, 100, instant=True) for y in YEARS]),
                   LongTermDebtCurrent=concept([year(y, 15, instant=True) for y in YEARS]))
    assert set(result["series"]["longTermDebt"]) == {85}


def test_short_term_borrowings_are_not_double_counted_with_commercial_paper(fake_sec):
    # ShortTermBorrowings (20) already includes commercial paper (15)
    result = build(fake_sec, LongTermDebt=concept([year(y, 100, instant=True) for y in YEARS]),
                   ShortTermBorrowings=concept([year(y, 20, instant=True) for y in YEARS]),
                   CommercialPaper=concept([year(y, 15, instant=True) for y in YEARS]))
    assert set(result["series"]["totalDebt"]) == {120}


def test_internal_building_blocks_are_not_returned(fake_sec):
    result = build(fake_sec)
    assert not [k for k in result["series"] if k.startswith("_")]


# ---------- dividends ----------

def test_dividend_per_share_falls_back_to_dividends_paid(fake_sec):
    result = build(fake_sec,
                   PaymentsOfDividends=concept([year(y, 0 if y == 2025 else 50) for y in YEARS]),
                   WeightedAverageNumberOfDilutedSharesOutstanding=concept([year(y, 100) for y in YEARS], "shares"))
    dps = by_year(result, "dps")
    assert dps[2024] == 0.5
    assert dps[2025] == 0  # a suspended dividend is zero, not missing


# ---------- shares outstanding ----------

def test_shares_outstanding_sums_share_classes_from_the_latest_filing(fake_sec):
    rows = [fact(500, "2025-06-30", form="10-Q", filed="2025-08-01", accn="A"),
            fact(300, "2025-06-30", form="10-Q", filed="2025-08-01", accn="A"),  # class B, same filing
            fact(700, "2024-06-30", form="10-Q", filed="2024-08-01", accn="B")]
    fake_sec(us_gaap={"NetIncomeLoss": net_income_years(YEARS)},
             dei={"EntityCommonStockSharesOutstanding": concept(rows, "shares")})
    shares = stock_data.build_financials("TEST")["sharesOutstanding"]
    assert shares["value"] == 800 and shares["asOf"] == "2025-06-30"


# ---------- SEC filing history ----------

@pytest.mark.parametrize("form, items, expected", [
    ("8-K", "4.02,9.01", "non_reliance"),
    ("8-K/A", "4.01", "auditor_change"),
    ("8-K", "2.02,9.01", None),
    ("NT 10-K", "", "late_filing"),
    ("NT 10-Q", "", "late_filing"),
    ("10-K/A", "", "amendment"),
    ("20-F/A", "", "amendment"),
    ("UPLOAD", "", "sec_letter"),
    ("CORRESP", "", "company_response"),
    ("10-K", "", None),
    ("4", "", None),
])
def test_filing_classification(form, items, expected):
    result = stock_data._classify_filing(form, items)
    assert (result[0] if result else None) == expected


def submissions(rows):
    cols = ("accessionNumber", "filingDate", "form", "items", "primaryDocument")
    return {k: [r[i] for r in rows] for i, k in enumerate(cols)}


def test_filing_history_window_links_and_older_pages(fake_sec):
    recent = submissions([
        ("0001-24-000001", "2024-05-01", "NT 10-Q", "", "nt.htm"),
        ("0001-23-000002", "2023-03-01", "8-K", "4.01", "auditor.htm"),
        ("0001-23-000003", "2023-01-01", "4", "", "form4.xml"),
    ])
    old_page = submissions([
        ("0001-18-000004", "2018-11-15", "8-K", "4.02", "restate.htm"),
        ("0001-09-000005", "2009-01-01", "UPLOAD", "", "letter.pdf"),  # before the window
    ])
    fake_sec(us_gaap={"NetIncomeLoss": net_income_years(YEARS)},
             submissions={"sicDescription": "Widgets", "filings": {"recent": recent, "files": [
                 {"name": "CIK0000000001-submissions-001.json", "filingFrom": "2009-01-01", "filingTo": "2019-12-31"},
                 {"name": "CIK0000000001-submissions-002.json", "filingFrom": "1995-01-01", "filingTo": "2008-12-31"},
             ]}},
             pages={"CIK0000000001-submissions-001.json": {**old_page}})
    history = stock_data.filing_history(1, "2016-01-01")
    assert [e["type"] for e in history["events"]] == ["late_filing", "auditor_change", "non_reliance"]  # newest first
    assert history["counts"] == {"late_filing": 1, "auditor_change": 1, "non_reliance": 1}
    assert history["industry"] == "Widgets"
    assert history["events"][0]["url"] == "https://www.sec.gov/Archives/edgar/data/1/000124000001/nt.htm"
    calls = fake_sec.state["calls"]
    assert not any("submissions-002" in c for c in calls), "pages entirely before the window must not be fetched"


def test_financials_still_load_when_filing_history_fails(fake_sec, monkeypatch):
    fake_sec(us_gaap={"NetIncomeLoss": net_income_years(YEARS)})
    monkeypatch.setattr(stock_data, "filing_history", lambda *a: (_ for _ in ()).throw(TimeoutError()))
    result = stock_data.build_financials("TEST")
    assert result["secHistory"] is None and result["years"][-1] == 2025


# ---------- API layer: validation, errors, caching ----------

def test_lookup_accepts_class_share_tickers_with_a_dot(fake_sec):
    fake_sec(us_gaap={})
    assert stock_data.lookup_cik("brk.b") == (2, "Berkshire", "BRK-B")


@pytest.mark.parametrize("ticker, status", [("", 400), ("   ", 400), ("<script>", 400), ("TOOLONGTICKER1", 400),
                                            ("NOPE", 404)])
def test_bad_or_unknown_tickers(fake_sec, ticker, status):
    fake_sec(us_gaap={"NetIncomeLoss": net_income_years(YEARS)})
    code, body, cache = stock_data.api_response(ticker)
    assert code == status and "error" in body
    assert cache == (stock_data.CACHE_NOT_FOUND if status == 404 else stock_data.CACHE_NONE)


def test_success_is_cached_on_the_cdn_only(fake_sec):
    fake_sec(us_gaap={"NetIncomeLoss": net_income_years(YEARS)})
    code, body, cache = stock_data.api_response("test")
    assert code == 200 and body["ticker"] == "TEST"
    assert "s-maxage=86400" in cache and "max-age=0" in cache  # browsers always revalidate


@pytest.mark.parametrize("exc, status, text", [
    (urllib.error.HTTPError("u", 403, "Forbidden", {}, None), 502, "limiting requests"),
    (urllib.error.HTTPError("u", 429, "Too Many", {}, None), 502, "limiting requests"),
    (urllib.error.HTTPError("u", 500, "Error", {}, None), 502, "HTTP 500"),
    (urllib.error.URLError("down"), 504, "too long"),
    (socket.timeout(), 504, "too long"),
    (ValueError("boom"), 500, "Something went wrong"),
])
def test_sec_failures_become_friendly_uncached_errors(monkeypatch, exc, status, text):
    monkeypatch.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")

    def failing(url):
        raise exc
    monkeypatch.setattr(stock_data, "sec_get", failing)
    code, body, cache = stock_data.api_response("AAPL")
    assert code == status and text in body["error"] and cache == stock_data.CACHE_NONE
    assert "boom" not in body["error"]  # internal details never leak


@pytest.mark.parametrize("value", [None, "", "NoEmailHere"])
def test_sec_contact_is_required(monkeypatch, value):
    if value is None:
        monkeypatch.delenv("SEC_USER_AGENT", raising=False)
    else:
        monkeypatch.setenv("SEC_USER_AGENT", value)
    monkeypatch.setattr(stock_data, "_cache", {})
    monkeypatch.setattr(stock_data, "sec_get", REAL_SEC_GET)  # fails on the contact check before any network call
    code, body, _ = stock_data.api_response("AAPL")
    assert code == 500 and "SEC_USER_AGENT" in body["error"]
