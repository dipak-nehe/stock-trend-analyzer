"""Insider trading from Form 4 filings (backend/insiders.py): hand-built filings for each rule, then the real ones."""
from datetime import date

import pytest

from backend import insiders, stock_data

TODAY = date(2026, 9, 26)


def form4(issuer="1", owner="Doe Jane", rel="<isOfficer>1</isOfficer><officerTitle>CEO</officerTitle>", planned="0",
          lines=()):
    """A minimal Form 4: lines are (code, date, shares, price, acquired/disposed)."""
    txs = "".join(
        f"<nonDerivativeTransaction><transactionDate><value>{d}</value></transactionDate>"
        f"<transactionCoding><transactionCode>{code}</transactionCode></transactionCoding>"
        f"<transactionAmounts><transactionShares><value>{shares}</value></transactionShares>"
        f"<transactionPricePerShare><value>{price}</value></transactionPricePerShare>"
        f"<transactionAcquiredDisposedCode><value>{ad}</value></transactionAcquiredDisposedCode></transactionAmounts>"
        f"</nonDerivativeTransaction>" for code, d, shares, price, ad in lines)
    return (f"<ownershipDocument><issuer><issuerCik>{int(issuer):010d}</issuerCik></issuer>"
            f"<reportingOwner><reportingOwnerId><rptOwnerName>{owner}</rptOwnerName></reportingOwnerId>"
            f"<reportingOwnerRelationship>{rel}</reportingOwnerRelationship></reportingOwner>"
            f"<aff10b5One>{planned}</aff10b5One><nonDerivativeTable>{txs}</nonDerivativeTable></ownershipDocument>")


def filings(*rows):
    """A submissions index with Form 4 rows: (accession, filed[, form])."""
    cols = {k: [] for k in ("accessionNumber", "filingDate", "form", "items", "primaryDocument")}
    for row in rows:
        accession, filed, form = (*row, "4")[:3]
        for k, v in (("accessionNumber", accession), ("filingDate", filed), ("form", form), ("items", ""),
                     ("primaryDocument", "xslF345X06/form4.xml")):
            cols[k].append(v)
    return {"filings": {"recent": cols}}


def run(sub, docs, cik=1, stored=None):
    """insider_activity with documents by accession; returns (result, downloaded accessions)."""
    fetched, stored = [], stored if stored is not None else {}

    def fetch(url):
        accession = next(a for a in docs if a.replace("-", "") in url)
        fetched.append(accession)
        return docs[accession]

    result = insiders.insider_activity(cik, sub, fetch, stored.get, stored.__setitem__, today=TODAY)
    return result, fetched


# ---------- one filing ----------

def test_only_open_market_buys_and_sales_count_and_lines_are_grouped():
    parsed = insiders.parse_form4(form4(lines=[
        ("S", "2026-08-01", 100, 10.0, "D"), ("S", "2026-08-01", 300, 12.0, "D"),  # one sale at two prices
        ("P", "2026-08-02", 50, 9.0, "A"),
        ("A", "2026-08-01", 1000, 0, "A"), ("M", "2026-08-01", 500, 5.0, "A"), ("F", "2026-08-01", 200, 11.0, "D"),
    ]))
    assert parsed["trades"] == [
        {"date": "2026-08-01", "type": "sell", "shares": 400, "price": 11.5},  # (100×10 + 300×12) / 400
        {"date": "2026-08-02", "type": "buy", "shares": 50, "price": 9.0},
    ]
    assert parsed["issuer"] == "1" and parsed["name"] == "Doe Jane" and parsed["role"] == "CEO"


@pytest.mark.parametrize("rel, role", [
    ("<isDirector>1</isDirector>", "Director"),
    ("<isOfficer>true</isOfficer><officerTitle>CFO</officerTitle><isDirector>1</isDirector>", "CFO, Director"),
    ("<isTenPercentOwner>1</isTenPercentOwner>", "10% owner"),
    ("<isOther>1</isOther><otherText>President, Latin America</otherText>", "President, Latin America"),
    ("<isOfficer>1</isOfficer>", "Officer"),
])
def test_the_insiders_role(rel, role):
    assert insiders.parse_form4(form4(rel=rel))["role"] == role


def test_the_pre_planned_trading_plan_checkbox():
    assert insiders.parse_form4(form4(planned="1"))["planned"] is True
    assert insiders.parse_form4(form4(planned="0"))["planned"] is False


# ---------- a company's filings ----------

def test_summary_of_buys_and_sales_in_the_last_12_months():
    sub = filings(("0001-26-000003", "2026-09-01"), ("0001-26-000002", "2026-06-01"), ("0001-26-000001", "2026-03-01"))
    docs = {
        "0001-26-000003": form4(owner="Ann", planned="1", lines=[("S", "2026-08-30", 1000, 20.0, "D")]),
        "0001-26-000002": form4(owner="Bob", rel="<isDirector>1</isDirector>", lines=[("P", "2026-05-30", 500, 10.0, "A")]),
        "0001-26-000001": form4(owner="Cy", rel="<isDirector>1</isDirector>", lines=[("P", "2026-02-27", 200, 11.0, "A")]),
    }
    result, _ = run(sub, docs)
    assert result["buys"] == {"count": 2, "shares": 700, "value": 7200, "insiders": 2}
    assert result["sells"] == {"count": 1, "shares": 1000, "value": 20000, "insiders": 1, "planned": 1}
    assert [t["date"] for t in result["trades"]] == ["2026-08-30", "2026-05-30", "2026-02-27"]  # newest first
    assert result["trades"][0]["url"] == "https://www.sec.gov/Archives/edgar/data/1/000126000003/xslF345X06/form4.xml"
    assert (result["since"], result["until"], result["partial"]) == ("2025-09-26", "2026-09-26", False)


def test_filings_and_trades_older_than_12_months_are_left_out():
    sub = filings(("0001-26-000002", "2026-01-10"), ("0001-25-000001", "2025-09-01"))  # the second is too old
    docs = {"0001-26-000002": form4(lines=[("P", "2025-06-01", 10, 5.0, "A"), ("P", "2026-01-08", 20, 5.0, "A")]),
            "0001-25-000001": form4(lines=[("P", "2025-08-30", 99, 5.0, "A")])}
    result, fetched = run(sub, docs)
    assert fetched == ["0001-26-000002"]
    assert result["buys"]["count"] == 1 and result["buys"]["shares"] == 20  # the 2025 trade reported late is dropped


def test_form4s_the_company_filed_as_an_investor_in_another_company_are_ignored():
    # Real case: Coca-Cola's filing list includes Form 4s where Coca-Cola reports as a 10% owner of another company.
    sub = filings(("0001-26-000002", "2026-09-01"), ("0001-26-000001", "2026-08-01"))
    docs = {"0001-26-000002": form4(issuer="999", owner="Parent Co", lines=[("S", "2026-08-30", 10**7, 100.0, "D")]),
            "0001-26-000001": form4(lines=[("S", "2026-07-30", 100, 10.0, "D")])}
    result, _ = run(sub, docs)
    assert result["sells"]["count"] == 1 and result["sells"]["value"] == 1000


def test_stored_filings_are_not_downloaded_again():
    sub = filings(("0001-26-000001", "2026-09-01"))
    docs = {"0001-26-000001": form4(lines=[("P", "2026-08-30", 10, 5.0, "A")])}
    stored = {}
    run(sub, docs, stored=stored)
    result, fetched = run(sub, docs, stored=stored)
    assert fetched == [] and result["buys"]["count"] == 1


def test_only_the_newest_filings_are_read_and_the_summary_says_it_is_partial(monkeypatch):
    monkeypatch.setattr(insiders, "MAX_FILINGS", 2)
    sub = filings(*[(f"0001-26-00000{i}", f"2026-0{i}-01") for i in range(1, 5)])
    docs = {f"0001-26-00000{i}": form4() for i in range(1, 5)}
    result, fetched = run(sub, docs)
    assert sorted(fetched) == ["0001-26-000003", "0001-26-000004"]
    assert (result["filings"], result["totalFilings"], result["partial"]) == (2, 4, True)


def test_an_unreadable_filing_is_skipped_and_marks_the_summary_partial():
    sub = filings(("0001-26-000002", "2026-09-01"), ("0001-26-000001", "2026-08-01"))
    docs = {"0001-26-000002": "<not xml", "0001-26-000001": form4(lines=[("S", "2026-07-30", 100, 10.0, "D")])}
    result, _ = run(sub, docs)
    assert result["sells"]["count"] == 1 and result["read"] == 1 and result["partial"] is True


def test_no_insider_filings_means_no_summary():
    assert insiders.insider_activity(1, filings(), None, {}.get, None, today=TODAY) is None


def test_the_financials_still_load_when_the_insider_summary_fails(sec_fixtures, monkeypatch):
    monkeypatch.setattr(stock_data, "insider_activity", lambda *a: (_ for _ in ()).throw(RuntimeError("boom")))
    d = stock_data.build_financials("KO")
    assert d["insiders"] is None and d["insidersFailed"] is True and d["secHistory"] is not None


def test_a_failed_insider_summary_is_retried_on_the_next_request(sec_fixtures, monkeypatch):
    # Regression: one failed first lookup (NVDA on the live site) was stored and served as "no insider data".
    real = stock_data.insider_activity
    monkeypatch.setattr(stock_data, "insider_activity", lambda *a: (_ for _ in ()).throw(RuntimeError("SEC hiccup")))
    status, body, _, source = stock_data.api_response("KO")
    assert (status, source, body["insiders"]) == (200, "MISS", None)
    monkeypatch.setattr(stock_data, "insider_activity", real)
    status, body, _, source = stock_data.api_response("KO")
    assert source != "HIT" and body["insiders"]["sells"]["count"] == 31 and body["insidersFailed"] is False
    assert stock_data.api_response("KO")[3] == "HIT"  # and once it worked, the stored copy is used again


# ---------- real filings (tests/fixtures/form4_*.json, 12 months to 2026-09-26) ----------

@pytest.mark.parametrize("ticker, buys, sells", [
    # (count, insiders, value) for buys; (count, insiders, value, pre-planned) for sales
    ("KO", (2, 1, 998_671), (31, 11, 255_746_062, 10)),
    ("INTC", (2, 2, 10_249_970), (3, 2, 7_474_399, 0)),
    ("AAPL", (0, 0, 0), (19, 8, 173_879_888, 16)),
    ("SMCI", (0, 0, 0), (6, 4, 18_910_948, 4)),
])
def test_real_insider_summaries(sec_fixtures, ticker, buys, sells):
    ins = stock_data.build_financials(ticker)["insiders"]
    assert (ins["buys"]["count"], ins["buys"]["insiders"], ins["buys"]["value"]) == buys
    assert (ins["sells"]["count"], ins["sells"]["insiders"], ins["sells"]["value"], ins["sells"]["planned"]) == sells
    assert ins["partial"] is False


def test_coca_colas_own_investor_filing_is_not_counted_as_an_insider_sale(sec_fixtures):
    # Its filing list includes a Form 4 of Coca-Cola as a 10% owner of another company: 18.8 million shares at $127.
    ins = stock_data.build_financials("KO")["insiders"]
    assert ins["sells"]["shares"] == 3_121_783
    assert all(t["name"] != "COCA COLA CO" for t in ins["trades"])


def test_a_company_with_more_filings_than_the_cap_is_marked_partial(sec_fixtures):
    ins = stock_data.build_financials("JPM")["insiders"]
    assert ins["filings"] == insiders.MAX_FILINGS < ins["totalFilings"] and ins["partial"] is True
