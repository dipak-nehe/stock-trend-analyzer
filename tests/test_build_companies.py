"""The All companies list builder (scripts/build_companies.py), on small hand-built SEC inputs: no network."""
import io
import os
import sys
import zipfile
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import build_companies as b  # noqa: E402


def data_set(rows):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("sub.txt", "adsh\tcik\tname\tsic\n" + "".join(f"x\t{c}\tn\t{s}\n" for c, s in rows))
    return buf.getvalue()


def test_tickers_keep_each_listing_and_name_the_exchanges():
    raw = {"fields": ["cik", "name", "ticker", "exchange"],
           "data": [[21344, "COCA COLA CO", "KO", "NYSE"], [1, "Odd Co", "odd", None], [2, "Blank", "", "Nasdaq"], [3, "X", "XX", "CBOE"]]}
    assert b.tickers(raw) == [(21344, "COCA COLA CO", "KO", "NYSE"), (1, "Odd Co", "ODD", "other"), (3, "X", "XX", "Cboe")]


def test_industry_names_come_from_the_sic_list_in_readable_case():
    codes = [("2080", "BEVERAGES"), ("5990", "RETAIL-RETAIL STORES, NEC")] + [(str(i), "X") for i in range(1000, 1400)]
    page = "<table>" + "".join(f"<tr><td>{c}</td><td>Office</td><td>{t}</td></tr>" for c, t in codes) + "</table>"
    names = b.sic_names(page)
    assert names["2080"] == "Beverages" and names["5990"] == "Retail-Retail Stores, NEC"
    with pytest.raises(RuntimeError):
        b.sic_names("<table><tr><td>2080</td><td>o</td><td>BEVERAGES</td></tr></table>")   # far too few codes


def test_the_newest_quarter_gives_each_company_its_industry_code():
    newest, older = data_set([(21344, "2080")]), data_set([(21344, "2086"), (320193, "3571"), (9, "0000")])
    assert b.sic_codes([newest, older]) == {21344: "2080", 320193: "3571"}


def test_quarters_count_back_from_the_last_finished_one():
    assert b.quarters(date(2026, 10, 18), 3) == ["2026q3", "2026q2", "2026q1"]
    assert b.quarters(date(2026, 2, 1), 2) == ["2025q4", "2025q3"]


def test_the_file_lists_companies_by_name_with_only_the_industries_used():
    names = {"2080": "Beverages", "3571": "Computers"}
    out = b.build([(2, "beta", "B", "NYSE"), (1, "Alpha", "A", "Nasdaq")], {1: "2080"}, names, date(2026, 10, 18))
    assert out["companies"] == [["A", "Alpha", "Nasdaq", "2080"], ["B", "beta", "NYSE", ""]]
    assert out["industries"] == {"2080": "Beverages"} and out["count"] == 2 and out["generated"] == "2026-10-18"
