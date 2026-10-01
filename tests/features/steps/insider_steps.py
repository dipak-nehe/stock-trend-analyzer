"""Steps for insider_trades.feature: Form 4 parsing, the 12-month summary, and /api/insiders on saved filings."""
import logging
from datetime import date

from behave import given, then, when
from helpers import fixture_sec_get, fixture_sec_get_text, form4, form4_filings

from backend import insiders, stock_data

TODAY = date(2026, 9, 26)  # the saved filings' date
SIDE = {"buys": "buys", "sales": "sells"}


def _rel(role):
    """The reporting-relationship XML for a role written in a scenario: "Director", or an officer's title."""
    return "<isDirector>1</isDirector>" if role == "Director" else f"<isOfficer>1</isOfficer><officerTitle>{role}</officerTitle>"


def _cell(row, name, default):
    return row[name] if name in row.headings and row[name] != "" else default


def _summary(context):
    """The summary under test: hand-built (insider_activity) or from the endpoint (/api/insiders)."""
    return context.summary


# ---------- one Form 4 ----------

@given("a Form 4 from Doe Jane, CEO, with these transactions:")
def step_form4_lines(context):
    lines = [(r["code"], r["date"], int(r["shares"]), float(r["price"]), r["acquired or disposed"]) for r in context.table]
    context.xml = form4(lines=lines)


@given('a Form 4 whose reporting relationship is "{relationship}"')
def step_form4_relationship(context, relationship):
    fields = [part.strip().split("=", 1) for part in relationship.split(";")]
    context.xml = form4(rel="".join(f"<{k}>{v}</{k}>" for k, v in fields))


@when("it is read")
def step_parse(context):
    context.parsed = insiders.parse_form4(context.xml)


@then("its trades are:")
def step_trades(context):
    expected = [{"date": r["date"], "type": r["type"], "shares": int(r["shares"]), "price": float(r["price"])}
                for r in context.table]
    assert context.parsed["trades"] == expected


@then("it is from {name}, {role}, of company {issuer}")
def step_from(context, name, role, issuer):
    p = context.parsed
    assert (p["issuer"], p["name"], p["role"]) == (issuer, name, role)


@then('the insider\'s role is "{role}"')
def step_role(context, role):
    assert context.parsed["role"] == role


@then("a Form 4 with the trading-plan box ticked is pre-planned")
def step_planned(context):
    assert insiders.parse_form4(form4(planned="1"))["planned"] is True


@then("a Form 4 without it is not")
def step_not_planned(context):
    assert insiders.parse_form4(form4(planned="0"))["planned"] is False


# ---------- a company's Form 4s ----------

@given("the company's insider filings:")
def step_filings(context):
    """One row per transaction; rows with the same accession are one filing. Optional columns: issuer, insider,
    role, planned; code "none" means a filing with no transactions."""
    order, filings = [], {}
    for r in context.table:
        acc = r["accession"]
        if acc not in filings:
            order.append((acc, r["filed"]))
            filings[acc] = {"issuer": _cell(r, "issuer", "1"), "owner": _cell(r, "insider", "Doe Jane"),
                            "rel": _rel(_cell(r, "role", "CEO")), "planned": "1" if _cell(r, "planned", "no") == "yes" else "0",
                            "lines": []}
        if r["code"] != "none":
            ad = "A" if r["code"] == "P" else "D"
            filings[acc]["lines"].append((r["code"], r["date"], int(r["shares"]), float(r["price"]), ad))
    context.ins_sub = form4_filings(*order)
    context.docs = {acc: form4(**f) for acc, f in filings.items()}


@given("the filing \"{accession}\" can't be read")
def step_unreadable(context, accession):
    context.docs[accession] = "<not xml"


@given("at most {n:d} insider filings are read per company")
def step_cap(context, n):
    context.patches.attr(insiders, "MAX_FILINGS", n)


@given("the company has no insider filings")
def step_no_filings(context):
    context.ins_sub, context.docs = form4_filings(), {}


@when("its insider summary is built again with the same storage")
@when("its insider summary is built")
def step_build_summary(context):
    if not hasattr(context, "stored"):
        context.stored = {}
    fetched = []

    def fetch(url):
        accession = next(a for a in context.docs if a.replace("-", "") in url)
        fetched.append(accession)
        return context.docs[accession]

    context.summary = insiders.insider_activity(1, context.ins_sub, fetch, context.stored.get, context.stored.__setitem__,
                                                today=TODAY)
    context.fetched = fetched


@then('only the filings "{accessions}" were downloaded')
def step_downloaded(context, accessions):
    assert sorted(context.fetched) == sorted(accessions.split(", "))


@then("no filings were downloaded the second time")
def step_none_downloaded(context):
    assert context.fetched == []


@then("the {side} are {n:d} trades of {shares:d} shares worth {value:d} by {k:d} insiders")
def step_side_full(context, side, n, shares, value, k):
    assert _summary(context)[SIDE[side]] == {"count": n, "shares": shares, "value": value, "insiders": k}


@then("the {side} are {n:d} trade of {shares:d} shares worth {value:d} by {k:d} insider, {p:d} of them pre-planned")
def step_side_full_planned(context, side, n, shares, value, k, p):
    expected = {"count": n, "shares": shares, "value": value, "insiders": k, "planned": p}
    assert _summary(context)[SIDE[side]] == expected


@then("the {side} are {n:d} trade of {shares:d} shares")
def step_side_shares(context, side, n, shares):
    s = _summary(context)[SIDE[side]]
    assert (s["count"], s["shares"]) == (n, shares)


@then("the {side} are {n:d} trade worth {value:d}")
def step_side_value(context, side, n, value):
    s = _summary(context)[SIDE[side]]
    assert (s["count"], s["value"]) == (n, value)


@then("the {side} are {n:d} trade")
def step_side_count(context, side, n):
    assert _summary(context)[SIDE[side]]["count"] == n


@then("the trades are listed newest first: {dates}")
def step_trade_order(context, dates):
    assert [t["date"] for t in _summary(context)["trades"]] == dates.split(", ")


@then('the newest trade links to "{url}"')
def step_trade_url(context, url):
    assert _summary(context)["trades"][0]["url"] == url


@then("the summary covers {since} to {until} and is complete")
def step_window(context, since, until):
    s = _summary(context)
    assert (s["since"], s["until"], s["partial"]) == (since, until, False)


@then("the summary read {n:d} of {total:d} filings and is partial")
def step_partial_cap(context, n, total):
    s = _summary(context)
    assert (s["filings"], s["totalFilings"], s["partial"]) == (n, total, True)


@then("{n:d} filing was read and the summary is partial")
def step_partial_unreadable(context, n):
    s = _summary(context)
    assert s["read"] == n and s["partial"] is True


@then("there is no insider summary")
def step_no_summary(context):
    assert context.summary is None


# ---------- the endpoint, on the saved SEC filings ----------

@given("the saved SEC filings")
def step_saved_filings(context):
    context.patches.env("SEC_USER_AGENT", "StockTrendTests tests@example.com")
    context.patches.attr(stock_data, "sec_get", fixture_sec_get)
    context.patches.attr(stock_data, "sec_get_text", fixture_sec_get_text)


@given("Form 4 downloads are recorded")
def step_record_form4(context):
    context.form4_urls = []
    context.patches.attr(stock_data, "sec_get_text", lambda url: context.form4_urls.append(url) or "")


@when("the financials for {ticker} are built")
def step_build_real(context, ticker):
    context.result = stock_data.build_financials(ticker)


@then("no Form 4 was downloaded")
def step_no_form4(context):
    assert context.form4_urls == []


@then("the financials have no insider trades")
def step_no_insiders_in_financials(context):
    assert "insiders" not in context.result


@when("the insider trades for {ticker} are asked for")
def step_insider_endpoint(context, ticker):
    ticker = "" if ticker == "(empty)" else ticker.strip('"')
    context.ins = stock_data.insider_response(ticker)
    status, body = context.ins[0], context.ins[1]
    context.summary = body["insiders"] if status == 200 else None


@then("they come from SEC with status {status:d} for {ticker}, with {sales:d} sales")
def step_from_sec(context, status, ticker, sales):
    code, body, _, source = context.ins
    assert (code, source, body["ticker"], body["insiders"]["sells"]["count"]) == (status, "MISS", ticker, sales)


@then("they come from storage")
def step_from_storage(context):
    assert context.ins[3] == "HIT"


@then("the response is cached on the CDN")
def step_insiders_cdn(context):
    assert "s-maxage" in context.ins[2]


@given("reading insider trades fails")
def step_insiders_fail(context):
    def fail(*args):
        raise RuntimeError("SEC hiccup")
    context.real_insider_activity = stock_data.insider_activity
    context.patches.attr(stock_data, "insider_activity", fail)
    context.patches.attr(logging.getLogger("stock_data"), "disabled", True)  # the app logs the failure on purpose


@when("reading insider trades works again")
def step_insiders_work(context):
    context.patches.attr(stock_data, "insider_activity", context.real_insider_activity)


@then('the response is a {status:d} error saying "{text}", neither cached nor stored')
def step_insiders_failed(context, status, text):
    code, body, cache, source = context.ins
    assert (code, source, cache) == (status, None, stock_data.CACHE_NONE) and text in body["error"]


@then("the insider response status is {status:d}")
def step_insider_status(context, status):
    assert context.ins[0] == status


@then("the {side} are {n:d} trades by {k:d} insiders worth {value:d}")
def step_side_real(context, side, n, k, value):
    s = _summary(context)[SIDE[side]]
    assert (s["count"], s["insiders"], s["value"]) == (n, k, value)


@then("the {side} are {n:d} trades by {k:d} insiders worth {value:d}, {p:d} of them pre-planned")
def step_side_real_planned(context, side, n, k, value, p):
    s = _summary(context)[SIDE[side]]
    assert (s["count"], s["insiders"], s["value"], s["planned"]) == (n, k, value, p)


@then("the summary is complete")
def step_complete(context):
    assert _summary(context)["partial"] is False


@then("the sales total {shares:d} shares")
def step_sales_shares(context, shares):
    assert _summary(context)["sells"]["shares"] == shares


@then('no trade is by "{name}"')
def step_no_trade_by(context, name):
    assert all(t["name"] != name for t in _summary(context)["trades"])


@then("the summary read the maximum number of filings, fewer than JPM filed, and is partial")
def step_jpm_partial(context):
    s = _summary(context)
    assert s["filings"] == insiders.MAX_FILINGS < s["totalFilings"] and s["partial"] is True
