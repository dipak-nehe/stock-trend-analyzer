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
    "researchAndDevelopment": ("duration", [
        ("us-gaap", "ResearchAndDevelopmentExpense"),
        ("us-gaap", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"),
        ("ifrs-full", "ResearchAndDevelopmentExpense"),
    ]),
    # For the "Durable advantage" checklist: overheads and depreciation against gross profit
    "_sga": ("duration", [("us-gaap", "SellingGeneralAndAdministrativeExpense")]),
    "_sellingMarketing": ("duration", [("us-gaap", "SellingAndMarketingExpense")]),
    "_generalAdmin": ("duration", [("us-gaap", "GeneralAndAdministrativeExpense")]),
    "depreciation": ("duration", [
        ("us-gaap", "DepreciationDepletionAndAmortization"),
        ("us-gaap", "DepreciationAndAmortization"),
        ("us-gaap", "DepreciationAmortizationAndAccretionNet"),
        ("us-gaap", "Depreciation"),
        ("ifrs-full", "DepreciationAndAmortisationExpense"),
    ]),
    # Pre-tax income and income tax give each year's effective tax rate, for return on invested capital
    "pretaxIncome": ("duration", [
        ("us-gaap", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"),
        ("us-gaap", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"),
        ("ifrs-full", "ProfitLossBeforeTax"),
    ]),
    "incomeTax": ("duration", [
        ("us-gaap", "IncomeTaxExpenseBenefit"),
        ("ifrs-full", "IncomeTaxExpenseContinuingOperations"),
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
    # Intangible assets other than goodwill (brands, licences, customer lists...), for Buffett's return on tangible
    # capital. Some filers give one total, others only the finite-lived and indefinite-lived parts.
    # Equity details for the "Durable advantage" checklist
    "retainedEarnings": ("instant", [
        ("us-gaap", "RetainedEarningsAccumulatedDeficit"),
        ("ifrs-full", "RetainedEarnings"),
    ]),
    "treasuryStock": ("instant", [  # shares bought back and held (cost, a positive number); 0 if they're cancelled
        ("us-gaap", "TreasuryStockValue"),
        ("us-gaap", "TreasuryStockCommonValue"),
        ("ifrs-full", "TreasuryShares"),
    ]),
    "preferredStock": ("instant", [
        ("us-gaap", "PreferredStockValue"),
        ("us-gaap", "PreferredStockValueOutstanding"),
    ]),
    "_intangTotal": ("instant", [
        ("us-gaap", "IntangibleAssetsNetExcludingGoodwill"),
        ("ifrs-full", "IntangibleAssetsOtherThanGoodwill"),
    ]),
    "_intangFinite": ("instant", [("us-gaap", "FiniteLivedIntangibleAssetsNet")]),
    "_intangIndefinite": ("instant", [
        ("us-gaap", "IndefiniteLivedIntangibleAssetsExcludingGoodwill"),
        ("us-gaap", "IndefiniteLivedTrademarks"),  # e.g. Coca-Cola, which tags only its brands
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


QUARTERLY_FORMS: set[str] = {"10-Q", "10-Q/A"}


def _periods(facts: Facts, taxonomy: str, concept: str, currency: str) -> dict[tuple[str, str], float]:
    """{(start, end): value} for every period reported in annual or quarterly reports; the latest filing wins."""
    node = facts.get(taxonomy, {}).get(concept)
    unit = node and _pick_unit(node["units"], currency)
    if not unit:
        return {}
    best: dict[tuple[str, str], tuple[float, str]] = {}
    for f in node["units"][unit]:
        if f.get("form") in ANNUAL_FORMS | QUARTERLY_FORMS and "start" in f and "end" in f:
            key = (f["start"], f["end"])
            if key not in best or f["filed"] > best[key][1]:
                best[key] = (f["val"], f["filed"])
    return {k: v for k, (v, _) in best.items()}


def trailing_twelve_months(facts: Facts, taxonomy: str, concept: str, currency: str) -> tuple[float, str] | None:
    """(value, period_end) for the latest twelve months of an income or cash-flow figure:
    the last fiscal year + this year's year-to-date - the same stretch of the year before.
    None unless a quarterly report newer than the last annual report gives a year-to-date figure."""
    p = _periods(facts, taxonomy, concept, currency)
    days = lambda s, e: (_d(e) - _d(s)).days  # noqa: E731
    years = [k for k in p if 330 <= days(*k) <= 380]
    if not years:
        return None
    fy = max(years, key=lambda k: k[1])
    # year-to-date periods (3, 6 or 9 months) that start where that fiscal year ended
    ytd = [k for k in p if abs(days(fy[1], k[0]) - 1) <= 7 and 80 <= days(*k) <= 300]
    if not ytd:
        return None
    cur = max(ytd, key=lambda k: k[1])
    span = days(*cur)
    prior = [k for k in p if abs(days(fy[0], k[0])) <= 7 and abs(days(*k) - span) <= 7]
    if not prior:
        return None
    return p[fy] + p[cur] - p[prior[0]], cur[1]


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
