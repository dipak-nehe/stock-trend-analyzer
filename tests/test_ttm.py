"""Latest-twelve-months figures from quarterly reports: last fiscal year + this year's year-to-date - the same
stretch a year earlier. Hand-built facts, so each rule is checked on its own."""
from backend import stock_data, xbrl
from tests.helpers import concept, fact


def facts(*rows):
    return {"us-gaap": {"Revenues": concept(list(rows))}}


FY25 = fact(1000, "2025-12-31", "2025-01-01", filed="2026-02-15")
H1_25 = fact(500, "2025-06-30", "2025-01-01", form="10-Q", filed="2025-08-01")
H1_26 = fact(600, "2026-06-30", "2026-01-01", form="10-Q", filed="2026-08-01")


def ttm(*rows):
    return xbrl.trailing_twelve_months(facts(*rows), "us-gaap", "Revenues", "USD")


def test_last_year_plus_this_years_quarters_less_the_same_quarters_a_year_earlier():
    assert ttm(FY25, H1_25, H1_26) == (1100, "2026-06-30")  # 1000 + 600 - 500


def test_nothing_without_a_quarterly_report_newer_than_the_annual_report():
    assert ttm(FY25) is None
    assert ttm(FY25, H1_25) is None  # last year's half-year is older than the annual report


def test_the_newest_year_to_date_wins():
    q1_25 = fact(240, "2025-03-31", "2025-01-01", form="10-Q", filed="2025-05-01")
    q1_26 = fact(300, "2026-03-31", "2026-01-01", form="10-Q", filed="2026-05-01")
    assert ttm(FY25, q1_25, q1_26, H1_25, H1_26) == (1100, "2026-06-30")  # the half-year, not the first quarter


def test_a_restated_comparison_figure_is_used():
    restated = fact(520, "2025-06-30", "2025-01-01", form="10-Q", filed="2026-08-01")  # last year's half, restated
    assert ttm(FY25, H1_25, restated, H1_26) == (1080, "2026-06-30")


def test_only_figures_newer_than_the_last_annual_report_are_returned_rounded():
    eps = {"us-gaap": {
        "Revenues": concept([FY25, H1_25, H1_26]),
        "EarningsPerShareDiluted": concept([
            fact(1.1, "2025-12-31", "2025-01-01", filed="2026-02-15"),
            fact(0.5, "2025-06-30", "2025-01-01", form="10-Q", filed="2025-08-01"),
            fact(0.7, "2026-06-30", "2026-01-01", form="10-Q", filed="2026-08-01"),
        ], unit="USD/shares"),
    }}
    out = stock_data._with_ttm(eps, "USD", "2025-12-31")["ttm"]
    assert out == {"asOf": "2026-06-30", "values": {"revenue": 1100, "eps": 1.3}}  # 1.1 + 0.7 - 0.5, without float noise
    assert stock_data._with_ttm(eps, "USD", "2026-06-30") == {}  # nothing newer than that annual report
