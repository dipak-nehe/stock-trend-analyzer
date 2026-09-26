"""End-to-end tests for the compare page: the link from a result, loading both sides, URL state, marks and languages."""
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


def open_compare(page, app_url, query):
    page.goto(f"{app_url}/compare.html?{query}")
    if "b=" in query:
        page.locator("#cmpResult").wait_for(state="visible")
    return page


def figure_row(page, label):
    return page.locator("#cmpTable tbody tr").filter(has=page.locator("th", has_text=label))


def test_compare_link_appears_only_after_a_result(page, app_url):
    page.goto(app_url)
    expect(page.locator("#compareLink")).to_be_hidden()
    page.fill("#ticker", "KO")
    page.click("#go")
    link = page.locator("#compareLink")
    expect(link).to_be_visible()
    expect(link).to_have_attribute("href", "compare.html?a=KO")


def test_compare_link_opens_with_first_stock_loaded(page, app_url, console_errors):
    page.goto(f"{app_url}/?t=KO")
    page.click("#compareLink")
    expect(page).to_have_url(re.compile(r"/compare\.html\?a=KO$"))
    expect(page.locator("#tickerA")).to_have_value("KO")
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    expect(page.locator("#cmpEmpty")).to_be_visible()
    expect(page.locator("#cmpResult")).to_be_hidden()
    expect(page.locator("#tickerB")).to_be_focused()
    expect(page.locator("#backLink")).to_have_attribute("href", "index.html?t=KO")
    assert console_errors == []


def test_second_stock_is_fetched_and_compared(page, app_url, console_errors):
    open_compare(page, app_url, "a=KO")
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    page.fill("#tickerB", "aapl")
    page.click("#goB")
    expect(page.locator("#cmpResult")).to_be_visible()
    expect(page).to_have_url(re.compile(r"\?a=KO&b=AAPL$"))
    expect(page).to_have_title("KO vs AAPL · Stock Trend Analyzer")
    expect(page.locator("#cmpCards .cmp-card")).to_have_count(2)
    expect(page.locator("#cmpCards")).to_contain_text("Apple Inc. (AAPL)")
    expect(page.locator("#cmpTable thead")).to_contain_text("KO")
    expect(page.locator("#cmpTable thead")).to_contain_text("AAPL")
    expect(figure_row(page, "Revenue (latest year)")).to_contain_text("$416.2B")
    # both growth charts are drawn
    for chart_id in ("cmpRevenue", "cmpEps"):
        box = page.locator(f"#{chart_id}").bounding_box()
        assert box and box["height"] > 100, chart_id
    expect(page.locator("#cmpGrid tbody tr").filter(has_text="Benjamin Graham")).to_have_count(1)
    assert console_errors == []


def test_chip_loads_the_second_stock(page, app_url):
    open_compare(page, app_url, "a=KO")
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    page.click(".chip[data-b=INTC]")
    expect(page.locator("#cmpResult")).to_be_visible()
    expect(page).to_have_url(re.compile(r"b=INTC"))


def test_marks_follow_direction_and_sizes_get_none(page, app_url):
    open_compare(page, app_url, "a=KO&b=INTC")
    # a size measure is never marked
    expect(figure_row(page, "Revenue (latest year)").locator(".fav-dot")).to_have_count(0)
    # exactly one side is marked on net margin, and screen readers hear it
    margin = figure_row(page, "Net margin (latest)")
    expect(margin.locator(".fav-dot")).to_have_count(1)
    expect(margin.locator(".sr-only")).to_have_text("(more favourable)")
    # KO is profitable and INTC is loss-making, so KO (first column) gets the mark
    expect(margin.locator("td").nth(0).locator(".fav-dot")).to_have_count(1)


def test_valuation_rows_need_prices(page, app_url):
    open_compare(page, app_url, "a=KO&b=AAPL")
    expect(page.locator("#cmpTable")).not_to_contain_text("Valuation")
    page.fill("#priceA", "60")
    pe = figure_row(page, "P/E on 3-year average EPS")
    expect(pe).to_contain_text("add a price")
    expect(pe.locator(".fav-dot")).to_have_count(0)
    expect(page).to_have_url(re.compile(r"pa=60"))
    page.fill("#priceB", "200")
    expect(pe).not_to_contain_text("add a price")
    expect(pe.locator(".fav-dot")).to_have_count(1)
    expect(page).to_have_url(re.compile(r"pa=60&pb=200"))


def test_deep_link_with_prices_restores_everything(page, app_url):
    open_compare(page, app_url, "a=KO&b=AAPL&pa=60&pb=200")
    expect(page.locator("#priceA")).to_have_value("60")
    expect(page.locator("#priceB")).to_have_value("200")
    expect(figure_row(page, "Price to book").locator("td").first).not_to_have_text("add a price")


def test_swap_switches_sides_and_prices(page, app_url):
    open_compare(page, app_url, "a=KO&b=AAPL&pa=60")
    page.click("#swap")
    expect(page).to_have_url(re.compile(r"\?a=AAPL&b=KO&pb=60$"))
    expect(page.locator("#tickerA")).to_have_value("AAPL")
    expect(page.locator("#priceB")).to_have_value("60")
    expect(page.locator("#cmpTable thead th").nth(1)).to_have_text("AAPL")


def test_same_ticker_is_rejected(page, app_url):
    open_compare(page, app_url, "a=KO")
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    page.fill("#tickerB", "ko")
    page.click("#goB")
    expect(page.locator("#statusB")).to_contain_text("same company")
    expect(page.locator("#cmpResult")).to_be_hidden()


def test_unknown_second_ticker_keeps_the_first(page, app_url):
    open_compare(page, app_url, "a=KO")
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    page.fill("#tickerB", "ZZZZQ")
    page.click("#goB")
    expect(page.locator("#statusB")).to_have_class(re.compile("error-text"))
    expect(page.locator("#statusA")).to_have_text("COCA COLA CO (KO)")
    expect(page.locator("#cmpResult")).to_be_hidden()
    expect(page).to_have_url(re.compile(r"\?a=KO$"))


def test_language_carries_over_and_switches(page, app_url, console_errors):
    page.goto(f"{app_url}/?t=KO&lang=es")
    link = page.locator("#compareLink")
    expect(link).to_have_text("Comparar con otra acción →")
    expect(link).to_have_attribute("href", "compare.html?a=KO&lang=es")
    link.click()
    page.fill("#tickerB", "AAPL")
    page.click("#goB")
    expect(page.locator("#cmpResult")).to_be_visible()
    expect(page.locator("#goB")).to_have_text("Comparar")
    expect(page.locator("#cmpTable")).to_contain_text("Deuda / patrimonio")
    expect(page).to_have_url(re.compile(r"lang=es"))
    page.click(".lang-switch [data-lang=en]")
    expect(page.locator("#cmpTable")).to_contain_text("Debt / equity")
    expect(page).not_to_have_url(re.compile(r"lang="))
    assert console_errors == []


def test_bank_shows_na_for_current_ratio(page, app_url):
    open_compare(page, app_url, "a=JPM&b=KO")
    row = figure_row(page, "Current ratio")
    expect(row.locator("td").first).to_have_text("n/a")
    expect(row.locator(".fav-dot")).to_have_count(0)


def test_phone_width_has_no_sideways_scroll(page, app_url):
    page.set_viewport_size({"width": 375, "height": 800})
    open_compare(page, app_url, "a=KO&b=AAPL")
    assert page.evaluate("document.documentElement.scrollWidth") <= 375
