"""Company search for the search box: a ticker or part of a company name -> the best-matching tickers.

Pure functions over the ticker table (stock_data.ticker_table: {TICKER: [cik, title, ticker]}, in SEC's order, which is
roughly largest company first). Ranking, best first:
  0 exact ticker · 1 a well-known brand name (BRANDS) · 2 ticker starting with the query ·
  3 name starting with the query · 4 a word of the name starting with it · 5 name containing it, ignoring spaces (6+ letters)
Ties keep SEC's order. Name matches show each company once (GOOGL and GOOG share one company).
"""
import re
from typing import Any

# Brand names that differ from the company's legal name in SEC's list (where the legal name already contains the
# brand, e.g. "PEPSICO", it matches on its own)
BRANDS: dict[str, str] = {
    "google": "GOOGL", "youtube": "GOOGL", "facebook": "META", "instagram": "META", "whatsapp": "META",
    "coke": "KO", "p and g": "PG", "pg": "PG", "j and j": "JNJ", "jnj": "JNJ", "jp morgan": "JPM", "chase": "JPM",
    "amex": "AXP", "snapchat": "SNAP", "tsmc": "TSM", "gm": "GM", "bofa": "BAC", "hp": "HPQ", "lilly": "LLY",
    "novo": "NVO", "berkshire": "BRK-B",
}


def normalize(text: str) -> str:
    """Lower case, "&" as "and", punctuation dropped, single spaces: "AT&T Inc." -> "at and t inc"."""
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return " ".join(text.split())


def search(table: dict[str, list[Any]], query: str, limit: int = 8) -> list[dict[str, str]]:
    q = normalize(query)
    if not q:
        return []
    q_ticker = query.strip().upper().replace(".", "-").replace("/", "-")
    q_compact = q.replace(" ", "")
    brand = BRANDS.get(q)
    scored: list[tuple[int, int, str, str, Any]] = []
    for rank, (key, (cik, title, ticker)) in enumerate(table.items()):
        name = normalize(title)
        if key == q_ticker:
            score = 0
        elif brand and key == brand:
            score = 1
        elif q_compact.isalnum() and len(q_compact) <= 5 and key.replace("-", "").lower().startswith(q_compact):
            score = 2
        elif name.startswith(q):
            score = 3
        elif f" {q}" in f" {name}":
            score = 4
        elif len(q_compact) >= 6 and q_compact in name.replace(" ", ""):  # "jp morgan" vs "JPMORGAN"; short ones are noise
            score = 5
        else:
            continue
        scored.append((score, rank, ticker, title, cik))
    scored.sort(key=lambda s: (s[0], s[1]))
    results: list[dict[str, str]] = []
    seen: set[Any] = set()
    for score, _, ticker, title, cik in scored:
        if score >= 3 and cik in seen:  # a name match for a company already listed under another ticker
            continue
        seen.add(cik)
        results.append({"ticker": ticker, "name": title})
        if len(results) == limit:
            break
    return results
