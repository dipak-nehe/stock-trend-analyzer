"""Download and trim real SEC data used by the regression and end-to-end tests.

Run from the repo root:  SEC_USER_AGENT="App you@example.com" python3 tests/make_fixtures.py
The trimmed files are committed so the tests run offline and never hit SEC.

`--form4-only` refreshes just the insider filings (form4_<cik>.json) for the 12 months up to FIXTURE_TODAY, leaving
the other fixtures (and the values pinned from them) as they are.
"""
import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend import stock_data  # noqa: E402

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
TICKERS = ["AAPL", "KO", "INTC", "JPM", "SMCI"]
SINCE = "2014-01-01"
EXTRA_CONCEPTS = {("dei", "EntityCommonStockSharesOutstanding"), ("us-gaap", "CommonStockSharesOutstanding"),
                  ("ifrs-full", "NumberOfSharesOutstanding")}
KEEP_FORMS = {"UPLOAD", "CORRESP", "8-K", "8-K/A", "10-K", "10-K/A", "NT 10-K", "NT 10-Q", "20-F", "20-F/A"}
SUB_FIELDS = ["accessionNumber", "filingDate", "form", "items", "primaryDocument"]
FIXTURE_TODAY = "2026-09-26"  # the tests fix "today" to this date (STOCK_DATA_TODAY), so the 12-month window never moves
FORM4_DROP = ("reportingOwnerAddress", "derivativeTable", "footnotes", "remarks", "ownerSignature")


def save(name, data):
    with open(os.path.join(HERE, name), "w") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(os.path.join(HERE, name)) // 1024} KB")


def main():
    wanted = {pair for _, cands in stock_data.CONCEPTS.values() for pair in cands} | EXTRA_CONCEPTS
    all_tickers = stock_data.sec_get("https://www.sec.gov/files/company_tickers.json")
    rows = {k: v for k, v in all_tickers.items() if v["ticker"] in TICKERS + ["BRK-B"]}
    save("company_tickers.json", rows)

    for t in TICKERS:
        cik = stock_data.lookup_cik(t)[0]
        facts = stock_data.sec_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")
        trimmed = {}
        for tax, concepts in facts["facts"].items():
            for c, node in concepts.items():
                if (tax, c) not in wanted:
                    continue
                share_count = (tax, c) in EXTRA_CONCEPTS  # cover-page share counts come from 10-Qs too
                units = {u: [{k: r[k] for k in ("start", "end", "val", "accn", "form", "filed") if k in r}
                             for r in rows if share_count or r.get("form") in stock_data.ANNUAL_FORMS]
                         for u, rows in node["units"].items()}
                trimmed.setdefault(tax, {})[c] = {"units": {u: r for u, r in units.items() if r}}
        save(f"companyfacts_{cik}.json", {"cik": cik, "entityName": facts["entityName"], "facts": trimmed})

        sub = stock_data.sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
        tables = [sub["filings"]["recent"]] + [stock_data.sec_get("https://data.sec.gov/submissions/" + f["name"])
                                               for f in sub["filings"].get("files", []) if f["filingTo"] >= SINCE]
        merged = {k: [] for k in SUB_FIELDS}
        for tbl in tables:
            for i, form in enumerate(tbl["form"]):
                if form in KEEP_FORMS and tbl["filingDate"][i] >= SINCE:
                    for k in SUB_FIELDS:
                        merged[k].append(tbl[k][i])
        save(f"submissions_{cik}.json", {"cik": str(cik), "name": sub["name"], "sicDescription": sub.get("sicDescription"),
                                         "filings": {"recent": merged, "files": []}})


def trim_form4(xml_text):
    """Keep only what backend/insiders.py reads: the issuer, owners and their roles, the 10b5-1 flag, and each
    non-derivative transaction's date, code, shares, price and direction."""
    root = ET.fromstring(xml_text)
    for tag in FORM4_DROP:
        for parent in root.iter():
            for child in parent.findall(tag):
                parent.remove(child)
    for t in root.iter("nonDerivativeTransaction"):
        for tag in ("securityTitle", "postTransactionAmounts", "ownershipNature", "transactionTimeliness", "deemedExecutionDate"):
            for child in t.findall(tag):
                t.remove(child)
    return ET.tostring(root, encoding="unicode")


def save_form4(cik):
    """The company's Form 4s in the 12 months up to FIXTURE_TODAY: their filing-list rows and trimmed XML."""
    since = (date.fromisoformat(FIXTURE_TODAY) - timedelta(days=365)).isoformat()
    recent = stock_data.sec_get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")["filings"]["recent"]
    rows = [{k: recent[k][i] for k in SUB_FIELDS} for i, form in enumerate(recent["form"])
            if form in ("4", "4/A") and since <= recent["filingDate"][i] <= FIXTURE_TODAY]
    documents = {}
    for r in rows:
        doc = r["primaryDocument"].split("/", 1)[1] if r["primaryDocument"].startswith("xsl") else r["primaryDocument"]
        url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{r['accessionNumber'].replace('-', '')}/{doc}"
        documents[r["accessionNumber"]] = trim_form4(stock_data.sec_get_text(url))
    save(f"form4_{cik}.json", {"today": FIXTURE_TODAY, "filings": rows, "documents": documents})


if __name__ == "__main__":
    if "--form4-only" in sys.argv:
        for t in TICKERS:
            save_form4(stock_data.lookup_cik(t)[0])
    else:
        main()
        for t in TICKERS:
            save_form4(stock_data.lookup_cik(t)[0])
