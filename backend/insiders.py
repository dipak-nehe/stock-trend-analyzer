"""Insider trading from SEC Form 4 filings: open-market buys and sales by officers, directors and 10% owners.

Officers, directors and owners of more than 10% must report their trades in the company's stock within two
business days on Form 4. Each filing is a small XML document. Most transactions in it aren't decisions to buy or
sell: stock grants (code A), option exercises (M), shares withheld for tax (F), gifts (G). Only open-market
purchases (P) and sales (S) are counted here. A sale can be marked as made under a pre-arranged trading plan
(Rule 10b5-1, a checkbox since 2023), which makes it even less of a signal.

Downloading, storage and "today" are passed in, so this module is easy to test.
"""
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import Any

WINDOW_DAYS = 365      # "the last 12 months"
MAX_FILINGS = 100      # newest insider filings read per company (big companies file dozens a year)
TIME_BUDGET = 15.0     # seconds to spend downloading them in one request; the rest comes on the next visit
WORKERS = 4            # downloads in parallel (the fetch function itself keeps to SEC's rate limit)
SHOWN_TRADES = 40      # latest trades returned for the table
FORMS = {"4", "4/A"}


def _flag(node: ET.Element, tag: str) -> bool:
    return (node.findtext(tag) or "").strip().lower() in ("1", "true")


def _role(rel: ET.Element | None) -> str:
    """"CEO", "Director", "10% owner"…: what the insider is to the company (a filer can be several)."""
    if rel is None:
        return ""
    roles = []
    if _flag(rel, "isOfficer"):
        roles.append((rel.findtext("officerTitle") or "").strip() or "Officer")
    if _flag(rel, "isDirector"):
        roles.append("Director")
    if _flag(rel, "isTenPercentOwner"):
        roles.append("10% owner")
    if _flag(rel, "isOther"):
        roles.append((rel.findtext("otherText") or "").strip() or "Other")
    return ", ".join(roles)


def _number(node: ET.Element, path: str) -> float | None:
    text = (node.findtext(path) or "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def parse_form4(xml_text: str) -> dict[str, Any]:
    """The open-market trades in one Form 4: {"issuer", "name", "role", "planned", "trades": [{date, type, shares, price}]}.

    Several lines of the same kind in one filing (a sale split across prices, say) become one trade, with the total
    shares and the average price.
    """
    root = ET.fromstring(xml_text)
    owners = root.findall("reportingOwner")
    names = [(o.findtext("reportingOwnerId/rptOwnerName") or "").strip() for o in owners]
    role = _role(owners[0].find("reportingOwnerRelationship")) if owners else ""
    planned = _flag(root, "aff10b5One")
    grouped: dict[tuple[str, str], list[float]] = {}  # (type, date) -> [shares, value]
    for t in root.findall("nonDerivativeTable/nonDerivativeTransaction"):
        code = (t.findtext("transactionCoding/transactionCode") or "").strip()
        if code not in ("P", "S"):
            continue
        shares = _number(t, "transactionAmounts/transactionShares/value") or 0.0
        price = _number(t, "transactionAmounts/transactionPricePerShare/value") or 0.0
        day = (t.findtext("transactionDate/value") or "").strip()[:10]
        g = grouped.setdefault(("buy" if code == "P" else "sell", day), [0.0, 0.0])
        g[0] += shares
        g[1] += shares * price
    trades = [{"date": day, "type": kind, "shares": round(s), "price": round(v / s, 2) if s else None}
              for (kind, day), (s, v) in grouped.items()]
    issuer = (root.findtext("issuer/issuerCik") or "").strip().lstrip("0")
    return {"issuer": issuer, "name": " / ".join(n for n in names if n), "role": role, "planned": planned, "trades": trades}


def _raw_xml_path(primary_document: str) -> str:
    """EDGAR lists a Form 4's formatted page ("xslF345X06/form4.xml"); the XML itself sits one level up."""
    return primary_document.split("/", 1)[1] if primary_document.startswith("xsl") else primary_document


def insider_activity(cik: int, submissions: dict[str, Any], fetch_text: Callable[[str], str],
                     cache_get: Callable[[str], Any], cache_set: Callable[[str, Any], None],
                     today: date | None = None) -> dict[str, Any] | None:
    """Summary of open-market insider buys and sales in the 12 months up to `today`, from the company's Form 4s.

    fetch_text(url) -> str downloads a document; cache_get/cache_set(accession[, value]) keep parsed filings (a
    filed Form 4 never changes). Returns None when the company has no insider filings in the window.
    """
    today = today or date.today()
    since = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    recent = submissions["filings"]["recent"]
    rows = [(recent["filingDate"][i], recent["accessionNumber"][i], recent["primaryDocument"][i])
            for i, form in enumerate(recent["form"])
            if form in FORMS and since <= recent["filingDate"][i] <= today.isoformat()]
    if not rows:
        return None
    rows.sort(reverse=True)
    considered = rows[:MAX_FILINGS]

    parsed: dict[str, dict[str, Any]] = {}
    missing: list[tuple[str, str]] = []
    for _, accession, doc in considered:
        hit = cache_get(accession)
        if hit is not None:
            parsed[accession] = hit
        else:
            missing.append((accession, doc))

    started, out_of_time = time.monotonic(), False

    def load(item: tuple[str, str]) -> tuple[str, dict[str, Any] | None]:
        nonlocal out_of_time
        accession, doc = item
        if time.monotonic() - started > TIME_BUDGET:
            out_of_time = True
            return accession, None
        folder = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession.replace('-', '')}/"
        try:
            result = parse_form4(fetch_text(folder + _raw_xml_path(doc)))
        except Exception:  # noqa: BLE001 - one unreadable filing mustn't hide the others
            return accession, None
        cache_set(accession, result)
        return accession, result

    if missing:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for accession, result in pool.map(load, missing):
                if result is not None:
                    parsed[accession] = result

    trades = []
    for filed, accession, doc in considered:
        filing = parsed.get(accession)
        if not filing:
            continue
        if filing.get("issuer") and filing["issuer"] != str(cik):
            # The company's own filing list also holds Form 4s it files as an investor in *another* company
            # (Coca-Cola reporting as a 10% owner elsewhere): those aren't trades in this company's stock.
            continue
        url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession.replace('-', '')}/{doc}"
        for t in filing["trades"]:
            if t["date"] < since:
                continue  # an old trade reported late
            value = round(t["shares"] * t["price"]) if t["price"] else None
            trades.append({**t, "value": value, "name": filing["name"], "role": filing["role"],
                           "planned": filing["planned"] and t["type"] == "sell", "filed": filed, "url": url})
    trades.sort(key=lambda t: (t["date"], t["filed"]), reverse=True)

    def total(kind: str) -> dict[str, Any]:
        own = [t for t in trades if t["type"] == kind]
        return {"count": len(own), "shares": sum(t["shares"] for t in own),
                "value": sum(t["value"] or 0 for t in own), "insiders": len({t["name"] for t in own})}

    sells = total("sell")
    sells["planned"] = sum(1 for t in trades if t["type"] == "sell" and t["planned"])
    return {
        "since": since,
        "until": today.isoformat(),
        "filings": len(considered),
        "totalFilings": len(rows),
        "read": len(parsed),
        "partial": len(parsed) < len(rows),  # capped at MAX_FILINGS, out of time, or a filing couldn't be read
        "timedOut": out_of_time,
        "buys": total("buy"),
        "sells": sells,
        "trades": trades[:SHOWN_TRADES],
    }
