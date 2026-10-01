"""Steps for filing_history.feature: classifying filings, the filing history and the latest report."""
from bdd_support import company
from behave import given, then, when
from helpers import submission_rows

from backend import stock_data


def _rows(table):
    """(accession, filed, form, items, document) rows from a Gherkin table; extra columns such as "note" are ignored."""
    return [(r["accession"], r["filed"], r["form"], r["items"], r["document"]) for r in table]


@when('a "{form}" filing with items "{items}" is classified')
def step_classify(context, form, items):
    context.events = [kind for kind, _ in stock_data._classify_filing(form, "" if items == "none" else items)]


@then('its events are "{events}"')
def step_classified_as(context, events):
    assert context.events == ([] if events == "none" else events.split(", "))


@given('a company in the "{industry}" industry whose recent filings are:')
def step_history_company(context, industry):
    c = company(context)
    c.submissions = {"sicDescription": industry, "filings": {"recent": submission_rows(_rows(context.table)), "files": []}}
    c.pages = {}


@given("an older page of its filings, covering {start:d} to {end:d}:")
def step_older_page(context, start, end):
    name = "CIK0000000001-submissions-001.json"
    context.submissions["filings"]["files"].append(
        {"name": name, "filingFrom": f"{start}-01-01", "filingTo": f"{end}-12-31"})
    context.pages[name] = submission_rows(_rows(context.table))


@given("an even older page covering {start:d} to {end:d}")
def step_oldest_page(context, start, end):
    context.submissions["filings"]["files"].append(
        {"name": "CIK0000000001-submissions-002.json", "filingFrom": f"{start}-01-01", "filingTo": f"{end}-12-31"})


@given("its recent filings are:")
def step_recent_filings(context):
    company(context).submissions = {"filings": {"recent": submission_rows(_rows(context.table))}}


@when("its filing history since {since} is read")
def step_read_history(context, since):
    c = company(context)
    c.sec.install(us_gaap=c.us_gaap, submissions=c.submissions, pages=c.pages)
    context.history = stock_data.filing_history(1, since)


@then('its events, newest first, are "{events}"')
def step_history_events(context, events):
    assert [e["type"] for e in context.history["events"]] == events.split(", ")


@then("each of those events is counted once")
def step_history_counts(context):
    assert context.history["counts"] == {e["type"]: 1 for e in context.history["events"]}


@then('the industry is "{industry}"')
def step_industry(context, industry):
    assert context.history["industry"] == industry


@then('the first event links to "{url}"')
def step_first_link(context, url):
    assert context.history["events"][0]["url"] == url


@then("the page entirely before the window is not downloaded")
def step_old_page_skipped(context):
    assert not any("submissions-002" in c for c in context.sec.calls)


@given("reading its filing history times out")
def step_history_times_out(context):
    def time_out(*args):
        raise TimeoutError()
    context.patches.attr(stock_data, "filing_history", time_out)


@then("there is no filing history")
def step_no_history(context):
    assert context.result["secHistory"] is None


@then("the latest year is {y:d}")
def step_latest_year(context, y):
    assert context.result["years"][-1] == y


@then("the latest report is the {form} filed on {date}, accession {accession}")
def step_latest_report(context, form, date, accession):
    report = context.result["latestReport"]
    assert set(report) == {"form", "date", "accession", "url"}
    assert (report["form"], report["date"], report["accession"]) == (form, date, accession)


@then('the latest report links to "{url}"')
def step_latest_report_url(context, url):
    assert context.result["latestReport"]["url"] == url


@then("there is no latest report")
def step_no_latest_report(context):
    assert context.result["latestReport"] is None
