"""End-to-end setup: run the real local server on a free port, with SEC replaced by offline fixtures."""
import contextlib
import threading

import allure
import pytest
from helpers import fixture_sec_get

import server
from backend import stock_data, store


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Attach a full-page screenshot to the Allure report when a browser test fails."""
    outcome = yield
    report = outcome.get_result()
    page = item.funcargs.get("page")
    if report.when == "call" and report.failed and page is not None:
        with contextlib.suppress(Exception):  # a screenshot must never hide the real failure
            allure.attach(page.screenshot(full_page=True), name="screenshot on failure", attachment_type=allure.attachment_type.PNG)


@pytest.fixture(scope="session")
def app_url():
    mp = pytest.MonkeyPatch()
    mp.setenv("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    mp.setattr(stock_data, "sec_get", fixture_sec_get)
    mp.setattr(stock_data, "store", store.MemoryStore())
    mp.setattr(server.Handler, "log_message", lambda *a: None)
    httpd = server.Server(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()
    mp.undo()


@pytest.fixture
def console_errors(page):
    """Collects JavaScript errors raised while a test runs."""
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    return errors


@pytest.fixture
def open_ticker(page, app_url):
    """Load the page for a ticker and wait until the analysis is rendered."""
    def go(ticker, price=None):
        page.goto(f"{app_url}/?t={ticker}" + (f"&p={price}" if price else ""))
        page.locator("#result").wait_for(state="visible")
        return page
    return go
