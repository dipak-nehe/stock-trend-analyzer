Feature: Annual figures from XBRL company facts
  For each metric the app keeps one full-year value per fiscal year from annual reports, prefers the
  latest (restated) filing, tries alternative XBRL tags in turn, adjusts for stock splits and keeps the
  company's reporting currency. Each scenario uses a small hand-built company, TEST: its net income for
  2016-2025 defines the ten years analysed. Values are in USD unless a scenario says otherwise.

  # ---------- The right value is picked for each year ----------

  Scenario: The latest filing wins, so restated values are used
    Given a company that reported net income for 2016 to 2025
    And 2020 revenue of 1000 filed on 2021-02-01
    And 2020 revenue of 950 filed on 2022-02-01, restated in the next annual report
    When its financials are built
    Then revenue is 950 in 2020

  Scenario: Quarterly periods and quarterly reports are ignored
    Given a company that reported net income for 2016 to 2025
    And 2020 revenue of 1000 in the annual report
    And a fourth-quarter revenue figure of 300 inside that annual report
    And a full-year revenue figure of 4000 in a 10-Q
    When its financials are built
    Then revenue is 1000 in 2020

  Scenario: Alternative tags are tried year by year (Apple-style tag change)
    Given a company that reported net income for 2016 to 2025
    And revenue tagged "SalesRevenueNet" for 2016 to 2017
    And revenue tagged "RevenueFromContractWithCustomerExcludingAssessedTax" for 2018 to 2025
    When its financials are built
    Then every year has revenue
    And revenue comes from the tags "RevenueFromContractWithCustomerExcludingAssessedTax, SalesRevenueNet"

  Scenario: An IFRS filer's revenue tag change is followed too (Infosys-style, IFRS 15 from 2019)
    Given an IFRS filer reporting profit in USD on Form 20-F for 2016 to 2025
    And IFRS revenue tagged "Revenue" for 2016 to 2018
    And IFRS revenue tagged "RevenueFromContractsWithCustomers" for 2019 to 2025
    When its financials are built
    Then every year has revenue
    And revenue comes from the tags "Revenue, RevenueFromContractsWithCustomers"

  # ---------- Stock splits are detected and older per-share values adjusted ----------

  Scenario: A forward split adjusts older per-share values
    Given a company that reported net income for 2016 to 2025
    And diluted EPS of 12.0 before a split and 3.0 after it, restated in the filing of 2021-02-15
    And dividends declared per share of 4.0 before the split and 1.0 after it
    And diluted share counts of 1000 before 2019 and 4000 from 2019
    When its financials are built
    Then a split with ratio 4 is detected in the filing of 2021-02-15
    And diluted EPS is 3.0 in 2016
    And diluted EPS is 3.0 in 2025
    And dividends per share are 1.0 in 2017
    And diluted shares are 4000 in 2016, since share counts scale the other way

  Scenario: A reverse split is detected
    Given a company that reported net income for 2016 to 2025
    And diluted EPS of 1.0 before a split and 8.0 after it, restated in the filing of 2021-02-15
    When its financials are built
    Then a split with ratio 0.125 is detected
    And diluted EPS is 8.0 in 2016

  Scenario: A small restatement is not mistaken for a split
    Given a company that reported net income for 2016 to 2025
    And diluted EPS of 2.00 before a split and 1.90 after it, restated in the filing of 2021-02-15
    When its financials are built
    Then no split is detected
    And diluted EPS is 2.00 in 2016

  # ---------- A foreign filer keeps its reporting currency ----------

  Scenario: A foreign filer is pinned to its reporting currency
    Given an IFRS filer reporting profit and revenue in TWD on Form 20-F for 2016 to 2025
    And a USD convenience translation of its latest year only
    When its financials are built
    Then the currency is TWD
    And revenue is 1002025 in 2025

  # ---------- Total liabilities exclude minority owners' stakes ----------

  Scenario Outline: Total liabilities: <case>
    Given a company that reported net income for 2016 to 2025
    And total liabilities and equity of 100 and shareholders' equity of 30 at every year end
    And the balance-sheet tag "<tag>" is <value> at every year end
    When its financials are built
    Then total liabilities are <liabilities> in every year

    Examples:
      | case                                                    | tag                                                                    | value | liabilities |
      | reported total liabilities are used as is               | Liabilities                                                            | 55    | 55          |
      | derived liabilities exclude minority interest (100 - 40) | StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest | 40    | 60          |
      | the minority-interest tag is the fallback (100 - 30 - 10) | MinorityInterest                                                       | 10    | 60          |
      | derived liabilities without minority interest (100 - 30) | none                                                                   | 0     | 70          |

  # ---------- Debt is consistent from year to year ----------

  Scenario: Debt stays consistent when the company switches tags
    Given a company that reported net income for 2016 to 2025
    And the balance-sheet tag "LongTermDebtNoncurrent" is 90 at every year end
    And the balance-sheet tag "LongTermDebtCurrent" is 10 at every year end
    And the balance-sheet tag "LongTermDebt" is 100 at the year ends 2021 to 2025
    When its financials are built
    Then total debt is 100 in every year, with no fake jump in 2021
    And long-term debt is 90 in every year, the non-current part only

  Scenario: Long-term debt is derived when only the total is reported
    Given a company that reported net income for 2016 to 2025
    And the balance-sheet tag "LongTermDebt" is 100 at every year end
    And the balance-sheet tag "LongTermDebtCurrent" is 15 at every year end
    When its financials are built
    Then long-term debt is 85 in every year

  Scenario: Short-term borrowings are not double-counted with commercial paper
    Given a company that reported net income for 2016 to 2025
    And the balance-sheet tag "LongTermDebt" is 100 at every year end
    And the balance-sheet tag "ShortTermBorrowings" is 20 at every year end, already including commercial paper
    And the balance-sheet tag "CommercialPaper" is 15 at every year end
    When its financials are built
    Then total debt is 120 in every year

  Scenario: Internal building blocks are not returned
    Given a company that reported net income for 2016 to 2025
    When its financials are built
    Then no internal building blocks are in the result

  # ---------- Dividends and shares ----------

  Scenario: Dividend per share falls back to dividends paid
    Given a company that reported net income for 2016 to 2025
    And dividends paid of 50 every year except 0 in 2025
    And diluted share counts of 100 every year
    When its financials are built
    Then dividends per share are 0.5 in 2024
    And dividends per share are 0 in 2025, since a suspended dividend is zero, not missing

  Scenario: Shares outstanding sum the share classes from the latest filing
    Given a company that reported net income for 2016 to 2025
    And shares outstanding on its filings' cover pages:
      | shares | as of      | form | filed      | filing | note                    |
      | 500    | 2025-06-30 | 10-Q | 2025-08-01 | A      | class A                 |
      | 300    | 2025-06-30 | 10-Q | 2025-08-01 | A      | class B, same filing    |
      | 700    | 2024-06-30 | 10-Q | 2024-08-01 | B      | an older filing         |
    When its financials are built
    Then shares outstanding are 800 as of 2025-06-30
