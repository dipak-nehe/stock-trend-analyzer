"""Regression tests on real (trimmed) SEC filings.

Expected values were cross-checked against a public financial data site (stockanalysis.com) and the
companies' own 10-K filings for fiscal 2021-2025. If a code change breaks accuracy, these fail.
Figures are in millions unless noted.
"""
import pytest

from backend import stock_data

FY = [2021, 2022, 2023, 2024, 2025]  # the years the saved filings were verified for (not relative to today)

EXPECTED = {
    "AAPL": {
        "revenue": [365817, 394328, 383285, 391035, 416161],
        "netIncome": [94680, 99803, 96995, 93736, 112010],
        "operatingCashFlow": [104038, 122151, 110543, 118254, 111482],
        "capex": [11085, 10708, 10959, 9447, 12715],
        "totalAssets": [351002, 352755, 352583, 364980, 359241],
        "totalLiabilities": [287912, 302083, 290437, 308030, 285508],
        "equity": [63090, 50672, 62146, 56950, 73733],
        "cash": [34940, 23646, 29965, 29943, 35934],
        "longTermDebt": [109106, 98959, 95281, 85750, 78328],
    },
    "KO": {
        "revenue": [38655, 43004, 45754, 47061, 47941],
        "netIncome": [9771, 9542, 10714, 10631, 13107],
        "operatingCashFlow": [12625, 11018, 11599, 6805, 7408],
        "totalAssets": [94354, 92763, 97703, 100549, 104816],
        "totalLiabilities": [69494, 66937, 70223, 74177, 70541],
        "equity": [22999, 24105, 25941, 24856, 32169],
        "cash": [9684, 9519, 9366, 10828, 10270],
    },
    "INTC": {
        "revenue": [79024, 63054, 54228, 53101, 52853],
        "netIncome": [19868, 8014, 1689, -18756, -267],
        "operatingCashFlow": [29456, 15433, 11471, 8288, 9697],
        "totalAssets": [168406, 182103, 191572, 196485, 211429],
        "totalLiabilities": [73015, 78817, 81607, 91453, 85069],
        "equity": [95391, 101423, 105590, 99270, 114281],
        "cash": [4827, 11144, 7079, 8249, 14265],
        "longTermDebt": [33510, 37684, 46978, 46282, 44086],
    },
    "JPM": {
        "operatingCashFlow": [78084, 107119, 12974, -42012, -147782],
        "totalAssets": [3743567, 3665743, 3875393, 4002814, 4424900],
        "totalLiabilities": [3449440, 3373411, 3547515, 3658056, 4062462],
        "equity": [294127, 292332, 327878, 344758, 362438],
    },
}

PER_SHARE = {
    "AAPL": {"eps": [5.61, 6.11, 6.13, 6.08, 7.46], "dps": [0.85, 0.90, 0.94, 0.98, 1.02]},
    "KO": {"eps": [2.25, 2.19, 2.47, 2.46, 3.04], "dps": [1.68, 1.76, 1.84, 1.94, 2.04]},
    "INTC": {"eps": [4.86, 1.94, 0.40, -4.38, -0.06], "dps": [1.38, 1.46, 0.74, 0.375, 0.0]},
    "JPM": {"eps": [15.36, 12.09, 16.23, 19.75, 20.02], "dps": [3.80, 4.00, 4.10, 4.80, 5.80]},
}

_cache = {}


@pytest.fixture
def company(sec_fixtures):
    def get(ticker):
        if ticker not in _cache:
            _cache[ticker] = stock_data.build_financials(ticker)
        return _cache[ticker]
    return get


def values(result, metric, scale=1e6, digits=0):
    by_year = dict(zip(result["years"], result["series"][metric]))
    return [None if by_year.get(y) is None else round(by_year[y] / scale, digits) for y in FY]


@pytest.mark.parametrize("ticker, metric", [(t, m) for t, ms in EXPECTED.items() for m in ms])
def test_statement_figures_match_published_values(company, ticker, metric):
    assert values(company(ticker), metric) == EXPECTED[ticker][metric]


@pytest.mark.parametrize("ticker, metric", [(t, m) for t, ms in PER_SHARE.items() for m in ms])
def test_per_share_figures_match_published_values(company, ticker, metric):
    got = values(company(ticker), metric, scale=1, digits=3)
    assert got == pytest.approx(PER_SHARE[ticker][metric], abs=0.006)


def test_apple_history_is_split_adjusted(company):
    aapl = company("AAPL")
    assert [s["ratio"] for s in aapl["splits"]] == [7, 4]
    eps = dict(zip(aapl["years"], aapl["series"]["eps"]))
    assert eps[2016] == pytest.approx(2.08, abs=0.01)  # $8.31 as originally reported, before the 2020 4-for-1 split


def test_apple_debt_has_no_jump_when_its_tags_change(company):
    # Apple reports total long-term debt only from fiscal 2022; before that only the parts
    debt = company("AAPL")["series"]["totalDebt"]
    changes = [abs(b / a - 1) for a, b in zip(debt, debt[1:])]
    assert max(changes) < 0.35


def test_intel_minority_interest_is_not_counted_as_a_liability(company):
    intc = company("INTC")
    s = intc["series"]
    # assets = liabilities + parent equity + ~$12B of minority interest (Mobileye etc.)
    minority = s["totalAssets"][-1] - s["totalLiabilities"][-1] - s["equity"][-1]
    assert 11e9 < minority < 13e9


def test_currency_and_fiscal_years(company):
    for t in EXPECTED:
        r = company(t)
        assert r["currency"] == "USD" and len(r["years"]) == 10


def test_smci_filing_history(company):
    h = company("SMCI")["secHistory"]
    assert h["counts"]["late_filing"] == 13
    assert h["counts"]["auditor_change"] == 3
    assert h["counts"]["non_reliance"] == 1
    assert h["industry"] == "Electronic Computers"


def test_clean_filers_have_no_red_flag_filings(company):
    for t in ("KO", "INTC"):
        counts = company(t)["secHistory"]["counts"]
        assert not {"non_reliance", "auditor_change", "late_filing"} & counts.keys(), t
