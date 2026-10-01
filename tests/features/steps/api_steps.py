"""Steps for api_responses.feature: stock_data.lookup_cik and stock_data.api_response."""
import logging
import urllib.error

from bdd_support import company
from behave import given, then, when
from helpers import REAL_SEC_GET

from backend import stock_data

# Words in the scenarios for tickers that can't be written as they are.
TICKER_WORDS = {"(empty)": "", "(three spaces)": "   "}

# The failure SEC "returns", by its name in the scenarios.
FAILURES = {
    "HTTP 403": lambda: urllib.error.HTTPError("u", 403, "Forbidden", {}, None),
    "HTTP 429": lambda: urllib.error.HTTPError("u", 429, "Too Many", {}, None),
    "HTTP 500": lambda: urllib.error.HTTPError("u", 500, "Error", {}, None),
    "a network error": lambda: urllib.error.URLError("down"),
    "a timeout": lambda: TimeoutError(),
    "an unexpected error": lambda: ValueError("boom"),  # "boom" must never reach the user
}


@given("SEC's ticker list includes BRK-B for Berkshire")
def step_ticker_list(context):
    company(context)  # the fake SEC's ticker list has TEST and BRK-B


@when('the ticker "{ticker}" is looked up')
def step_lookup(context, ticker):
    context.found = stock_data.lookup_cik(ticker)


@then("it is found as {ticker}, {name}, CIK {cik:d}")
def step_found(context, ticker, name, cik):
    assert context.found == (cik, name, ticker)


@given("SEC fails with {failure}")
def step_sec_fails(context, failure):
    def failing(url):
        raise FAILURES[failure]()
    context.patches.env("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    context.patches.attr(stock_data, "sec_get", failing)
    context.patches.attr(logging.getLogger("stock_data"), "disabled", True)  # the app logs the failure on purpose


@given("SEC_USER_AGENT is not set")
def step_contact_unset(context):
    context.patches.env("SEC_USER_AGENT", None)


@given("SEC_USER_AGENT is empty")
def step_contact_empty(context):
    context.patches.env("SEC_USER_AGENT", "")


@given('SEC_USER_AGENT is "{value}", no email')
def step_contact_value(context, value):
    context.patches.env("SEC_USER_AGENT", value)


@given("the real SEC downloader is used")
def step_real_downloader(context):
    # It fails on the contact check before any network call; an empty cache makes sure nothing answers first.
    context.patches.attr(stock_data, "_cache", {})
    context.patches.attr(stock_data, "sec_get", REAL_SEC_GET)


@when("the API is asked for the ticker {ticker}")
def step_api(context, ticker):
    c = context
    if hasattr(c, "sec"):
        c.sec.install(us_gaap=c.us_gaap)
    context.status, context.body, context.cache, _ = stock_data.api_response(TICKER_WORDS.get(ticker, ticker))


@then("the response is an error with status {status:d}")
def step_error_status(context, status):
    assert context.status == status and "error" in context.body


@then("the response is the company {ticker}")
def step_company(context, ticker):
    assert context.status == 200 and context.body["ticker"] == ticker


@then("the response is not cached")
def step_not_cached(context):
    assert context.cache == stock_data.CACHE_NONE


@then("the response is cached briefly as not found")
def step_cached_not_found(context):
    assert context.cache == stock_data.CACHE_NOT_FOUND


@then("the response is cached on the CDN for a day, while browsers always re-check")
def step_cdn_only(context):
    assert "s-maxage=86400" in context.cache and "max-age=0" in context.cache


@then('the error says "{text}"')
def step_error_text(context, text):
    assert text in context.body["error"]


@then("the error doesn't reveal internal details")
def step_no_leak(context):
    assert "boom" not in context.body["error"]
