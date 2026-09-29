"""The company's filing list (EDGAR "submissions"): its notable filings and its latest report.

Pure functions of the filing list; downloading is passed in (stock_data.filing_history does that).
Notable filings are the 8-K items in EIGHT_K_ITEMS, late-filing notices, amended annual reports and SEC letters.
"""
from collections.abc import Callable
from typing import Any

from .xbrl import ANNUAL_FORMS

Submissions = dict[str, Any]  # {"filings": {"recent": {column: [value, ...]}, "files": [...]}, "sicDescription": ...}

AMENDMENT_FORMS: set[str] = {"10-K/A", "20-F/A", "40-F/A"}
# Reports that can change the figures we show: annual reports (the yearly numbers) and quarterly reports
# (the latest share count). A new one of these means the stored figures must be refreshed.
FINANCIAL_FORMS: set[str] = ANNUAL_FORMS | {"10-Q", "10-Q/A", "10-QT"}


def financial_marker(sub: Submissions) -> str | None:
    """Identifies the latest annual or quarterly report, e.g. "2026-08-01:0000320193-26-000020"."""
    t = sub["filings"]["recent"]
    latest = max(((t["filingDate"][i], t["accessionNumber"][i]) for i, form in enumerate(t["form"]) if form in FINANCIAL_FORMS),
                 default=None)
    return f"{latest[0]}:{latest[1]}" if latest else None


def latest_report(cik: int, sub: Submissions) -> dict[str, str] | None:
    """The most recent annual or quarterly report, for "new report filed" alerts in the Android app."""
    t = sub["filings"]["recent"]
    found = [i for i, form in enumerate(t["form"]) if form in FINANCIAL_FORMS]
    if not found:
        return None
    i = max(found, key=lambda j: (t["filingDate"][j], t["accessionNumber"][j]))
    folder = f"https://www.sec.gov/Archives/edgar/data/{cik}/{t['accessionNumber'][i].replace('-', '')}/"
    doc = t["primaryDocument"][i] if "primaryDocument" in t else ""
    return {"form": t["form"][i], "date": t["filingDate"][i], "accession": t["accessionNumber"][i],
            "url": folder + doc if doc else folder}


# 8-K items reported as events, in the order a filing's events are listed. Items not here (earnings releases,
# votes, routine officer and pay changes under 5.02) are too frequent to be signals.
EIGHT_K_ITEMS: dict[str, tuple[str, str]] = {
    "4.02": ("non_reliance", "Company said earlier financial statements should no longer be relied on"),
    "4.01": ("auditor_change", "Change in the company's independent auditor"),
    "1.03": ("bankruptcy", "Bankruptcy or receivership"),
    "3.01": ("delisting_notice", "Stock exchange notice: delisting, or a listing rule not met"),
    "1.05": ("cyber_incident", "Material cybersecurity incident"),
    "2.06": ("impairment", "Material impairment (a large write-down of assets)"),
    "2.01": ("acquisition", "Completed a significant acquisition or sale of assets"),
}


def _classify_filing(form: str, items: str | None) -> list[tuple[str, str]]:
    """Map one filing to its notable events: a list of (type, description), empty if none.
    An 8-K can report several items at once (a restatement with a write-down, say), so each counts."""
    if form in ("8-K", "8-K/A"):
        found = {i.strip() for i in (items or "").split(",")}
        return [event for item, event in EIGHT_K_ITEMS.items() if item in found]
    if form.startswith("NT "):
        return [("late_filing", f"Notice of late filing: couldn't file its {form[3:]} on time")]
    if form in AMENDMENT_FORMS:
        return [("amendment", f"Amended annual report ({form[:-2]})")]
    if form == "UPLOAD":
        return [("sec_letter", "SEC staff letter from a filing review")]
    if form == "CORRESP":
        return [("company_response", "Company letter to SEC staff (usually a response to review comments)")]
    return []


def filing_history(cik: int, since: str, sub: Submissions, fetch: Callable[[str], Any]) -> dict[str, Any]:
    """Notable filings on or after `since` (YYYY-MM-DD) from EDGAR's submissions index. `fetch(url)` downloads the
    older pages of the list, when they overlap the window."""
    base = "https://data.sec.gov/submissions/"
    tables = [sub["filings"]["recent"]]
    for f in sub["filings"].get("files", []):
        if f.get("filingTo", "") >= since:  # older pages, only if they overlap the window
            tables.append(fetch(base + f["name"]))
    events: list[dict[str, str]] = []
    for t in tables:
        for i, form in enumerate(t["form"]):
            filed = t["filingDate"][i]
            if filed < since:
                continue
            kinds = _classify_filing(form, t["items"][i] if "items" in t else "")
            if not kinds:
                continue
            accn = t["accessionNumber"][i].replace("-", "")
            doc = t["primaryDocument"][i]
            folder = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accn}/"
            for kind, description in kinds:
                events.append({"date": filed, "type": kind, "form": form, "description": description,
                               "url": folder + doc if doc else folder})
    events.sort(key=lambda e: e["date"], reverse=True)
    counts: dict[str, int] = {}
    for e in events:
        counts[e["type"]] = counts.get(e["type"], 0) + 1
    return {"since": since, "events": events, "counts": counts,
            "industry": sub.get("sicDescription") or None,
            "filingsUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=&dateb=&owner=include&count=40"}
