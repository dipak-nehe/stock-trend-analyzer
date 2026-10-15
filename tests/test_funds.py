"""Funds (backend/funds.py, /api/fund): figures read from real (trimmed) SEC shareholder reports, offline."""
import os

import pytest

from backend import funds

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def report(name):
    with open(os.path.join(FIX, name), "rb") as fh:
        return fh.read()


VANGUARD = "fund_000110465926021519.xml"    # Vanguard Index Funds: 16 funds, one report
FIDELITY = "fund_000081911826000065.xml"    # Fidelity tags returns and indexes its own way


def test_a_share_class_gets_its_costs_returns_and_portfolio():
    voo = funds.parse_report(report(VANGUARD), "C000092055")   # 500 Index Fund, ETF Shares (VOO)
    assert (voo["fund"], voo["shareClass"]) == ("500 Index Fund", "ETF Shares")
    assert voo["expenseRatio"] == pytest.approx(0.0003)
    assert voo["costPer10k"] == 3
    assert voo["returns"] == {"1": 0.1782, "5": 0.1438, "10": 0.1478}   # its NAV return, not the market price's 17.84%
    assert voo["periodEnd"] == "2025-12-31"
    assert voo["netAssets"] == 1480375000000 and voo["holdings"] == 517 and voo["turnover"] == 0.02
    assert voo["breakdown"]["by"] == "IndustrySector"
    assert voo["breakdown"]["rows"][0] == ["Information Technology", 0.344]


def test_classes_of_one_fund_share_the_portfolio_but_not_the_costs():
    vfiax = funds.parse_report(report(VANGUARD), "C000007774")  # Admiral Shares of the same fund
    voo = funds.parse_report(report(VANGUARD), "C000092055")
    assert vfiax["expenseRatio"] == pytest.approx(0.0004) and voo["expenseRatio"] == pytest.approx(0.0003)
    assert vfiax["holdings"] == voo["holdings"] and vfiax["breakdown"] == voo["breakdown"]


def test_the_indexes_come_from_the_class_own_section_only():
    # The report covers 16 funds; an S&P 500 fund is set against the S&P 500 (its own index) and the broad market
    voo = funds.parse_report(report(VANGUARD), "C000092055")
    assert [(i["kind"], i["name"]) for i in voo["indexes"]] == [
        ("additional", "S&P 500 Index"), ("broad", "Dow Jones U.S. Total Stock Market Float Adjusted Index")]
    assert voo["indexes"][0]["returns"] == {"1": 0.1788, "5": 0.1442, "10": 0.1482}


def test_fidelity_own_returns_and_per_period_indexes_are_read_correctly():
    fxaix = funds.parse_report(report(FIDELITY), "C000100045")
    assert fxaix["returns"] == {"1": 0.1698, "5": 0.1418, "10": 0.1549}   # tagged as an "additional index"
    assert fxaix["indexes"] == [{"name": "", "kind": "broad", "returns": {"1": 0.1699, "5": 0.1419, "10": 0.155}}]
    assert fxaix["topHoldings"] == {"count": 10, "pct": 0.369}             # names aren't shown: only the share


def test_a_class_with_a_sales_charge_shows_its_returns_before_the_charge_and_keeps_the_after():
    # American Funds tags the returns before the 5.75% charge, and leaves the ones after it untagged
    agthx = funds.parse_report(report("fund_000119312525260203.xml"), "C000025064")
    assert agthx["returns"] == {"1": 0.2326, "5": 0.1322, "10": 0.1505}
    assert agthx["returnsAfterSalesCharge"] == {"1": 0.1618, "5": 0.1189, "10": 0.1437}


def test_an_etf_shows_its_nav_return_not_its_market_price_and_has_no_sales_charge():
    # Vanguard tags an ETF's market-price returns "without sales load" and leaves the NAV returns untagged
    bnd = funds.parse_report(report("fund_000110465926021506.xml"), "C000046844")
    assert bnd["returns"] == {"1": 0.0711, "5": -0.004, "10": 0.02}       # market price: 7.08%, -0.44%, 1.98%
    assert bnd["returnsAfterSalesCharge"] is None


def test_a_class_not_in_the_report_is_none():
    assert funds.parse_report(report(VANGUARD), "C999999999") is None


@pytest.mark.parametrize("start,end,years", [("2025-01-01", "2025-12-31", 1), ("2021-01-01", "2025-12-31", 5),
                                             ("2016-01-01", "2025-12-31", 10), ("2025-02-28", "2026-02-28", 1),
                                             ("2019-06-01", "2025-12-31", None)])
def test_return_periods_are_recognised_as_1_5_or_10_years(start, end, years):
    assert funds._years(start, end) == years


def test_the_endpoint_answers_from_the_saved_reports_and_stores_the_result(sec_fixtures):
    status, body, cache, source = funds.fund_response("voo")
    assert status == 200 and source == "MISS" and "s-maxage" in cache
    assert body["ticker"] == "VOO" and body["form"] == "N-CSR" and body["classId"] == "C000092055"
    assert funds.fund_response("VOO")[3] == "HIT"


def test_a_semi_annual_report_has_costs_but_no_returns(sec_fixtures):
    status, body, *_ = funds.fund_response("QQQ")
    assert status == 200 and body["form"] == "N-CSRS"
    assert body["expenseRatio"] == pytest.approx(0.0019) and body["returns"] == {}


@pytest.mark.parametrize("ticker,status,text", [("SPY", 404, "isn't in SEC's list"), ("bad ticker!", 400, "doesn't look like"),
                                                ("", 400, "doesn't look like")])
def test_unknown_or_malformed_tickers_get_a_clear_error(sec_fixtures, ticker, status, text):
    got, body, cache, _ = funds.fund_response(ticker)
    assert got == status and text in body["error"]


def test_a_fund_without_a_shareholder_report_is_not_covered(sec_fixtures, monkeypatch):
    monkeypatch.setattr(funds, "latest_report", lambda series: None)
    status, body, *_ = funds.fund_response("VOO")
    assert status == 404 and "doesn't file" in body["error"]


def test_sec_down_serves_the_stored_copy_marked_stale(sec_fixtures, monkeypatch):
    funds.fund_response("VOO")
    monkeypatch.setattr(funds, "FRESH_SECONDS", -1)
    monkeypatch.setattr(funds, "build_fund", lambda t: (_ for _ in ()).throw(OSError("down")))
    status, body, cache, source = funds.fund_response("VOO")
    assert status == 200 and body["stale"] is True and source == "STALE" and cache == "no-store"


# ---------- top holdings (Form N-PORT) ----------

def test_top_ten_holdings_add_up_share_classes_and_leave_out_derivatives_and_cash():
    top = funds.top_holdings(report("nport_000003640526000473.xml"))    # VOO's holdings report
    assert top["asOf"] == "2026-06-30"
    names = [r["name"] for r in top["rows"]]
    assert names[:4] == ["NVIDIA Corp", "Apple Inc", "Alphabet Inc", "Microsoft Corp"]
    assert top["rows"][2] == {"name": "Alphabet Inc", "pct": 5.84, "securities": 2}   # class A + class C
    assert len(top["rows"]) == 10 and top["pct"] == pytest.approx(sum(r["pct"] for r in top["rows"]), abs=0.02)
    assert not any("Liquidity" in n or "FUT" in n or n == "N/A" for n in names)       # cash collateral, futures


def test_a_bond_fund_adds_up_each_issuer_bonds():
    top = funds.top_holdings(report("nport_000079410526000276.xml"))    # BND (saved: its 40 largest lines)
    assert top["rows"][0]["name"] == "United States Treasury Note/Bond" and top["rows"][0]["securities"] == 39


@pytest.mark.parametrize("raw,shown", [("NVIDIA CORP", "Nvidia Corp"), ("ELI LILLY and CO", "Eli Lilly and Co"),
                                       ("HSBC HOLDINGS PLC", "HSBC Holdings PLC"), ("Coca-Cola Co/The", "Coca-Cola Co"),
                                       ("UNITED STATES TREASURY NOTE/BOND", "United States Treasury Note/Bond"),
                                       ("Micron Technology, Inc.", "Micron Technology, Inc.")])
def test_holding_names_read_as_people_write_them(raw, shown):
    assert funds.holding_name(raw) == shown


def test_the_fund_carries_its_top_ten_and_still_shows_without_them(sec_fixtures, monkeypatch):
    body = funds.fund_response("SCHD")[1]
    assert body["topTen"]["rows"][0] == {"name": "QUALCOMM Inc", "pct": 6.74, "securities": 1}
    funds.sd.safe_set(f"{funds.CACHE_VERSION}:fund:SCHD", None, 1)
    monkeypatch.setattr(funds, "latest_nport", lambda series: (_ for _ in ()).throw(OSError("down")))
    monkeypatch.setattr(funds.sd, "store", None)
    status, body, *_ = funds.fund_response("SCHD")
    assert status == 200 and body["topTen"] is None and body["expenseRatio"] == pytest.approx(0.0006)


# ---------- growth of $10,000 and overlap ----------

def test_the_growth_chart_is_the_fund_line_and_its_own_index_from_its_section():
    voo = funds.parse_report(report(VANGUARD), "C000092055")
    assert tuple(voo["growth"]["fund"][0]) == ("2015-12-31", 10000.0)
    assert tuple(voo["growth"]["fund"][-1]) == ("2025-12-31", 39690.0)
    assert voo["growth"]["index"]["name"] == "S&P 500 Index" and tuple(voo["growth"]["index"]["points"][-1]) == ("2025-12-31", 39827.0)
    assert len(voo["growth"]["fund"]) == 41                                       # quarterly points


def test_fidelity_dates_its_chart_points_by_the_year_in_the_name():
    fxaix = funds.parse_report(report(FIDELITY), "C000100045")
    assert [d for d, _ in fxaix["growth"]["fund"]][:2] == ["2016-02-28", "2017-02-28"]
    assert tuple(fxaix["growth"]["fund"][-1]) == ("2026-02-28", 42201.0)


def test_holdings_carry_their_weights_by_issuer_for_overlap():
    top = funds.top_holdings(report("nport_000003640526000473.xml"))
    weights = {w[0]: w for w in top["weights"]}
    assert weights["02079K"][2] == "Alphabet Inc" and weights["02079K"][1] == pytest.approx(5.84, abs=0.005)  # A + C: one issuer
    assert len(top["weights"]) <= funds.OVERLAP_HOLDINGS


def test_a_chart_that_contradicts_the_reported_returns_is_not_shown():
    # American Funds tagged AGTHX's chart values against the wrong dates: its line would end at $23,893, while its
    # own 10-year return (14.37% a year after the charge) puts the end near $38,300
    agthx = funds.parse_report(report("fund_000119312525260203.xml"), "C000025064")
    assert agthx["growth"] == {"fund": None, "index": None, "inconsistent": True}


@pytest.mark.parametrize("points,rates,ok", [
    ([("2015-12-31", 10000), ("2025-12-31", 39690)], [0.1478], True),
    ([("2015-08-31", 9425), ("2025-08-31", 38304)], [0.1505, 0.1437], True),      # charge taken at the start
    ([("2015-08-31", 9425), ("2025-08-31", 23893)], [0.1505, 0.1437], False),
    ([("2021-12-31", 10000), ("2025-12-31", 15000)], [0.1478], True),             # not ten years: nothing to check
    ([("2015-12-31", 10000), ("2025-12-31", 99999)], [], True)])
def test_the_ten_year_check(points, rates, ok):
    assert funds._consistent(points, rates) is ok
