"""Company pages (/stock/KO, backend/pages.py): the results page with the company's own title and share preview."""
import pytest

from backend import pages, stock_data

TEMPLATE = """<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>10-Year Stock Value Analysis</title>
<meta name="description" content="Generic description">
<link rel="canonical" href="https://stock-value-analysis.vercel.app/">
<meta property="og:title" content="10-Year Stock Value Analysis">
<meta property="og:description" content="Generic">
<meta property="og:url" content="https://stock-value-analysis.vercel.app/">
</head><body><script src="js/app.js"></script></body></html>"""


def test_the_page_gets_its_own_title_description_address_and_preview():
    page = pages.render(TEMPLATE, "/stock/KO", "Coca-Cola (KO): analysis", "Ten years of Coca-Cola")
    assert "<title>Coca-Cola (KO): analysis</title>" in page
    assert '<meta name="description" content="Ten years of Coca-Cola">' in page
    assert '<link rel="canonical" href="https://stock-value-analysis.vercel.app/stock/KO">' in page
    assert '<meta property="og:title" content="Coca-Cola (KO): analysis">' in page
    assert '<meta property="og:url" content="https://stock-value-analysis.vercel.app/stock/KO">' in page
    assert '<head>\n<base href="/">' in page          # relative links still point at the site root
    assert "noindex" not in page


def test_names_are_escaped_and_unknown_pages_are_kept_out_of_search_results():
    page = pages.render(TEMPLATE, "/stock/X", 'A "quoted" <b>name</b> & co', "d", noindex=True)
    assert "<title>A &quot;quoted&quot; &lt;b&gt;name&lt;/b&gt; &amp; co</title>" in page
    assert '<meta name="robots" content="noindex">' in page


def test_a_company_page_uses_the_sp500_name(sec_fixtures):
    status, page, cache = pages.company_page("ko")
    assert status == 200 and "s-maxage=86400" in cache
    assert "<title>Coca-Cola Company (The) (KO): 10-year analysis from SEC filings · 10-Year Stock Value Analysis</title>" in page
    assert '<link rel="canonical" href="https://stock-value-analysis.vercel.app/stock/KO">' in page


def test_a_company_outside_the_sp500_takes_its_name_from_secs_list(sec_fixtures, monkeypatch):
    monkeypatch.setattr(pages, "_sp500_names", lambda: {})
    status, page, _ = pages.company_page("KO")
    assert status == 200 and "<title>COCA COLA CO (KO): 10-year analysis" in page


@pytest.mark.parametrize("ticker", ["ZZZZQ", "<x>", "", "much-too-long-ticker"])
def test_unknown_or_malformed_tickers_are_not_found_and_not_indexed(sec_fixtures, ticker):
    status, page, cache = pages.company_page(ticker)
    assert status == 404 and 'content="noindex"' in page and cache == pages.CACHE_SHORT


def test_the_page_is_still_served_when_secs_list_cant_be_read(sec_fixtures, monkeypatch):
    monkeypatch.setattr(pages, "_sp500_names", lambda: {})
    monkeypatch.setattr(stock_data, "lookup_cik", lambda t: (_ for _ in ()).throw(TimeoutError()))
    status, page, cache = pages.company_page("KO")
    assert status == 200 and "<title>KO · 10-Year Stock Value Analysis</title>" in page and cache == pages.CACHE_SHORT
