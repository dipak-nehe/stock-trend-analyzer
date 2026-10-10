"""Company pages (/stock/KO): the results page with the company's own title, description, share-preview tags and
canonical address, so search engines and link previews (LinkedIn, WhatsApp, Slack) see a page about that company.

The page itself is public/index.html: its script reads the ticker from the address and loads the analysis as usual.
Only the company's name is needed here, from the S&P 500 list (public/data/sp500.json) or SEC's ticker table (stored
for a week), so serving a company page never downloads a company's filings.
"""
import html
import json
import os
import re

from . import stock_data

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "public", "index.html")
SP500 = os.path.join(ROOT, "public", "data", "sp500.json")
SITE = "https://stock-value-analysis.vercel.app"
SITE_NAME = "10-Year Stock Value Analysis"
CACHE_PAGE = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
CACHE_SHORT = "public, max-age=0, s-maxage=300"   # unknown ticker, or SEC's ticker list couldn't be read


def _sp500_names() -> dict[str, tuple[str, str]]:
    """{SEC-form ticker: (ticker as listed, name)} from the S&P 500 list; {} if it's missing."""
    try:
        with open(SP500) as fh:
            companies = json.load(fh)["companies"]
    except (OSError, ValueError, KeyError):
        return {}
    return {stock_data.normalize_ticker(c["t"]): (c["t"], c["n"]) for c in companies}


def company(ticker: str) -> tuple[str, str] | None:
    """(ticker as shown, company name), or None for a ticker SEC doesn't know. Raises if SEC's list can't be read."""
    key = stock_data.normalize_ticker(ticker)
    listed = _sp500_names().get(key)
    if listed:
        return listed
    found = stock_data.lookup_cik(ticker)
    return (str(found[2]), str(found[1])) if found else None


def _set(page: str, pattern: str, value: str) -> str:
    """Replace the content of the first tag matching pattern (a regex with one group around the content)."""
    return re.sub(pattern, lambda m: m.group(0).replace(m.group(1), value, 1), page, count=1)


def render(template: str, path: str, title: str, description: str, noindex: bool = False) -> str:
    """The results page with this page's title, description, canonical address and share-preview tags. A <base> tag
    keeps the page's relative links (styles, scripts, other pages) pointing at the site root from /stock/…"""
    t, d, url = html.escape(title, quote=True), html.escape(description, quote=True), html.escape(SITE + path, quote=True)
    page = template.replace("<head>", '<head>\n<base href="/">', 1)
    page = _set(page, r"<title>([^<]*)</title>", t)
    page = _set(page, r'<meta name="description" content="([^"]*)">', d)
    page = _set(page, r'<link rel="canonical" href="([^"]*)">', url)
    page = _set(page, r'<meta property="og:title" content="([^"]*)">', t)
    page = _set(page, r'<meta property="og:description" content="([^"]*)">', d)
    page = _set(page, r'<meta property="og:url" content="([^"]*)">', url)
    if noindex:
        page = page.replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n<meta name="viewport"', 1)
    return page


def company_page(ticker: str) -> tuple[int, str, str]:
    """(status, HTML, Cache-Control) for /stock/<ticker>."""
    with open(INDEX, encoding="utf-8") as fh:
        template = fh.read()
    ticker = (ticker or "").strip()
    generic = f"{SITE_NAME}: 10 years of SEC filings for any US-listed company"
    if not stock_data.TICKER_RE.match(ticker):
        return 404, render(template, "/", f"Not found · {SITE_NAME}", generic, noindex=True), CACHE_SHORT
    try:
        found = company(ticker)
    except Exception:  # noqa: BLE001 - SEC's list unavailable: still serve the page; its script shows the analysis
        return 200, render(template, f"/stock/{ticker.upper()}", f"{ticker.upper()} · {SITE_NAME}", generic), CACHE_SHORT
    if not found:
        return 404, render(template, f"/stock/{ticker.upper()}", f"{ticker.upper()} not found · {SITE_NAME}", generic,
                           noindex=True), CACHE_SHORT
    shown, name = found
    title = f"{name} ({shown}): 10-year analysis from SEC filings · {SITE_NAME}"
    description = (f"{name} ({shown}): 10 years of revenue, earnings, dividends and debt from its SEC filings, with red "
                   "flags, the SEC filing record, insider trades and Graham, Buffett and Lynch checklists.")
    return 200, render(template, f"/stock/{shown}", title, description), CACHE_PAGE
