"""Build public/data/sp500.json: the S&P 500 companies for the picker page (sp500.html).

Run monthly by .github/workflows/sp500.yml (or by hand):  SEC_USER_AGENT="App you@example.com" python3 scripts/build_sp500.py
It also writes public/sitemap.xml (the site's pages plus a company page, /stock/KO, for each company), so search engines
find the company pages; `python3 scripts/build_sp500.py --sitemap-only` rewrites it from the current list, offline.
Two requests, no financial data (each company's figures are looked up live when a visitor picks it):
  - the current members, their names and GICS sectors: Wikipedia's "List of S&P 500 companies" table. The request
    names the app and its repository, not a person's email.
  - SEC's ticker list, to keep only tickers SEC knows (so every pick can be analysed).
If the list can't be fetched or doesn't look like the S&P 500 (fewer than 480 or more than 520 companies), the script
fails and the previous file stays.
"""
import json
import os
import ssl
import sys
import urllib.request
from datetime import date
from html.parser import HTMLParser

PUBLIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
OUT = os.path.join(PUBLIC, "data", "sp500.json")
SITEMAP = os.path.join(PUBLIC, "sitemap.xml")
SITE = "https://stock-value-analysis.vercel.app"
SITE_PAGES = ["/", "/sp500.html", "/portfolio.html", "/compare.html", "/methodology.html", "/disclaimer.html"]
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
WIKI_UA = "StockTrendAnalyzer/1.0 (https://github.com/dipak-nehe/stock-trend-analyzer)"
SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"
MIN_COUNT, MAX_COUNT = 480, 520
try:  # some Python installs (e.g. python.org on macOS) lack root certificates; certifi supplies them
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()


class _TableParser(HTMLParser):
    """The rows of the table with id="constituents": a list of rows, each a list of cell texts."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._depth = 0          # nesting of tables inside the constituents table (0 = outside it)
        self._cell: list[str] | None = None
        self._row: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table" and (self._depth or dict(attrs).get("id") == "constituents"):
            self._depth += 1
        elif self._depth == 1 and tag == "tr":
            self._row = []
        elif self._depth == 1 and tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "table" and self._depth:
            self._depth -= 1
        elif self._depth == 1 and tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif self._depth == 1 and tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def parse_constituents(html: str) -> list[dict[str, str]]:
    """[{t: ticker, n: name, s: sector}] from the Wikipedia page, by the table's column headings (so a reordered or
    added column doesn't break it)."""
    p = _TableParser()
    p.feed(html)
    if not p.rows:
        raise ValueError("no table with id=constituents on the page")
    head = [h.lower() for h in p.rows[0]]
    try:
        ti, ni, si = head.index("symbol"), head.index("security"), head.index("gics sector")
    except ValueError as e:
        raise ValueError(f"unexpected columns: {p.rows[0]}") from e
    out = []
    for row in p.rows[1:]:
        if len(row) > max(ti, ni, si) and row[ti]:
            out.append({"t": row[ti].strip().upper(), "n": row[ni].strip(), "s": row[si].strip()})
    return out


def sec_form(ticker: str) -> str:
    """SEC writes class-share tickers with a dash (BRK-B); Wikipedia with a dot (BRK.B)."""
    return ticker.upper().replace(".", "-").replace("/", "-")


def build(companies: list[dict[str, str]], sec_tickers: set[str], today: str) -> dict:
    """The file's contents: the companies SEC knows, sorted by name; the ones it doesn't are listed separately."""
    known = [c for c in companies if sec_form(c["t"]) in sec_tickers]
    missing = sorted(c["t"] for c in companies if sec_form(c["t"]) not in sec_tickers)
    if not MIN_COUNT <= len(known) <= MAX_COUNT:
        raise ValueError(f"{len(known)} companies: that doesn't look like the S&P 500 (expected {MIN_COUNT}-{MAX_COUNT})")
    known.sort(key=lambda c: c["n"].lower())
    return {"generated": today, "source": "Wikipedia: List of S&P 500 companies", "count": len(known),
            "companies": known, "notOnSec": missing}


def sitemap(companies: list[dict[str, str]]) -> str:
    """sitemap.xml: the site's pages, then a company page for each company (no dates, so it only changes with the list)."""
    from xml.sax.saxutils import escape
    urls = [SITE + p for p in SITE_PAGES] + [f"{SITE}/stock/{c['t']}" for c in sorted(companies, key=lambda c: c["t"])]
    body = "".join(f"  <url><loc>{escape(u)}</loc></url>\n" for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}</urlset>\n'


def write_sitemap(companies: list[dict[str, str]]) -> None:
    with open(SITEMAP, "w") as fh:
        fh.write(sitemap(companies))


def _get(url: str, user_agent: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
        return bytes(resp.read())


def main() -> None:
    if "--sitemap-only" in sys.argv:
        with open(OUT) as fh:
            write_sitemap(json.load(fh)["companies"])
        print(f"sitemap written to {SITEMAP}")
        return
    sec_ua = os.environ.get("SEC_USER_AGENT", "")
    if "@" not in sec_ua:
        sys.exit("Set SEC_USER_AGENT (e.g. 'App you@example.com'), as SEC requires")
    companies = parse_constituents(_get(WIKI_URL, WIKI_UA).decode("utf-8"))
    sec = json.loads(_get(SEC_TICKERS, sec_ua))
    data = build(companies, {row["ticker"].upper() for row in sec.values()}, date.today().isoformat())
    with open(OUT, "w") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    write_sitemap(data["companies"])
    print(f"{data['count']} companies written to {OUT}, and the sitemap; not on SEC: {data['notOnSec'] or 'none'}")


if __name__ == "__main__":
    main()
