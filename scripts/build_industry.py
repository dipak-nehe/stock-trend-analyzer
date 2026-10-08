"""Build public/data/industry.json: typical ratios for every SEC industry, for the "Compared with its industry" card.

Run monthly by .github/workflows/industry.yml (or by hand):  SEC_USER_AGENT="App you@example.com" python3 scripts/build_industry.py
Free SEC data only:
  - industry codes (SIC) of every filer: the `sub.txt` list inside SEC's quarterly Financial Statement Data Sets
  - one figure for every company per calendar year: SEC's XBRL "frames" API
For each industry (4-, 3- and 2-digit SIC) it stores, per ratio, how many companies have it and the 25th, 50th
(median) and 75th percentiles. Medians, so a few extreme companies can't skew an industry.
"""
import io
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date
from statistics import quantiles

UA = os.environ.get("SEC_USER_AGENT", "")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data", "industry.json")
MIN_REVENUE = 1e6      # leave out shells and blank-check companies with no real sales
MIN_COMPANIES = 5      # fewer than this and a ratio isn't stored for that group
try:  # some Python installs (e.g. python.org on macOS) lack root certificates; certifi supplies them
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
REVENUE_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"]


def get(url: str, retries: int = 3) -> bytes:
    if not UA:
        sys.exit("Set SEC_USER_AGENT (e.g. 'App you@example.com'), as SEC requires")
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
                time.sleep(0.15)  # stay well under SEC's limit of 10 requests a second
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 404 or attempt == retries - 1:  # missing is final; other errors get retried
                raise
            time.sleep(3)
        except Exception:  # noqa: BLE001 - retry, then let it fail loudly
            if attempt == retries - 1:
                raise
            time.sleep(3)
    raise RuntimeError(url)


def frame(concept: str, period: str) -> dict[int, float]:
    """{cik: value} for one us-gaap concept in one calendar period (e.g. CY2025, or CY2025Q4I for a year-end balance).
    Empty when SEC has no such frame (e.g. a retired tag like SalesRevenueNet in recent years)."""
    try:
        data = json.loads(get(f"https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/{period}.json"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {}
        raise
    return {row["cik"]: row["val"] for row in data["data"]}


def industry_codes(year: int) -> dict[int, str]:
    """{cik: 4-digit SIC} from the data sets' filer lists for the quarters in which annual reports for `year` were filed."""
    sic: dict[int, str] = {}
    for q in [f"{year + 1}q1", f"{year + 1}q2", f"{year}q4", f"{year + 1}q3"]:
        try:
            raw = get(f"https://www.sec.gov/files/dera/data/financial-statement-data-sets/{q}.zip")
        except Exception:  # noqa: BLE001 - a quarter not published yet
            continue
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


def latest_full_year() -> int:
    """The most recent calendar year with net income reported by most companies (annual reports arrive into spring)."""
    for year in (date.today().year - 1, date.today().year - 2):
        if len(frame("NetIncomeLoss", f"CY{year}")) >= 4000:
            return year
    raise RuntimeError("no recent calendar year with enough annual reports")


def summarise(values: list[float]) -> dict[str, float] | None:
    if len(values) < MIN_COMPANIES:
        return None
    q1, med, q3 = quantiles(values, n=4, method="inclusive")
    return {"n": len(values), "p25": round(q1, 4), "median": round(med, 4), "p75": round(q3, 4)}


def main() -> None:
    year = int(sys.argv[1]) if len(sys.argv) > 1 else latest_full_year()
    print(f"calendar year {year}")
    revenue, revenue_prev = {}, {}
    for tag in REVENUE_TAGS:  # first tag a company uses wins
        for cik, v in frame(tag, f"CY{year}").items():
            revenue.setdefault(cik, v)
        for cik, v in frame(tag, f"CY{year - 1}").items():
            revenue_prev.setdefault(cik, v)
    net, operating, gross, rnd = (frame(c, f"CY{year}") for c in
                                  ("NetIncomeLoss", "OperatingIncomeLoss", "GrossProfit", "ResearchAndDevelopmentExpense"))
    equity, cur_assets, cur_liab = (frame(c, f"CY{year}Q4I") for c in ("StockholdersEquity", "AssetsCurrent", "LiabilitiesCurrent"))
    sic = industry_codes(year)
    print(f"{len(revenue)} companies with revenue, {len(sic)} industry codes")

    # Banks, insurers and other financial firms (SIC 6000-6799) report "revenue" in ways margins and current ratios
    # don't fit, so only growth and return on equity are kept for them.
    financial = {cik for cik, code in sic.items() if "6000" <= code <= "6799"}
    names = ("netMargin", "operatingMargin", "grossMargin", "revenueGrowth", "roe", "currentRatio", "rdIntensity")
    ratios: dict[str, dict[int, float]] = {k: {} for k in names}
    put = lambda name, cik, value: ratios[name].__setitem__(cik, value)  # noqa: E731
    for cik, rev in revenue.items():
        if rev < MIN_REVENUE:
            continue
        if revenue_prev.get(cik, 0) >= MIN_REVENUE:
            put("revenueGrowth", cik, rev / revenue_prev[cik] - 1)
        if cik in net and equity.get(cik, 0) > 0:
            put("roe", cik, net[cik] / equity[cik])
        if cik in financial:
            continue
        for name, figure in (("netMargin", net), ("operatingMargin", operating), ("grossMargin", gross), ("rdIntensity", rnd)):
            if cik in figure:
                put(name, cik, figure[cik] / rev)
        if cik in cur_assets and cur_liab.get(cik, 0) > 0:
            put("currentRatio", cik, cur_assets[cik] / cur_liab[cik])

    members: dict[str, set[int]] = {}
    for cik in revenue:
        code = sic.get(cik)
        if code and revenue[cik] >= MIN_REVENUE:
            for key in (f"4:{code}", f"3:{code[:3]}", f"2:{code[:2]}"):
                members.setdefault(key, set()).add(cik)
    groups = {}
    for key, ciks in sorted(members.items()):
        stats = {name: s for name, vals in ratios.items() if (s := summarise([vals[c] for c in ciks if c in vals]))}
        if stats:
            groups[key] = {"companies": len(ciks), **stats}
    out = {"year": year, "generated": date.today().isoformat(),
           "source": "SEC XBRL frames and Financial Statement Data Sets (filer SIC codes)", "groups": groups}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"{len(groups)} industry groups -> {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
