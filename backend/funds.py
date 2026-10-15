"""US mutual funds and ETFs from their SEC filings: the "Funds" page (funds.html), GET /api/fund?ticker=VFIAX.

Every fund share class files a tailored shareholder report (Form N-CSR, required since mid-2024) whose figures are
tagged in XBRL. The latest annual report gives, for each share class:
  - expense ratio, the costs paid on a $10,000 investment, and the adviser's fees
  - average annual total return over 1, 5 and 10 years (without sales charges), and the same for the fund's
    broad-based index, so the fund can be set against the market
  - net assets, number of holdings, portfolio turnover, and how the portfolio splits (by sector, asset type, region,
    credit quality: whichever the fund reports)
Lookups: SEC's fund ticker list (ticker -> CIK, series, class), then EDGAR's filing list for the series.
No prices: the reports give returns, and today's price is looked up elsewhere, as on the stock pages.
Funds that don't file N-CSR shareholder reports (unit investment trusts such as SPY, QQQ and DIA) are reported
as not covered.
"""
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from typing import Any

from . import stock_data as sd

FUND_TICKERS_URL = "https://www.sec.gov/files/company_tickers_mf.json"
CACHE_VERSION = "f1"
FRESH_SECONDS = 7 * 24 * 3600       # reports come twice a year (annual and semi-annual): a week is plenty
KEEP_SECONDS = 400 * 24 * 3600
X = "{http://www.xbrl.org/2003/instance}"
DIM = "{http://xbrl.org/2006/xbrldi}explicitMember"
# Which split of the portfolio to show, in order of preference, when a fund reports several
BREAKDOWN_AXES = ["IndustrySectorAxis", "GeographicRegionAxis", "AssetClassAxis", "InvestmentTypeAxis", "CreditQualityAxis",
                  "MaturityAxis", "CountryRegionAxis"]
MIN_BREAKDOWN_ROWS = 3   # a split into one or two lines ("Other assets") says nothing


class NotCoveredError(Exception):
    """The fund has no tagged shareholder report to read (e.g. a unit investment trust such as SPY)."""


# ---------- parsing (pure: tested on saved reports) ----------

def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _member_label(member: str) -> str:
    """'nacc2:SectorInformationTechnologySectorMember' -> 'Information Technology' (a readable fallback name)."""
    name = member.split(":", 1)[-1]
    name = re.sub(r"Member$", "", name)
    name = re.sub(r"^(Sector)(.+?)Sector$", r"\2", name)
    name = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", name)
    return name.strip()


def _num(text: str | None) -> float | None:
    try:
        return float((text or "").strip())
    except ValueError:
        return None


def _clean_label(text: str) -> str:
    """'MS Financials Sector' -> 'Financials', 'Information Technology Sector' -> 'Information Technology'."""
    text = re.sub(r"\s+", " ", text.replace("&amp;", "&")).strip()
    text = re.sub(r"^MS ", "", text)
    return re.sub(r" Sector$", "", text)


def parse_report(xml: bytes | str, class_id: str) -> dict[str, Any] | None:
    """The figures for one share class (e.g. 'C000007774') from a shareholder report's XBRL instance, or None if
    the report doesn't cover it. Returns are fractions (0.1478 = 14.78%).

    A report covers several share classes (often several funds), one section each, and its facts come in report
    order. The indexes a class is measured against are the ones named in its own section; index names are shared
    between sections, so their returns are looked up by name afterwards. Fidelity tags a class's own returns as an
    'additional index' whose name contains the class id: those count as the class's returns.
    """
    root = ET.fromstring(xml)
    contexts: dict[str, tuple[dict[str, str], str, str]] = {}
    for c in root.iter(f"{X}context"):
        # dimension="oef:ClassAxis" -> "ClassAxis" (a prefixed name, not {namespace}name)
        dims = {(m.get("dimension") or "").split(":")[-1]: (m.text or "").strip() for m in c.iter(DIM)}
        period = c.find(f"{X}period")
        start = period.findtext(f"{X}startDate") if period is not None else None
        end = (period.findtext(f"{X}endDate") or period.findtext(f"{X}instant")) if period is not None else None
        contexts[c.get("id") or ""] = (dims, start or "", end or "")

    facts = []
    for el in root:
        ctx_id = el.get("contextRef")
        if ctx_id and ctx_id in contexts:
            facts.append((_local(el.tag), (el.text or "").strip(), *contexts[ctx_id]))

    mine = f"{class_id}Member"
    is_mine = lambda member: member.endswith(mine)  # noqa: E731
    own_return_member = lambda member: class_id in member and "Index" not in member  # Fidelity's tagging  # noqa: E731
    out: dict[str, Any] = {"returns": {}, "indexes": [], "breakdown": None, "topHoldings": None}
    labels: dict[str, str] = {}
    breakdowns: dict[str, dict[str, float]] = {}
    section_indexes: list[tuple[str, str]] = []   # (member, "broad" | "additional"), in report order
    legend_indexes: list[tuple[str, str]] = []    # the same, from the performance chart's legend only
    current = ""
    legend_class = ""
    found = False
    for name, text, dims, start, end in facts:
        index_member = dims.get("BroadBasedIndexAxis") or dims.get("AdditionalIndexAxis")
        if name == "LineGraphAndTableMeasureName":
            # The chart legend lists a class, then the indexes it's set against
            if dims.get("ClassAxis"):
                legend_class = dims["ClassAxis"]
            elif index_member:
                labels.setdefault(_base_member(index_member), text)
                kind = "broad" if dims.get("BroadBasedIndexAxis") else "additional"
                if is_mine(legend_class) and (index_member, kind) not in legend_indexes:
                    legend_indexes.append((index_member, kind))
        if dims.get("ClassAxis"):
            current = dims["ClassAxis"]
        elif index_member and is_mine(current) and not own_return_member(index_member):
            kind = "broad" if dims.get("BroadBasedIndexAxis") else "additional"
            if (index_member, kind) not in section_indexes:
                section_indexes.append((index_member, kind))
        if index_member and own_return_member(index_member) and name == "AvgAnnlRtrPct":
            years = _years(start, end)
            if years and _num(text) is not None:
                out["returns"].setdefault(str(years), _num(text))
                out["periodEnd"] = max(out.get("periodEnd", ""), end)
            found = True
            continue
        if not is_mine(dims.get("ClassAxis", "")):
            continue
        found = True
        value = _num(text)
        if name == "FundName":
            out["fund"] = text
        elif name == "ClassName":
            out["shareClass"] = text
        elif name in SIMPLE and value is not None:
            out[SIMPLE[name]] = value
            if name == "AssetsNet":
                out["asOf"] = end
        elif name == "AvgAnnlRtrPct" and dims.get("SalesLoadAxis", "WithoutSalesLoadMember").endswith("WithoutSalesLoadMember"):
            years = _years(start, end)
            if years and value is not None:
                out["returns"].setdefault(str(years), value)
                out["periodEnd"] = max(out.get("periodEnd", ""), end)
        elif name == "PctOfNav" and value is not None:
            if "LargestHoldingAxis" in dims:
                breakdowns.setdefault("LargestHoldingAxis", {}).setdefault(dims["LargestHoldingAxis"], value)
            else:
                axis = next((a for a in BREAKDOWN_AXES if a in dims), None)
                if axis:
                    breakdowns.setdefault(axis, {}).setdefault(dims[axis], value)
    if not found:
        return None

    # The indexes this class is set against (from its chart legend, else from its section), with their returns
    # over the same periods. Fidelity names one index per period (..._1YRMember, _5YR, _10YR): merged by base name.
    period_end = out.get("periodEnd")
    merged: dict[tuple[str, str], dict[str, float]] = {}
    for member, kind in (legend_indexes or section_indexes):
        base = _base_member(member)
        returns = merged.setdefault((base, kind), {})
        for name, text, dims, start, end in facts:
            other = dims.get("BroadBasedIndexAxis") or dims.get("AdditionalIndexAxis") or ""
            if name == "AvgAnnlRtrPct" and other and _base_member(other) == base and (not period_end or end == period_end):
                years, value = _years(start, end), _num(text)
                if years and value is not None:
                    returns.setdefault(str(years), value)
    for (base, kind), returns in merged.items():
        label = _clean_label(labels.get(base, ""))
        if not label or class_id in label or re.search(r"C\d{9}", label):
            label = ""   # an internal id rather than a name: the page says "broad market index"
        entry = {"name": label, "kind": kind, "returns": returns}
        if returns and entry not in out["indexes"]:
            out["indexes"].append(entry)

    for axis in BREAKDOWN_AXES:
        rows = breakdowns.get(axis)
        if rows and len(rows) >= MIN_BREAKDOWN_ROWS:
            out["breakdown"] = {"by": axis.replace("Axis", ""),
                                "rows": sorted(([_clean_label(_member_label(m)), v] for m, v in rows.items()), key=lambda r: -r[1])}
            break
    # Concentration: the share of the fund in its largest holdings (their names are tagged too inconsistently to show)
    top = breakdowns.get("LargestHoldingAxis")
    if top and len(top) >= 5:
        out["topHoldings"] = {"count": len(top), "pct": round(sum(top.values()), 4)}
    return out


def _base_member(member: str) -> str:
    """'fmr:C000100045_0_BBIndexMember_5YRMember' -> 'fmr:C000100045_0_BBIndexMember' (one index per period)."""
    return re.sub(r"_\d+YRMember$", "", member)


# Single figures for a class: XBRL name -> field
SIMPLE = {"ExpenseRatioPct": "expenseRatio", "ExpensesPaidAmt": "costPer10k", "AssetsNet": "netAssets",
          "HoldingsCount": "holdings", "InvestmentCompanyPortfolioTurnover": "turnover", "AdvisoryFeesPaidAmt": "advisoryFees"}


def _years(start: str, end: str) -> int | None:
    """1, 5 or 10 for a return period (a 'since inception' period of another length is left out)."""
    if len(start) < 7 or len(end) < 7:
        return None
    months = (int(end[:4]) * 12 + int(end[5:7])) - (int(start[:4]) * 12 + int(start[5:7])) + 1
    return next((n for n in (1, 5, 10) if abs(months - 12 * n) <= 1), None)


# ---------- lookups (network) ----------

def fund_table() -> dict[str, list[Any]]:
    """{TICKER: [cik, series id, class id]} from SEC's fund ticker list, stored for a week."""
    key = f"{CACHE_VERSION}:fundtickers"
    table: dict[str, list[Any]] | None = sd.safe_get(key)
    if table is None:
        raw = sd.sec_get(FUND_TICKERS_URL)
        table = {row[3].upper(): [row[0], row[1], row[2]] for row in raw["data"] if row[3]}
        sd.safe_set(key, table, sd.TICKERS_SECONDS)
    return table


def latest_report(series_id: str) -> tuple[str, str, str] | None:
    """(form, filing date, folder URL) of the series' latest shareholder report: the annual N-CSR if there is one
    in the last 13 months (it has the 1/5/10-year returns), else the semi-annual N-CSRS."""
    atom = sd.sec_get_text("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK="
                           f"{series_id}&type=N-CSR&dateb=&owner=include&count=10&output=atom")
    entries = re.findall(r"<filing-date>([^<]+)</filing-date>\s*<filing-href>([^<]+)</filing-href>\s*"
                         r"(?:<[^>]+>[^<]*</[^>]+>\s*)*?<filing-type>([^<]+)</filing-type>", atom)
    if not entries:
        # the fields can come in another order: read each <entry> separately
        entries = []
        for block in re.findall(r"<entry>(.*?)</entry>", atom, re.S):
            d = re.search(r"<filing-date>([^<]+)", block)
            h = re.search(r"<filing-href>([^<]+)", block)
            ty = re.search(r"<filing-type>([^<]+)", block)
            if d and h and ty:
                entries.append((d.group(1), h.group(1), ty.group(1)))
    annual = [e for e in entries if e[2].strip() == "N-CSR"]
    pick = annual[0] if annual else (entries[0] if entries else None)
    if not pick:
        return None
    date, href, form = pick
    return form.strip(), date.strip(), href.rsplit("/", 1)[0] + "/"


def report_xml(folder: str) -> bytes:
    """The XBRL instance of a filing (the '..._htm.xml' file next to the report)."""
    listing = sd.sec_get(folder + "index.json")
    names = [i["name"] for i in listing.get("directory", {}).get("item", [])]
    xml = next((n for n in names if n.endswith("_htm.xml")), None)
    if not xml:
        raise NotCoveredError("no tagged report in the filing")
    return sd.sec_get_text(folder + xml).encode("utf-8")


def build_fund(ticker: str) -> dict[str, Any] | None:
    row = fund_table().get(sd.normalize_ticker(ticker))
    if not row:
        return None
    cik, series, cls = row
    found = latest_report(series)
    if not found:
        raise NotCoveredError("no shareholder report")
    form, filed, folder = found
    data = parse_report(report_xml(folder), cls)
    if not data or data.get("expenseRatio") is None:
        raise NotCoveredError("the report has no tagged figures for this share class")
    data.update({"ticker": sd.normalize_ticker(ticker), "cik": cik, "seriesId": series, "classId": cls,
                 "form": form, "filed": filed, "reportUrl": folder})
    return data


# ---------- the endpoint ----------

def fund_response(ticker: str, now: Callable[[], float] = time.time) -> sd.Response:
    """Handle one /api/fund request. Same return shape as stock_data.api_response."""
    ticker = (ticker or "").strip()
    if not sd.TICKER_RE.match(ticker):
        return 400, {"error": "That doesn't look like a fund ticker."}, sd.CACHE_NONE, None
    key = f"{CACHE_VERSION}:fund:{sd.normalize_ticker(ticker)}"
    stored = sd.safe_get(key)
    if stored and now() - stored["fetchedTs"] < FRESH_SECONDS:
        return 200, stored["data"], sd.CACHE_OK, "HIT"
    try:
        data = build_fund(ticker)
        if data is None:
            return 404, {"error": f"'{ticker.upper()}' isn't in SEC's list of mutual fund and ETF tickers."}, sd.CACHE_NOT_FOUND, None
    except NotCoveredError:
        return 404, {"error": f"{ticker.upper()} doesn't file the tagged shareholder reports this page reads "
                     "(unit investment trusts such as SPY, QQQ and DIA don't)."}, sd.CACHE_NOT_FOUND, None
    except sd.ConfigError as e:
        return 500, {"error": str(e)}, sd.CACHE_NONE, None
    except Exception:  # noqa: BLE001 - SEC unreachable or limiting: an older copy beats none
        sd.log.exception("fund lookup failed for %s", ticker)
        if stored:
            return 200, {**stored["data"], "stale": True}, sd.CACHE_NONE, "STALE"
        return 502, {"error": "The fund's report couldn't be loaded from SEC EDGAR right now."}, sd.CACHE_NONE, None
    sd.safe_set(key, {"fetchedTs": now(), "data": data}, KEEP_SECONDS)
    return 200, data, sd.CACHE_OK, "MISS"
