"""The S&P 500 list builder (scripts/build_sp500.py): reading Wikipedia's table and checking it against SEC's tickers."""
import pytest

from scripts import build_sp500 as b

PAGE = """<html><body>
<table class="wikitable" id="other"><tr><th>Symbol</th></tr><tr><td>NOPE</td></tr></table>
<table class="wikitable sortable" id="constituents">
<tr><th>Symbol</th><th>Security</th><th>GICS Sector</th><th>GICS Sub-Industry</th><th>CIK</th></tr>
<tr><td><a href="#">KO</a></td><td><a href="#">Coca-Cola Company (The)</a></td><td>Consumer Staples</td>
  <td>Soft Drinks</td><td>0000021344</td></tr>
<tr><td><a href="#">BRK.B</a></td><td>Berkshire
  Hathaway</td><td>Financials</td><td>Multi-Sector Holdings<table><tr><td>a nested table</td></tr></table></td><td>1067983</td></tr>
<tr><td>AAPL</td><td>Apple Inc.</td><td>Information Technology</td><td>Hardware</td><td>320193</td></tr>
</table></body></html>"""


def test_the_constituents_table_is_read_by_its_column_headings():
    assert b.parse_constituents(PAGE) == [
        {"t": "KO", "n": "Coca-Cola Company (The)", "s": "Consumer Staples"},
        {"t": "BRK.B", "n": "Berkshire Hathaway", "s": "Financials"},   # line breaks and spaces tidied
        {"t": "AAPL", "n": "Apple Inc.", "s": "Information Technology"},
    ]


def test_reordered_columns_still_read_and_a_missing_table_fails_loudly():
    moved = PAGE.replace("<th>Symbol</th><th>Security</th>", "<th>Security</th><th>Symbol</th>").replace(
        '<td><a href="#">KO</a></td><td><a href="#">Coca-Cola Company (The)</a></td>',
        '<td><a href="#">Coca-Cola Company (The)</a></td><td><a href="#">KO</a></td>')
    assert b.parse_constituents(moved)[0] == {"t": "KO", "n": "Coca-Cola Company (The)", "s": "Consumer Staples"}
    with pytest.raises(ValueError, match="constituents"):
        b.parse_constituents("<table id='x'></table>")
    with pytest.raises(ValueError, match="unexpected columns"):
        b.parse_constituents('<table id="constituents"><tr><th>Ticker</th></tr></table>')


def test_class_share_tickers_match_secs_dash_form():
    assert b.sec_form("BRK.B") == "BRK-B" and b.sec_form("bf.b") == "BF-B" and b.sec_form("KO") == "KO"


def _companies(n):
    return [{"t": f"T{i}", "n": f"Company {n - i:03d}", "s": "Energy"} for i in range(n)]


def test_the_file_keeps_companies_sec_knows_sorted_by_name():
    companies = _companies(500) + [{"t": "GONE", "n": "Delisted Co", "s": "Energy"}]
    data = b.build(companies, {f"T{i}" for i in range(500)}, "2026-10-10")
    assert data["count"] == 500 and data["notOnSec"] == ["GONE"] and data["generated"] == "2026-10-10"
    names = [c["n"] for c in data["companies"]]
    assert names == sorted(names, key=str.lower)


@pytest.mark.parametrize("n", [100, 600])
def test_a_list_that_doesnt_look_like_the_sp500_is_refused(n):
    with pytest.raises(ValueError, match="doesn't look like the S&P 500"):
        b.build(_companies(n), {f"T{i}" for i in range(n)}, "2026-10-10")


def test_the_sitemap_lists_the_site_pages_and_a_page_per_company():
    xml = b.sitemap([{"t": "KO", "n": "Coca-Cola", "s": "x"}, {"t": "BRK.B", "n": "Berkshire & Co", "s": "y"}])
    assert xml.startswith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    locs = [line.strip()[len("<url><loc>"):-len("</loc></url>")] for line in xml.splitlines() if "<loc>" in line]
    assert locs[0] == "https://stock-value-analysis.vercel.app/"
    assert locs[-2:] == ["https://stock-value-analysis.vercel.app/stock/BRK.B", "https://stock-value-analysis.vercel.app/stock/KO"]
    assert "lastmod" not in xml   # no dates: the file only changes when the list does
    assert not any("methodology" in loc for loc in locs)   # unlisted

