"""End-to-end tests: drive the real page in Chromium against offline SEC fixtures."""
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


def flag_titles(page):
    return page.locator("#flags .title").all_inner_texts()


def check_row(page, name):
    """One row of the Graham/Buffett checklists, located by its criterion name."""
    return page.locator(".check").filter(has=page.locator(".name", has_text=name))


def test_search_shows_company_trends_and_charts(page, app_url, console_errors):
    page.goto(app_url)
    page.fill("#ticker", "aapl")
    page.click("#go")
    expect(page.locator("#coName")).to_have_text("Apple Inc. (AAPL)")
    expect(page.locator("#coMeta")).to_contain_text("Electronic Computers")
    expect(page.locator("#tiles .tile").first).to_contain_text("$416.2B")
    expect(page.locator("#tiles")).to_contain_text("Growing")
    expect(page).to_have_url(re.compile(r"\?t=AAPL$"))
    # all eight charts are drawn
    for chart_id in ("cRevenue", "cEps", "cDps", "cPayout", "cBalance", "cDebt", "cCash", "cMargin"):
        box = page.locator(f"#{chart_id}").bounding_box()
        assert box and box["height"] > 100, chart_id
    assert console_errors == []


def test_chips_load_a_company(page, app_url):
    page.goto(app_url)
    page.click(".chip[data-t=KO]")
    expect(page.locator("#coName")).to_have_text("COCA COLA CO (KO)")


def test_growth_table_compares_first_and_latest_year(open_ticker):
    page = open_ticker("AAPL")
    revenue = page.locator("#growthTable tr", has_text="Revenue")
    expect(revenue).to_contain_text("$215.6B")
    expect(revenue).to_contain_text("$416.2B")
    expect(revenue).to_contain_text("93.0%")
    expect(revenue).to_contain_text("7.6%")


def test_loss_making_company_is_described_in_words(open_ticker):
    page = open_ticker("INTC")
    expect(page.locator("#growthTable tr", has_text="Net income")).to_contain_text("From profit to loss")
    expect(page.locator("#growthTable tr", has_text="Dividend / share")).to_contain_text("Fell to zero")
    titles = flag_titles(page)
    assert any("Recent net losses" in t for t in titles)
    assert any("Dividend cut, then suspended" in t for t in titles)


def test_restatements_and_late_filings_are_flagged(open_ticker):
    page = open_ticker("SMCI")
    critical = page.locator(".flag.critical .title").all_inner_texts()
    assert any("Financial statements were restated" in t for t in critical)
    assert any("Late SEC filings" in t for t in critical)
    tiles = page.locator("#historyTiles .tile")
    expect(tiles.filter(has_text="Late filings")).to_contain_text("13")
    expect(tiles.filter(has_text="Restatement warnings")).to_contain_text("Serious")


def test_filing_history_filters_and_expands(open_ticker):
    page = open_ticker("SMCI")
    events = page.locator("#historyList .event")
    expect(events).to_have_count(10)                   # first ten shown
    page.click("#historyMore")
    expect(events).to_have_count(17)
    page.click("#historyFilters button[data-f=letters]")
    expect(page.locator("#historyList")).to_contain_text("No filings of this kind")
    page.click("#historyFilters button[data-f=flags]")
    expect(page.locator("#historyFilters button[data-f=flags]")).to_have_attribute("aria-pressed", "true")
    first_link = page.locator("#historyList .event a").first
    expect(first_link).to_have_attribute("href", re.compile(r"^https://www\.sec\.gov/Archives/edgar/data/1375365/"))


def test_clean_filer_gets_a_strength(open_ticker):
    page = open_ticker("KO")
    assert any("Clean filing record" in t for t in flag_titles(page))


def test_price_runs_valuation_tests_and_is_kept_in_the_url(open_ticker):
    page = open_ticker("KO")
    expect(check_row(page, "Moderate P/E")).to_contain_text("Needs price")
    page.fill("#price", "68")
    expect(check_row(page, "Moderate P/E")).to_contain_text("Not met")
    expect(check_row(page, "Moderate P/E")).to_contain_text("P/E 25.6")
    expect(check_row(page, "Margin of safety")).to_contain_text("Not met")
    expect(page.locator("#valueTiles")).to_contain_text("Price is")
    expect(page).to_have_url(re.compile(r"\?t=KO&p=68$"))


def test_price_from_link_is_applied_on_load(open_ticker):
    page = open_ticker("KO", price=68)
    expect(page.locator("#price")).to_have_value("68")
    expect(check_row(page, "Moderate P/E")).to_contain_text("P/E 25.6")


def test_new_search_clears_the_previous_price(open_ticker):
    page = open_ticker("KO", price=68)
    page.fill("#ticker", "AAPL")
    page.click("#go")
    expect(page.locator("#coName")).to_have_text("Apple Inc. (AAPL)")
    expect(page.locator("#price")).to_have_value("")


def test_checklist_scores_add_up(open_ticker):
    page = open_ticker("KO", price=68)
    expect(page.locator("#grahamScore")).to_contain_text("Meets 4 of 8")
    expect(page.locator("#buffettScore")).to_contain_text("Meets 6 of 7")


def test_bank_specific_rules_are_skipped(open_ticker):
    page = open_ticker("JPM")
    assert any("Looks like a bank" in t for t in flag_titles(page))
    expect(check_row(page, "Strong current position")).to_contain_text("N/A")
    expect(check_row(page, "Low capital needs")).to_contain_text("N/A")


def test_unknown_ticker_shows_a_friendly_error(page, app_url):
    page.goto(f"{app_url}/?t=ZZZZQ")
    expect(page.locator("#error")).to_be_visible()
    expect(page.locator("#error")).to_contain_text("not found in SEC EDGAR")
    expect(page.locator("#result")).to_be_hidden()


def test_invalid_input_is_rejected(page, app_url):
    page.goto(app_url)
    page.fill("#ticker", "<b>x")
    page.click("#go")
    expect(page.locator("#error")).to_contain_text("doesn't look like a ticker")
    expect(page.locator("#error b")).to_have_count(0)  # shown as text, never as HTML


def test_disclaimer_is_always_visible(page, app_url):
    page.goto(app_url)
    expect(page.locator(".disclaimer")).to_contain_text("Not investment advice")


def test_phone_layout_has_no_horizontal_scroll(page, open_ticker):
    page.set_viewport_size({"width": 375, "height": 812})
    open_ticker("AAPL")
    widths = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    assert widths[0] <= widths[1]
