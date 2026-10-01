"""Steps for annual_figures.feature: hand-built XBRL facts for company TEST, then build_financials."""
import pytest
from bdd_support import YEARS, add_facts, company, split_filings
from behave import given, then, when
from helpers import fact, net_income_years, year

from backend import stock_data

METRICS = {"revenue": "revenue", "diluted EPS": "eps", "dividends per share": "dps", "diluted shares": "dilutedShares",
           "total liabilities": "totalLiabilities", "total debt": "totalDebt", "long-term debt": "longTermDebt"}


def _by_year(context, metric):
    return dict(zip(context.result["years"], context.result["series"][METRICS[metric]], strict=True))


# ---------- the company's facts ----------

@given("a company that reported net income for 2016 to 2025")
def step_net_income(context):
    company(context).us_gaap["NetIncomeLoss"] = net_income_years(YEARS)


@given("{y:d} revenue of {v:d} filed on {filed}, restated in the next annual report")
@given("{y:d} revenue of {v:d} filed on {filed}")
def step_revenue_filed(context, y, v, filed):
    add_facts(context, "Revenues", [year(y, v, filed=filed)])


@given("{y:d} revenue of {v:d} in the annual report")
def step_revenue_annual(context, y, v):
    add_facts(context, "Revenues", [year(y, v)])


@given("a fourth-quarter revenue figure of {v:d} inside that annual report")
def step_revenue_q4(context, v):
    add_facts(context, "Revenues", [fact(v, "2020-12-31", "2020-10-01")])


@given("a full-year revenue figure of {v:d} in a 10-Q")
def step_revenue_10q(context, v):
    add_facts(context, "Revenues", [fact(v, "2020-12-31", "2020-01-01", form="10-Q")])


@given('revenue tagged "{tag}" for {a:d} to {b:d}')
def step_revenue_tag(context, tag, a, b):
    add_facts(context, tag, [year(y, 10 * y) for y in range(a, b + 1)])


@given("diluted EPS of {old:g} before a split and {new:g} after it, restated in the filing of 2021-02-15")
def step_eps_split(context, old, new):
    add_facts(context, "EarningsPerShareDiluted", split_filings(old, new), "USD/shares")


@given("dividends declared per share of {old:g} before the split and {new:g} after it")
def step_dps_split(context, old, new):
    add_facts(context, "CommonStockDividendsPerShareDeclared", split_filings(old, new), "USD/shares")


@given("diluted share counts of {before:d} before {y:d} and {after:d} from {y2:d}")
def step_shares_split(context, before, y, after, y2):
    rows = [year(yr, before if yr < y else after, filed=f"{yr + 1}-02-15") for yr in YEARS]
    add_facts(context, "WeightedAverageNumberOfDilutedSharesOutstanding", rows, "shares")


@given("diluted share counts of {n:d} every year")
def step_shares_flat(context, n):
    add_facts(context, "WeightedAverageNumberOfDilutedSharesOutstanding", [year(y, n) for y in YEARS], "shares")


@given("an IFRS filer reporting profit and revenue in TWD on Form 20-F for 2016 to 2025")
def step_ifrs_twd(context):
    twd = [year(y, 1_000_000 + y, form="20-F") for y in YEARS]
    for tag in ("ProfitLoss", "Revenue"):
        add_facts(context, tag, twd, "TWD", taxonomy="ifrs")


@given("a USD convenience translation of its latest year only")
def step_ifrs_usd(context):
    for tag in ("ProfitLoss", "Revenue"):
        add_facts(context, tag, [year(2025, 33_000, form="20-F")], "USD", taxonomy="ifrs")


@given("total liabilities and equity of {total:d} and shareholders' equity of {equity:d} at every year end")
def step_balance(context, total, equity):
    add_facts(context, "LiabilitiesAndStockholdersEquity", [year(y, total, instant=True) for y in YEARS])
    add_facts(context, "StockholdersEquity", [year(y, equity, instant=True) for y in YEARS])


@given('the balance-sheet tag "{tag}" is {v:d} at every year end, already including commercial paper')
@given('the balance-sheet tag "{tag}" is {v:d} at every year end')
def step_balance_tag(context, tag, v):
    if tag != "none":
        add_facts(context, tag, [year(y, v, instant=True) for y in YEARS])


@given('the balance-sheet tag "{tag}" is {v:d} at the year ends {a:d} to {b:d}')
def step_balance_tag_years(context, tag, v, a, b):
    add_facts(context, tag, [year(y, v, instant=True) for y in range(a, b + 1)])


@given("dividends paid of {v:d} every year except {v2:d} in {y2:d}")
def step_dividends_paid(context, v, v2, y2):
    add_facts(context, "PaymentsOfDividends", [year(y, v2 if y == y2 else v) for y in YEARS])


@given("shares outstanding on its filings' cover pages:")
def step_cover_shares(context):
    rows = [fact(int(r["shares"]), r["as of"], form=r["form"], filed=r["filed"], accn=r["filing"]) for r in context.table]
    add_facts(context, "EntityCommonStockSharesOutstanding", rows, "shares", taxonomy="dei")


# ---------- building ----------

@when("its financials are built")
def step_build(context):
    c = company(context)
    c.sec.install(us_gaap=c.us_gaap, ifrs=c.ifrs, dei=c.dei,
                  submissions=getattr(c, "submissions", None), pages=getattr(c, "pages", None))
    context.result = stock_data.build_financials("TEST")


# ---------- checks ----------

@then("{metric} is {v:g} in {y:d}")
@then("{metric} are {v:g} in {y:d}")
@then("{metric} is {v:g} in {y:d}, since a suspended dividend is zero, not missing")
@then("{metric} are {v:g} in {y:d}, since a suspended dividend is zero, not missing")
@then("{metric} are {v:g} in {y:d}, since share counts scale the other way")
def step_value_in_year(context, metric, v, y):
    assert _by_year(context, metric)[y] == pytest.approx(v)


@then("{metric} is {v:g} in every year")
@then("{metric} are {v:g} in every year")
@then("{metric} is {v:g} in every year, with no fake jump in 2021")
@then("{metric} is {v:g} in every year, the non-current part only")
def step_value_every_year(context, metric, v):
    assert set(context.result["series"][METRICS[metric]]) == {v}


@then("every year has revenue")
def step_no_gaps(context):
    assert None not in context.result["series"]["revenue"]


@then('revenue comes from the tags "{tags}"')
def step_sources(context, tags):
    assert set(context.result["sources"]["revenue"]) == set(tags.split(", "))


@then("a split with ratio {ratio:g} is detected in the filing of {filed}")
def step_split_in_filing(context, ratio, filed):
    assert context.result["splits"] == [{"detectedInFiling": filed, "ratio": ratio}]


@then("a split with ratio {ratio:g} is detected")
def step_split(context, ratio):
    assert context.result["splits"][0]["ratio"] == pytest.approx(ratio)


@then("no split is detected")
def step_no_split(context):
    assert context.result["splits"] == []


@then("the currency is {currency}")
def step_currency(context, currency):
    assert context.result["currency"] == currency


@then("no internal building blocks are in the result")
def step_no_internal(context):
    assert not [k for k in context.result["series"] if k.startswith("_")]


@then("shares outstanding are {n:d} as of {as_of}")
def step_shares_outstanding(context, n, as_of):
    shares = context.result["sharesOutstanding"]
    assert shares["value"] == n and shares["asOf"] == as_of
