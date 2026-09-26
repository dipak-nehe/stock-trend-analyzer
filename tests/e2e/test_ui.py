"""End-to-end tests: drive the real page in Chromium against offline SEC fixtures."""
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


def flag_titles(page):
    return page.locator("#flags .title").all_inner_texts()


def open_tab(page, name):
    page.click(f"#tab-{name}")
    expect(page.locator(f"#panel-{name}")).to_be_visible()


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
    open_tab(page, "charts")
    expect(page).to_have_url(re.compile(r"\?t=AAPL#charts$"))
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
    open_tab(page, "history")
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
    open_tab(page, "value")
    page.fill("#price", "68")
    expect(check_row(page, "Moderate P/E")).to_contain_text("Not met")
    expect(check_row(page, "Moderate P/E")).to_contain_text("P/E 25.6")
    expect(check_row(page, "Margin of safety")).to_contain_text("Not met")
    expect(page.locator("#valueTiles")).to_contain_text("Price is")
    expect(page).to_have_url(re.compile(r"\?t=KO&p=68#value$"))


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


def test_show_all_keeps_the_price_and_raises_no_errors(open_ticker, console_errors):
    # Regression: the "Show all" button shares the .chip style with the ticker buttons and used to
    # be wired as one, which cleared the price and threw a JavaScript error.
    page = open_ticker("SMCI", price=30)
    open_tab(page, "history")
    page.click("#historyMore")
    expect(page.locator("#historyList .event")).to_have_count(17)
    expect(page.locator("#price")).to_have_value("30")
    assert console_errors == []


def test_guide_explains_the_results_before_a_search(page, app_url):
    page.goto(app_url)
    guide = page.locator("#guide")
    expect(guide).to_have_attribute("open", "")
    # the guide's cards are named after the tabs, so the guide maps directly onto the results
    expect(guide.locator(".guide-item .gi-title")).to_have_text(["Overview", "Red flags", "SEC history", "Graham & Buffett-style analysis", "Charts", "Data"])
    expect(guide.locator(".how li")).to_have_count(3)                    # the three-step "how it works" strip
    expect(guide.locator(".guide-item .gi-go").first).to_be_visible()


def test_guide_collapses_after_a_search_and_can_be_reopened(open_ticker):
    page = open_ticker("KO")
    guide = page.locator("#guide")
    expect(guide).not_to_have_attribute("open", "")
    expect(guide.locator(".guide-grid")).to_be_hidden()
    page.click("#guide summary")
    expect(guide.locator(".guide-grid")).to_be_visible()


def test_each_tab_has_a_short_explanation(open_ticker):
    page = open_ticker("KO")
    for tab in ("overview", "flags", "history", "value", "charts", "data"):
        open_tab(page, tab)
        note = page.locator(f"#panel-{tab} .section-note").first
        expect(note).to_be_visible()
        assert 30 < len(note.inner_text()) < 260, tab  # a sentence or two, not a wall of text


# ---------- at a glance + tabs ----------

def test_glance_summarises_each_area_in_one_line(open_ticker):
    page = open_ticker("SMCI")
    rows = page.locator("#glance .glance-row")
    expect(rows).to_have_count(6)
    expect(rows.locator(".what")).to_have_text(["Revenue", "Earnings", "Dividend", "Red flags", "SEC record", "Graham & Buffett"])
    expect(rows.filter(has_text="Red flags")).to_contain_text("2 critical")
    expect(rows.filter(has_text="Red flags")).to_contain_text("Financial statements were restated")
    expect(rows.filter(has_text="SEC record")).to_contain_text("1 restatement · 3 auditor changes · 13 late filings")
    expect(rows.filter(has_text="Dividend")).to_contain_text("No dividend paid")


def test_glance_rows_open_their_tab(open_ticker):
    page = open_ticker("SMCI")
    page.locator("#glance .glance-row", has_text="SEC record").click()
    expect(page.locator("#tab-history")).to_have_attribute("aria-selected", "true")
    expect(page.locator("#panel-history")).to_be_visible()
    expect(page.locator("#panel-overview")).to_be_hidden()
    expect(page).to_have_url(re.compile(r"#history$"))


def test_clean_company_glance_and_badges(open_ticker):
    page = open_ticker("KO")
    expect(page.locator("#glance .glance-row", has_text="SEC record")).to_contain_text("Clean since 2016")
    expect(page.locator("#flagsBadge")).to_have_text("")
    expect(page.locator("#historyBadge")).to_have_text("")


def test_badges_count_serious_problems(open_ticker):
    page = open_ticker("SMCI")
    expect(page.locator("#flagsBadge")).to_have_text("2")
    expect(page.locator("#historyBadge")).to_have_text("17")


def test_link_with_a_tab_opens_that_tab(page, app_url):
    page.goto(f"{app_url}/?t=SMCI#flags")
    expect(page.locator("#panel-flags")).to_be_visible()
    expect(page.locator("#tab-flags")).to_have_attribute("aria-selected", "true")


def test_tabs_work_with_the_keyboard(open_ticker):
    page = open_ticker("KO")
    page.focus("#tab-overview")
    page.keyboard.press("ArrowRight")
    expect(page.locator("#tab-flags")).to_be_focused()
    expect(page.locator("#panel-flags")).to_be_visible()
    page.keyboard.press("End")
    expect(page.locator("#panel-data")).to_be_visible()
    page.keyboard.press("ArrowRight")  # wraps around
    expect(page.locator("#panel-overview")).to_be_visible()


def test_charts_are_drawn_only_when_their_tab_opens(open_ticker):
    page = open_ticker("AAPL")
    drawn = "() => [...document.querySelectorAll('#panel-charts canvas')].filter(c => Chart.getChart(c)).length"
    assert page.evaluate(drawn) == 0
    open_tab(page, "charts")
    assert page.evaluate(drawn) == 8


def test_new_search_stays_on_the_current_tab(open_ticker):
    page = open_ticker("KO")
    open_tab(page, "flags")
    page.fill("#ticker", "INTC")
    page.click("#go")
    expect(page.locator("#coName")).to_have_text("INTEL CORP (INTC)")
    expect(page.locator("#panel-flags")).to_be_visible()
    assert any("Recent net losses" in t for t in flag_titles(page))


def test_page_loads_nothing_from_other_sites(page, app_url):
    # Everything (including Chart.js) is served by the app itself, so a slow third-party site
    # can never block the page.
    requests = []
    page.on("request", lambda req: requests.append(req.url))
    page.goto(f"{app_url}/?t=AAPL#charts")
    page.locator("#panel-charts canvas").first.wait_for()
    outside = [u for u in requests if not u.startswith(app_url)]
    assert outside == []


def test_glance_has_a_title_and_hint(open_ticker):
    page = open_ticker("KO")
    expect(page.locator("#glanceTitle")).to_have_text("At a glance")
    expect(page.locator(".glance-head")).to_contain_text("Click any line for the details")


def test_previous_and_next_buttons_walk_through_the_tabs(open_ticker):
    page = open_ticker("KO")
    nav = page.locator("#panel-overview .panel-nav")
    expect(nav.locator("button")).to_have_text(["Next: Red flags →"])  # no "previous" on the first tab
    nav.locator("button.next").click()
    expect(page.locator("#panel-flags")).to_be_visible()
    expect(page.locator("#panel-flags .panel-nav button")).to_have_text(["← Overview", "Next: SEC history →"])
    page.locator("#panel-flags .panel-nav button.prev").click()
    expect(page.locator("#panel-overview")).to_be_visible()
    open_tab(page, "data")
    expect(page.locator("#panel-data .panel-nav button")).to_have_text(["← Charts"])  # no "next" on the last tab


def test_guide_card_before_a_search_shows_an_example_on_that_tab(page, app_url):
    page.goto(app_url)
    page.locator(".guide-item", has_text="Red flags").click()
    expect(page.locator("#coName")).to_have_text("Apple Inc. (AAPL)")
    expect(page.locator("#panel-flags")).to_be_visible()
    expect(page).to_have_url(re.compile(r"\?t=AAPL#flags$"))
    expect(page.locator(".guide-title")).to_have_text("How to read these results")


def test_guide_card_after_a_search_opens_its_tab_for_that_company(open_ticker):
    page = open_ticker("KO")
    page.click("#guide summary")
    page.locator('.guide-item[data-tab="value"]').click()
    expect(page.locator("#panel-value")).to_be_visible()
    expect(page.locator("#coName")).to_have_text("COCA COLA CO (KO)")   # stays on the searched company


def test_tabs_carry_the_same_icons_as_the_guide(page, app_url, open_ticker):
    page = open_ticker("KO")
    for tab in ("overview", "flags", "history", "value", "charts", "data"):
        expect(page.locator(f"#tab-{tab} use")).to_have_attribute("href", f"#i-{tab}")
        expect(page.locator(f'.guide-item[data-tab="{tab}"] use')).to_have_attribute("href", f"#i-{tab}")


# ---------- search box ----------

def test_search_box_has_a_visible_label_and_works_by_label(page, app_url):
    page.goto(app_url)
    box = page.get_by_label("Look up a company")
    expect(box).to_be_focused()                      # ready to type on arrival
    expect(box).to_have_attribute("placeholder", "Enter a ticker, e.g. AAPL")
    box.fill("ko")
    box.press("Enter")
    expect(page.locator("#coName")).to_have_text("COCA COLA CO (KO)")


def test_slash_jumps_to_search_but_not_while_typing_elsewhere(open_ticker):
    page = open_ticker("KO")
    open_tab(page, "value")
    page.fill("#price", "68")
    page.locator("#price").press("/")               # typing in another field: no jump
    expect(page.locator("#price")).to_be_focused()
    page.locator("body").click(position={"x": 5, "y": 5})
    page.keyboard.press("/")
    expect(page.locator("#ticker")).to_be_focused()
    assert page.evaluate("document.getElementById('ticker').selectionEnd") == 2  # existing text selected, ready to replace


# ---------- readability ----------

def test_previous_next_buttons_sit_at_the_bottom_of_every_tab(open_ticker):
    # Regression: on the Value and Charts tabs the buttons had ended up inside the price box / chart grid.
    page = open_ticker("KO")
    for tab in ("overview", "flags", "history", "value", "charts", "data"):
        is_last = page.evaluate(f"""() => {{
            const panel = document.getElementById('panel-{tab}');
            return panel.lastElementChild.classList.contains('panel-nav');
        }}""")
        assert is_last, tab


def test_red_flags_are_grouped_with_explanations(open_ticker):
    page = open_ticker("SMCI")
    open_tab(page, "flags")
    groups = page.locator("#flags .flag-group h3")
    expect(groups).to_have_count(2)
    expect(groups.nth(0)).to_contain_text("Needs attention")
    expect(groups.nth(1)).to_contain_text("Going well")
    first = page.locator("#flags .flag").first
    expect(first).to_contain_text("Financial statements were restated")
    expect(first.locator(".help")).to_contain_text("Why it matters:")


def test_trend_tiles_show_a_sparkline(open_ticker):
    page = open_ticker("AAPL")
    expect(page.locator("#tiles .tile svg.spark")).to_have_count(4)


def test_jargon_is_explained(open_ticker):
    page = open_ticker("KO")
    cagr = page.locator("#panel-overview abbr", has_text="CAGR").first
    expect(cagr).to_have_attribute("title", re.compile("Compound annual growth rate"))
    glossary = page.locator("#glossary")
    expect(glossary).to_be_visible()
    glossary.locator("summary").click()
    expect(glossary.locator("dt")).to_contain_text(["CAGR", "Free cash flow", "Graham Number"])


def test_checklist_scores_have_a_bar(open_ticker):
    page = open_ticker("KO", price=68)
    bar = page.locator("#grahamScore .meter")
    expect(bar).to_have_attribute("aria-label", "4 of 8 criteria met")
    assert page.evaluate("document.querySelector('#grahamScore .meter span').style.width") == "50%"


def test_value_tab_is_named_after_graham_and_buffett(open_ticker):
    page = open_ticker("KO")
    expect(page.locator("#tab-value")).to_have_text("Graham & Buffett")
    expect(page.locator("#panel-charts .panel-nav button.prev")).to_have_text("← Graham & Buffett")
    expect(page.locator("#valueNote")).to_contain_text("Not affiliated with or endorsed by")


def test_phone_tab_bar_keeps_the_active_tab_in_view(page, app_url):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{app_url}/?t=KO#value")
    page.locator("#panel-value").wait_for()
    bar, tab = page.locator("#tabs").bounding_box(), page.locator("#tab-value").bounding_box()
    assert tab["x"] >= bar["x"] and tab["x"] + tab["width"] <= bar["x"] + bar["width"] + 1
    expect(page.locator("#tabs")).to_have_class(re.compile("more-(left|right)"))  # fade hints at hidden tabs


def test_price_box_links_to_public_quote_pages(open_ticker):
    page = open_ticker("KO")
    open_tab(page, "value")
    links = page.locator("#priceLinks a")
    expect(links).to_have_text(["Google ↗", "Yahoo Finance ↗"])
    expect(links.nth(1)).to_have_attribute("href", "https://finance.yahoo.com/quote/KO/")
    expect(links.nth(0)).to_have_attribute("target", "_blank")


# ---------- Spanish ----------

def test_spanish_link_shows_the_whole_page_in_spanish(page, app_url):
    page.goto(f"{app_url}/?t=SMCI&lang=es")
    page.locator("#glance .glance-row").first.wait_for()
    expect(page.locator("html")).to_have_attribute("lang", "es")
    expect(page.get_by_label("Buscar una empresa")).to_be_visible()
    expect(page.locator("#glanceTitle")).to_have_text("De un vistazo")
    expect(page.locator("#tab-flags")).to_contain_text("Señales de alerta")
    expect(page.locator("#glance .glance-row", has_text="Historial SEC")).to_contain_text("13 presentaciones tardías")
    expect(page.locator("#tiles .tile").first).to_contain_text("39,1 mil M US$")     # Spain's number format
    expect(page.locator(".disclaimer")).to_contain_text("No es asesoramiento de inversión")
    open_tab(page, "flags")
    expect(page.locator("#flags .flag-group h3").first).to_contain_text("Requiere atención")
    expect(page.locator("#flags .flag").first).to_contain_text("Por qué importa:")


def test_spanish_browser_gets_spanish_automatically(browser, app_url):
    ctx = browser.new_context(locale="es-ES")
    page = ctx.new_page()
    page.goto(app_url)
    expect(page.locator(".lang-switch [data-lang=es]")).to_have_attribute("aria-pressed", "true")
    expect(page.locator(".search-label label")).to_have_text("Buscar una empresa")
    ctx.close()


def test_english_browser_gets_english(page, app_url):
    page.goto(app_url)
    expect(page.locator(".lang-switch [data-lang=en]")).to_have_attribute("aria-pressed", "true")
    expect(page.locator(".search-label label")).to_have_text("Look up a company")


def test_switching_language_keeps_tab_price_and_updates_the_link(open_ticker, console_errors):
    page = open_ticker("KO", price=68)
    open_tab(page, "value")
    page.click(".lang-switch [data-lang=es]")
    expect(page.locator("#tab-value")).to_have_text("Graham y Buffett")
    expect(page.locator("#panel-value")).to_be_visible()
    expect(page.locator("#price")).to_have_value("68")
    expect(check_row(page, "PER moderado")).to_contain_text("PER de 25,6")
    expect(page).to_have_url(re.compile(r"\?t=KO&p=68&lang=es#value$"))
    page.click(".lang-switch [data-lang=en]")                  # and back: the English is exactly restored
    expect(check_row(page, "Moderate P/E")).to_contain_text("P/E 25.6")
    expect(page.locator(".guide-intro")).to_contain_text("The tabs, and what each one shows.")
    expect(page).to_have_url(re.compile(r"\?t=KO&p=68#value$"))
    assert console_errors == []


def test_language_choice_is_remembered(page, app_url):
    page.goto(app_url)
    page.click(".lang-switch [data-lang=es]")
    page.goto(app_url)                                         # new visit, no ?lang in the link
    expect(page.locator(".search-label label")).to_have_text("Buscar una empresa")


def test_errors_are_translated(page, app_url):
    page.goto(f"{app_url}/?t=ZZZZQ&lang=es")
    expect(page.locator("#error")).to_contain_text("No se encuentra el ticker «ZZZZQ»")


def test_no_english_left_in_spanish_results(page, app_url):
    page.goto(f"{app_url}/?t=INTC&lang=es&p=24")
    page.locator("#glance .glance-row").first.wait_for()
    english = re.compile(r"\b(the|and|with|Revenue|Earnings|Needs|Why it matters|years? of|Price is|Not met|Show all)\b")
    allowed = ("INTEL CORP", "Semiconductors", "Stock Trend Analyzer", "Yahoo Finance", "Google")
    found = []
    for tab in ("overview", "flags", "history", "value", "charts", "data"):
        open_tab(page, tab)
        for line in page.inner_text("main").splitlines():
            if english.search(line) and not any(a in line for a in allowed):
                found.append(f"{tab}: {line.strip()[:80]}")
    assert found == []


def test_analytics_script_is_not_loaded_locally(page, app_url):
    # Vercel Web Analytics only exists on the deployed site; locally it must not load (or count visits).
    requests = []
    page.on("request", lambda req: requests.append(req.url))
    page.goto(f"{app_url}/?t=KO")
    page.locator("#glance .glance-row").first.wait_for()
    assert not [u for u in requests if "/_vercel/insights" in u]
    expect(page.locator("footer")).to_contain_text("no cookies, no personal data")


def test_company_header_says_when_the_data_was_fetched(open_ticker):
    page = open_ticker("KO")
    expect(page.locator("#coAsOf")).to_contain_text("Data from SEC as of")
    expect(page.locator("#staleNote")).to_be_hidden()
    page.click(".lang-switch [data-lang=es]")
    expect(page.locator("#coAsOf")).to_contain_text("Datos de la SEC a")


def test_saved_copy_notice_when_sec_is_unreachable(page, app_url):
    stale = {"ticker": "KO", "name": "COCA COLA CO", "cik": 21344, "currency": "USD", "years": [2024, 2025],
             "periodEnds": ["2024-12-31", "2025-12-31"], "splits": [], "secHistory": None, "sharesOutstanding": None,
             "secUrl": "https://www.sec.gov/x", "dataAsOf": "2026-09-20T10:00:00+00:00", "stale": True,
             "series": {k: [1e9, 1.1e9] for k in ["revenue", "netIncome", "operatingIncome", "grossProfit", "eps", "dps",
                        "dividendsPaid", "operatingCashFlow", "capex", "interestExpense", "dilutedShares", "totalAssets",
                        "totalLiabilities", "equity", "liabilitiesAndEquity", "currentAssets", "currentLiabilities", "cash",
                        "goodwill", "receivables", "inventory", "totalDebt", "longTermDebt"]}}
    page.route("**/api/financials*", lambda route: route.fulfill(status=200, json=stale))
    page.goto(f"{app_url}/?t=KO")
    expect(page.locator("#staleNote")).to_be_visible()
    expect(page.locator("#staleNote")).to_contain_text("SEC couldn't be reached")


def test_guide_toggle_looks_and_reads_like_a_control(open_ticker):
    page = open_ticker("KO")                                       # guide is collapsed after a search
    summary = page.locator("#guide summary")
    expect(summary.locator(".when-closed")).to_be_visible()
    expect(summary.locator(".when-closed")).to_have_text("Show guide")
    assert summary.evaluate("el => getComputedStyle(el).cursor") == "pointer"
    summary.focus()
    page.keyboard.press("Enter")                                   # opens with the keyboard
    expect(page.locator("#guide")).to_have_attribute("open", "")
    expect(summary.locator(".when-open")).to_have_text("Hide")
    page.click(".lang-switch [data-lang=es]")
    expect(summary.locator(".when-open")).to_have_text("Ocultar")
