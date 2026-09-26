"""Accessibility tests: axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practices) on every state of the page,
in light and dark mode, English and Spanish, desktop and phone width; plus keyboard-only checks."""
import json

import allure
import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import expect

pytestmark = [pytest.mark.e2e, pytest.mark.a11y]

AXE = Axe()
WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
TABS = ["overview", "flags", "history", "value", "charts", "data"]


def violations(page):
    """Run axe and return a short, readable list of violations (full details go to the Allure report)."""
    result = AXE.run(page, options={"runOnly": {"type": "tag", "values": WCAG}})
    found = result.response["violations"]
    if found:
        allure.attach(json.dumps(found, indent=2), name="axe violations", attachment_type=allure.attachment_type.JSON)
    return [f"[{v['impact']}] {v['id']}: {v['help']} → {', '.join(n['target'][0] for n in v['nodes'][:3])}" for v in found]


def load(page, app_url, path, width=1100, scheme="light"):
    page.emulate_media(color_scheme=scheme)
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    if "t=" in path and "ZZZZQ" not in path:
        page.locator("#glance .glance-row").first.wait_for()
    return page


@pytest.mark.parametrize("scheme", ["light", "dark"])
@pytest.mark.parametrize("width", [1100, 375], ids=["desktop", "phone"])
def test_landing_page(page, app_url, scheme, width):
    load(page, app_url, "/", width, scheme)
    assert violations(page) == []


@pytest.mark.parametrize("scheme", ["light", "dark"])
@pytest.mark.parametrize("tab", TABS)
def test_every_results_tab(page, app_url, tab, scheme):
    # SMCI with a price exercises the most states: critical flags, filing history, every checklist status
    load(page, app_url, "/?t=SMCI&p=30", scheme=scheme)
    page.click(f"#tab-{tab}")
    if tab == "data":
        page.click("#glossary summary")
    assert violations(page) == []


@pytest.mark.parametrize("tab", ["overview", "data"])
def test_phone_width_results(page, app_url, tab):
    load(page, app_url, "/?t=KO", width=375)
    page.click(f"#tab-{tab}")
    assert violations(page) == []


def test_spanish_page(page, app_url):
    load(page, app_url, "/?t=JPM&lang=es")
    assert violations(page) == []


def test_error_state(page, app_url):
    load(page, app_url, "/?t=ZZZZQ")
    expect(page.locator("#error")).to_be_visible()
    assert violations(page) == []


def test_guide_before_and_after_a_search(page, app_url):
    load(page, app_url, "/")
    assert violations(page) == []
    page.locator('.guide-item[data-tab="history"]').click()        # loads the example on that tab
    page.locator("#panel-history").wait_for()
    page.click("#guide summary")                                   # reopen the guide over the results
    assert violations(page) == []


# ---------- keyboard only ----------

def test_search_and_results_work_with_the_keyboard(page, app_url):
    page.goto(app_url)
    expect(page.locator("#ticker")).to_be_focused()
    page.keyboard.type("ko")
    page.keyboard.press("Enter")
    page.locator("#glance .glance-row").first.wait_for()
    first_row = page.locator("#glance .glance-row").first
    first_row.focus()
    page.keyboard.press("Enter")                                   # a glance line opens its tab
    expect(page.locator("#panel-overview")).to_be_visible()
    page.locator("#tab-overview").focus()
    page.keyboard.press("ArrowRight")
    expect(page.locator("#panel-flags")).to_be_visible()


def test_wide_tables_can_be_scrolled_with_the_keyboard(page, app_url):
    load(page, app_url, "/?t=KO", width=375)
    page.click("#tab-data")
    region = page.locator("#panel-data .table-wrap")
    expect(region).to_have_attribute("tabindex", "0")
    assert region.evaluate("el => el.scrollWidth > el.clientWidth"), "table should overflow at phone width"
    region.focus()
    expect(region).to_be_focused()
    for _ in range(3):
        page.keyboard.press("ArrowRight")
    page.wait_for_function("el => el.scrollLeft > 0", arg=region.element_handle(), timeout=3000)  # smooth scrolling


def test_every_interactive_element_has_a_name(page, app_url):
    load(page, app_url, "/?t=SMCI")
    unnamed = page.evaluate("""() => [...document.querySelectorAll('button, a[href], input, [role=tab]')]
        .filter(el => el.offsetParent !== null)
        .filter(el => !(el.getAttribute('aria-label') || el.labels?.length || el.textContent.trim() || el.title))
        .map(el => el.outerHTML.slice(0, 80))""")
    assert unnamed == []
