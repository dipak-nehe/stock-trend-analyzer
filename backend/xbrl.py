"""Reading SEC XBRL "company facts": which figures a company reported, for which fiscal years.

Pure functions of the downloaded facts (no network, no storage), used by stock_data.build_financials: the metric
definitions (CONCEPTS), annual values with restatements, stock-split detection, reporting currency, fiscal years
and the latest share count.
"""
from datetime import date
from itertools import pairwise
from typing import Any

Facts = dict[str, Any]  # {"us-gaap": {concept: {"units": {unit: [fact, ...]}}}, "dei": ..., "ifrs-full": ...}

ANNUAL_FORMS: set[str] = {"10-K", "10-K/A", "10-KT", "20-F", "20-F/A", "40-F", "40-F/A"}

# metric -> (kind, [(taxonomy, concept), ...]) in priority order.
# "duration" = income/cash-flow items (one fiscal year), "instant" = balance sheet.
CONCEPTS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "revenue": ("duration", [
        ("us-gaap", "Revenues"),
        ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"),
        ("us-gaap", "RevenueFromContractWithCustomerIncludingAssessedTax"),
        ("us-gaap", "SalesRevenueNet"),
        ("us-gaap", "SalesRevenueGoodsNet"),
        ("us-gaap", "RevenuesNetOfInterestExpense"),
        ("ifrs-full", "Revenue"),
        ("ifrs-full", "RevenueFromContractsWithCustomers"),  # IFRS 15 name, used from 2018-19 (e.g. Infosys)
    ]),
    "netIncome": ("duration", [
        ("us-gaap", "NetIncomeLoss"),
        ("us-gaap", "NetIncomeLossAvailableToCommonStockholdersBasic"),
        ("us-gaap", "ProfitLoss"),
        ("ifrs-full", "ProfitLossAttributableToOwnersOfParent"),
        ("ifrs-full", "ProfitLoss"),
    ]),
    "grossProfit": ("duration", [("us-gaap", "GrossProfit"), ("ifrs-full", "GrossProfit")]),
    "operatingIncome": ("duration", [
        ("us-gaap", "OperatingIncomeLoss"),
        ("ifrs-full", "ProfitLossFromOperatingActivities"),
    ]),
    "eps": ("duration", [
        ("us-gaap", "EarningsPerShareDiluted"),
        ("us-gaap", "EarningsPerShareBasicAndDiluted"),
        ("us-gaap", "EarningsPerShareBasic"),
        ("ifrs-full", "DilutedEarningsLossPerShare"),
        ("ifrs-full", "BasicEarningsLossPerShare"),
    ]),
    "dps": ("duration", [
        ("us-gaap", "CommonStockDividendsPerShareDeclared"),
        ("us-gaap", "CommonStockDividendsPerShareCashPaid"),
    ]),
    "dividendsPaid": ("duration", [
        ("us-gaap", "PaymentsOfDividendsCommonStock"),
        ("us-gaap", "PaymentsOfDividends"),
        ("us-gaap", "DividendsCommonStockCash"),
        ("us-gaap", "DividendsCommonStock"),
        ("ifrs-full", "DividendsPaidClassifiedAsFinancingActivities"),
        ("ifrs-full", "DividendsPaid"),
    ]),
    "operatingCashFlow": ("duration", [
        ("us-gaap", "NetCashProvidedByUsedInOperatingActivities"),
        ("us-gaap", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"),
        ("ifrs-full", "CashFlowsFromUsedInOperatingActivities"),
    ]),
    "capex": ("duration", [
        ("us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"),
        ("us-gaap", "PaymentsToAcquireProductiveAssets"),
        ("ifrs-full", "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"),
    ]),
    "interestExpense": ("duration", [
        ("us-gaap", "InterestExpense"),
        ("us-gaap", "InterestExpenseNonoperating"),
        ("us-gaap", "InterestExpenseDebt"),
        ("ifrs-full", "FinanceCosts"),
    ]),
    "dilutedShares": ("duration", [
        ("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding"),
        ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic"),
        ("ifrs-full", "AdjustedWeightedAverageShares"),
        ("ifrs-full", "WeightedAverageShares"),
    ]),
    "totalAssets": ("instant", [("us-gaap", "Assets"), ("ifrs-full", "Assets")]),
    "totalLiabilities": ("instant", [("us-gaap", "Liabilities"), ("ifrs-full", "Liabilities")]),
    "equity": ("instant", [
        ("us-gaap", "StockholdersEquity"),
        ("us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
        ("ifrs-full", "EquityAttributableToOwnersOfParent"),
        ("ifrs-full", "Equity"),
    ]),
    "liabilitiesAndEquity": ("instant", [
        ("us-gaap", "LiabilitiesAndStockholdersEquity"),
        ("ifrs-full", "EquityAndLiabilities"),
    ]),
    "currentAssets": ("instant", [("us-gaap", "AssetsCurrent"), ("ifrs-full", "CurrentAssets")]),
    "currentLiabilities": ("instant", [("us-gaap", "LiabilitiesCurrent"), ("ifrs-full", "CurrentLiabilities")]),
    "cash": ("instant", [
        ("us-gaap", "CashAndCashEquivalentsAtCarryingValue"),
        ("us-gaap", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"),
        ("us-gaap", "Cash"),
        ("ifrs-full", "CashAndCashEquivalents"),
    ]),
    # Debt and liability building blocks, combined into consistent series in build_financials().
    # Companies switch tags over the years (e.g. total vs non-current only), so tags are never mixed
    # across definitions: each helper holds one definition.
    "_ltdTotal": ("instant", [  # long-term debt INCLUDING the portion due within a year
        ("us-gaap", "LongTermDebt"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"),
        ("ifrs-full", "Borrowings"),
    ]),
    "_ltdNoncurrent": ("instant", [  # long-term debt EXCLUDING the portion due within a year
        ("us-gaap", "LongTermDebtNoncurrent"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligations"),
        ("ifrs-full", "NoncurrentPortionOfNoncurrentBorrowings"),
    ]),
    "_ltdCurrent": ("instant", [  # portion of long-term debt due within a year
        ("us-gaap", "LongTermDebtCurrent"),
        ("us-gaap", "LongTermDebtAndCapitalLeaseObligationsCurrent"),
        ("ifrs-full", "CurrentPortionOfNoncurrentBorrowings"),
    ]),
    "_shortTermBorrowings": ("instant", [  # one tag only: ShortTermBorrowings usually already includes commercial paper
        ("us-gaap", "ShortTermBorrowings"),
        ("us-gaap", "CommercialPaper"),
        ("ifrs-full", "ShorttermBorrowings"),
    ]),
    "_equityInclNci": ("instant", [
        ("us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
        ("ifrs-full", "Equity"),
    ]),
    "_minorityInterest": ("instant", [
        ("us-gaap", "MinorityInterest"),
        ("ifrs-full", "NoncontrollingInterests"),
    ]),
    "goodwill": ("instant", [("us-gaap", "Goodwill"), ("ifrs-full", "Goodwill")]),
    "receivables": ("instant", [
        ("us-gaap", "AccountsReceivableNetCurrent"),
        ("ifrs-full", "TradeAndOtherCurrentReceivables"),
    ]),
    "inventory": ("instant", [("us-gaap", "InventoryNet"), ("ifrs-full", "Inventories")]),
}


def _d(s: str) -> date:
    return date.fromisoformat(s)


def reporting_currency(facts: Facts) -> str:
    """The currency the company reports in (most facts on its net income / revenue line)."""
    for metric in ("netIncome", "revenue"):
        for tax, concept in CONCEPTS[metric][1]:
            node = facts.get(tax, {}).get(concept)
            if node:
                return str(max(node["units"], key=lambda u: len(node["units"][u])))
    return "USD"


def _pick_unit(units: dict[str, Any], currency: str) -> str | None:
    for pref in (currency, f"{currency}/shares", "shares"):
        if pref in units:
            return pref
    return None  # only in some other currency (e.g. a convenience translation) - skip it


def _is_annual(f: dict[str, Any], kind: str) -> bool:
    if f.get("form") not in ANNUAL_FORMS or "end" not in f:
        return False
    if kind == "duration":
        return "start" in f and 330 <= (_d(f["end"]) - _d(f["start"])).days <= 380
    return "start" not in f


def annual_values(facts: Facts, taxonomy: str, concept: str, kind: str, currency: str) -> dict[str, tuple[float, str]]:
    """Return {period_end: (value, filed)} of annual values; the latest filing wins (restated)."""
    node = facts.get(taxonomy, {}).get(concept)
    unit = node and _pick_unit(node["units"], currency)
    if not unit:
        return {}
    best: dict[str, tuple[float, str]] = {}
    for f in node["units"][unit]:
        if _is_annual(f, kind):
            prev = best.get(f["end"])
            if prev is None or f["filed"] > prev[1]:
                best[f["end"]] = (f["val"], f["filed"])
    return best


NICE_SPLIT_RATIOS = (1.5, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50)


def split_events(facts: Facts, currency: str) -> list[tuple[str, float]]:
    """Detect stock splits from EPS values that were restated by a later filing.

    Returns [(first_filing_date_after_split, factor)]; factor > 1 is a forward split.
    Older, never-restated per-share values filed before that date must be divided by factor.
    """
    events: list[tuple[str, float]] = []
    for tax, concept in CONCEPTS["eps"][1]:
        node = facts.get(tax, {}).get(concept)
        unit = node and _pick_unit(node["units"], currency)
        if not unit:
            continue
        by_end: dict[str, list[tuple[str, float]]] = {}
        for f in node["units"][unit]:
            if _is_annual(f, "duration") and f["val"]:
                by_end.setdefault(f["end"], []).append((f["filed"], f["val"]))
        for reports in by_end.values():
            reports.sort()
            for (_, old), (filed, new) in pairwise(reports):
                r = old / new
                if r <= 0:
                    continue
                inv = r < 1
                x = 1 / r if inv else r
                nice = next((n for n in NICE_SPLIT_RATIOS if abs(x - n) / n < 0.03), None)
                if nice:
                    factor = 1 / nice if inv else nice
                    if not any(abs(factor - f0) < 1e-9 and abs((_d(filed) - _d(d0)).days) < 400
                               for d0, f0 in events):
                        events.append((filed, factor))
        if events:
            break
    # keep the earliest restating filing per split
    events.sort()
    return events


def latest_shares_outstanding(facts: Facts) -> tuple[str, str, float, str] | None:
    """Most recent common shares outstanding (cover page or balance sheet), summed across share classes."""
    best: tuple[str, str, float, str] | None = None  # (end, filed, value, source)
    for tax, concept in (("dei", "EntityCommonStockSharesOutstanding"), ("us-gaap", "CommonStockSharesOutstanding"),
                         ("ifrs-full", "NumberOfSharesOutstanding")):
        node = facts.get(tax, {}).get(concept)
        if not node or "shares" not in node["units"]:
            continue
        rows = node["units"]["shares"]
        end = max(r["end"] for r in rows)
        latest = [r for r in rows if r["end"] == end]
        accn = max(latest, key=lambda r: r["filed"])["accn"]
        same_filing = [r for r in latest if r["accn"] == accn]
        cand = (end, same_filing[0]["filed"], sum(r["val"] for r in same_filing), concept)
        if best is None or cand[:2] > best[:2]:
            best = cand
    return best


def fiscal_year_ends(facts: Facts, currency: str) -> dict[int, str]:
    """Fiscal year end dates, taken from annual income-statement periods."""
    ends: set[str] = set()
    for metric in ("netIncome", "revenue"):
        for tax, concept in CONCEPTS[metric][1]:
            ends.update(annual_values(facts, tax, concept, "duration", currency).keys())
    by_year: dict[int, str] = {}
    for e in sorted(ends):
        by_year[_d(e).year] = e  # later end wins if fiscal year changed
    return by_year  # {fiscal_year: 'YYYY-MM-DD'}


PER_SHARE: dict[str, int] = {"eps": -1, "dps": -1, "dilutedShares": 1}  # exponent applied to the split factor
