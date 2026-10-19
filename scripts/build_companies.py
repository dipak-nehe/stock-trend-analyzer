"""Builds public/data/companies.json: every US-listed company SEC knows a ticker for, with its exchange and industry,
for the All companies page (companies.html). Rebuilt monthly by .github/workflows/companies.yml.

Three SEC sources, all free:
  - company_tickers_exchange.json: ticker, company name, CIK and exchange (about 10,400 tickers)
  - the Financial Statement Data Sets' filer lists (sub.txt in each quarterly zip): each filer's 4-digit SIC code
  - the SIC code list page: the official industry name for each code
Companies that haven't filed financial statements in the last four published quarters have no industry code; they're
kept, with the industry left blank.

Run:  SEC_USER_AGENT="App you@example.com" python3 scripts/build_companies.py
"""
from __future__ import annotations

import html
import io
import json
import os
import re
import sys
import zipfile
from datetime import date
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_industry import get  # noqa: E402  (the same polite, retrying SEC download)

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data", "companies.json")
TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
SIC_LIST_URL = "https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list"
DATA_SET_URL = "https://www.sec.gov/files/dera/data/financial-statement-data-sets/{}.zip"
EXCHANGES = {"Nasdaq": "Nasdaq", "NYSE": "NYSE", "OTC": "OTC", "CBOE": "Cboe", "TXSE": "TXSE"}
SMALL_WORDS = {"and", "of", "for", "the", "in", "on", "to", "or", "&"}
ACRONYMS = {"NEC", "REIT", "REITS", "SIC", "TV", "US"}  # kept in capitals ("NEC": not elsewhere classified)


def tickers(raw: dict[str, Any]) -> list[tuple[int, str, str, str]]:
    """(cik, name, ticker, exchange) rows; tickers without an exchange are listed as "other"."""
    fields = raw["fields"]
    ci, ni, ti, ei = (fields.index(k) for k in ("cik", "name", "ticker", "exchange"))
    rows = []
    for r in raw["data"]:
        if not r[ti]:
            continue
        rows.append((int(r[ci]), str(r[ni]).strip(), str(r[ti]).strip().upper(), EXCHANGES.get(r[ei] or "", "other")))
    return rows


def sic_names(page: str) -> dict[str, str]:
    """{4-digit SIC: industry name} from the SIC code list page's table (code, office, industry title)."""
    cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", page, re.S)]
    out: dict[str, str] = {}
    for i in range(0, len(cells) - 2, 3):
        code, title = cells[i], cells[i + 2]
        if code.isdigit() and title:
            out[code.zfill(4)] = industry_name(title)
    if len(out) < 300:
        raise RuntimeError(f"the SIC code list looks wrong: {len(out)} codes")
    return out


def industry_name(title: str) -> str:
    """'AGRICULTURAL PROD-LIVESTOCK & ANIMAL SPECIALTIES' -> 'Agricultural Prod-Livestock & Animal Specialties'."""
    words = []
    for i, w in enumerate(title.split()):
        parts = [p if p.strip(",.()") in ACRONYMS else p.capitalize() if (i == 0 or p.lower() not in SMALL_WORDS) else p.lower()
                 for p in w.split("-")]
        words.append("-".join(parts))
    return " ".join(words)


def quarters(today: date, n: int = 6) -> list[str]:
    """The last n calendar quarters before today, newest first ('2026q2', '2026q1', ...)."""
    y, q = today.year, (today.month - 1) // 3   # the current quarter isn't published yet
    out = []
    for _ in range(n):
        if q == 0:
            y, q = y - 1, 4
        out.append(f"{y}q{q}")
        q -= 1
    return out


def sic_codes(zips: list[bytes]) -> dict[int, str]:
    """{cik: 4-digit SIC} from data-set zips (newest first: a company's latest code wins)."""
    sic: dict[int, str] = {}
    for raw in zips:
        with zipfile.ZipFile(io.BytesIO(raw)) as z, z.open("sub.txt") as fh:
            lines = io.TextIOWrapper(fh, encoding="utf-8", errors="replace")
            head = next(lines).rstrip("\n").split("\t")
            ci, si = head.index("cik"), head.index("sic")
            for line in lines:
                cols = line.rstrip("\n").split("\t")
                code = cols[si].strip()
                if code and code != "0000":
                    sic.setdefault(int(cols[ci]), code.zfill(4))
    return sic


def build(ticker_rows: list[tuple[int, str, str, str]], codes: dict[int, str], names: dict[str, str], today: date) -> dict[str, Any]:
    """The file: {generated, count, industries: {code: name}, companies: [[ticker, name, exchange, sic], ...]} sorted by
    name, then ticker. Only the industries some company has are kept."""
    rows = sorted(([t, n, e, codes.get(c, "")] for c, n, t, e in ticker_rows), key=lambda r: (r[1].lower(), r[0]))
    used = {r[3] for r in rows if r[3]}
    return {"generated": today.isoformat(), "source": "SEC EDGAR: company tickers, Financial Statement Data Sets, SIC code list",
            "count": len(rows), "industries": {k: names.get(k, f"SIC {k}") for k in sorted(used)}, "companies": rows}


def main() -> None:
    rows = tickers(json.loads(get(TICKERS_URL)))
    if len(rows) < 5000:
        sys.exit(f"SEC's ticker list looks wrong: {len(rows)} tickers")
    names = sic_names(get(SIC_LIST_URL).decode("utf-8", "replace"))
    zips: list[bytes] = []
    for q in quarters(date.today()):
        try:
            zips.append(get(DATA_SET_URL.format(q)))
        except Exception:  # noqa: BLE001 - a quarter not published yet
            continue
        if len(zips) == 4:
            break
    data = build(rows, sic_codes(zips), names, date.today())
    with_industry = sum(1 for r in data["companies"] if r[3])
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{data['count']} tickers, {with_industry} with an industry, {len(data['industries'])} industries -> {OUT}")


if __name__ == "__main__":
    main()
