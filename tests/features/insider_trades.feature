Feature: Insider trades from SEC Form 4 filings
  Officers, directors and 10% owners report their trades on Form 4. Only open-market buys (code P) and
  sales (code S) count: grants, option exercises, tax withholding and gifts aren't decisions to buy or
  sell. The summary covers the 12 months up to "today", 2026-09-26 (the date of the saved filings).

  # ---------- One Form 4 is read correctly ----------

  Scenario: Only open-market buys and sales count, and lines are grouped
    Given a Form 4 from Doe Jane, CEO, with these transactions:
      | code | date       | shares | price | acquired or disposed | note                     |
      | S    | 2026-08-01 | 100    | 10.0  | D                    | one sale at two prices   |
      | S    | 2026-08-01 | 300    | 12.0  | D                    |                          |
      | P    | 2026-08-02 | 50     | 9.0   | A                    |                          |
      | A    | 2026-08-01 | 1000   | 0     | A                    | a grant: left out        |
      | M    | 2026-08-01 | 500    | 5.0   | A                    | an option exercise       |
      | F    | 2026-08-01 | 200    | 11.0  | D                    | shares withheld for tax  |
    When it is read
    Then its trades are:
      | date       | type | shares | price | note                          |
      | 2026-08-01 | sell | 400    | 11.5  | (100 × 10 + 300 × 12) / 400   |
      | 2026-08-02 | buy  | 50     | 9.0   |                               |
    And it is from Doe Jane, CEO, of company 1

  Scenario Outline: The insider's role: <role>
    Given a Form 4 whose reporting relationship is "<relationship>"
    When it is read
    Then the insider's role is "<role>"

    Examples:
      | relationship                                    | role                     |
      | isDirector=1                                    | Director                 |
      | isOfficer=true; officerTitle=CFO; isDirector=1  | CFO, Director            |
      | isTenPercentOwner=1                             | 10% owner                |
      | isOther=1; otherText=President, Latin America   | President, Latin America |
      | isOfficer=1                                     | Officer                  |

  Scenario: The pre-planned trading plan checkbox (Rule 10b5-1)
    Then a Form 4 with the trading-plan box ticked is pre-planned
    And a Form 4 without it is not

  # ---------- A company's Form 4s add up to a 12-month summary ----------

  Scenario: Buys and sales in the last 12 months
    Given the company's insider filings:
      | accession      | filed      | insider | role     | planned | code | date       | shares | price |
      | 0001-26-000003 | 2026-09-01 | Ann     | CEO      | yes     | S    | 2026-08-30 | 1000   | 20.0  |
      | 0001-26-000002 | 2026-06-01 | Bob     | Director | no      | P    | 2026-05-30 | 500    | 10.0  |
      | 0001-26-000001 | 2026-03-01 | Cy      | Director | no      | P    | 2026-02-27 | 200    | 11.0  |
    When its insider summary is built
    Then the buys are 2 trades of 700 shares worth 7200 by 2 insiders
    And the sales are 1 trade of 1000 shares worth 20000 by 1 insider, 1 of them pre-planned
    And the trades are listed newest first: 2026-08-30, 2026-05-30, 2026-02-27
    And the newest trade links to "https://www.sec.gov/Archives/edgar/data/1/000126000003/xslF345X06/form4.xml"
    And the summary covers 2025-09-26 to 2026-09-26 and is complete

  Scenario: Filings and trades older than 12 months are left out
    Given the company's insider filings:
      | accession      | filed      | code | date       | shares | price | note                                  |
      | 0001-26-000002 | 2026-01-10 | P    | 2025-06-01 | 10     | 5.0   | a 2025 trade reported late: left out  |
      | 0001-26-000002 | 2026-01-10 | P    | 2026-01-08 | 20     | 5.0   |                                       |
      | 0001-25-000001 | 2025-09-01 | P    | 2025-08-30 | 99     | 5.0   | filed too long ago                    |
    When its insider summary is built
    Then only the filings "0001-26-000002" were downloaded
    And the buys are 1 trade of 20 shares

  Scenario: Form 4s the company filed as an investor in another company are ignored
    # Real case: Coca-Cola's filing list includes Form 4s where Coca-Cola reports as a 10% owner elsewhere.
    Given the company's insider filings:
      | accession      | filed      | issuer | insider   | code | date       | shares   | price |
      | 0001-26-000002 | 2026-09-01 | 999    | Parent Co | S    | 2026-08-30 | 10000000 | 100.0 |
      | 0001-26-000001 | 2026-08-01 | 1      | Doe Jane  | S    | 2026-07-30 | 100      | 10.0  |
    When its insider summary is built
    Then the sales are 1 trade worth 1000

  Scenario: Stored filings are not downloaded again
    Given the company's insider filings:
      | accession      | filed      | code | date       | shares | price |
      | 0001-26-000001 | 2026-09-01 | P    | 2026-08-30 | 10     | 5.0   |
    When its insider summary is built
    And its insider summary is built again with the same storage
    Then no filings were downloaded the second time
    And the buys are 1 trade

  Scenario: Only the newest filings are read, and the summary says it is partial
    Given at most 2 insider filings are read per company
    And the company's insider filings:
      | accession      | filed      | code |
      | 0001-26-000001 | 2026-01-01 | none |
      | 0001-26-000002 | 2026-02-01 | none |
      | 0001-26-000003 | 2026-03-01 | none |
      | 0001-26-000004 | 2026-04-01 | none |
    When its insider summary is built
    Then only the filings "0001-26-000003, 0001-26-000004" were downloaded
    And the summary read 2 of 4 filings and is partial

  Scenario: An unreadable filing is skipped and marks the summary partial
    Given the company's insider filings:
      | accession      | filed      | code | date       | shares | price |
      | 0001-26-000002 | 2026-09-01 | none |            |        |       |
      | 0001-26-000001 | 2026-08-01 | S    | 2026-07-30 | 100    | 10.0  |
    And the filing "0001-26-000002" can't be read
    When its insider summary is built
    Then the sales are 1 trade
    And 1 filing was read and the summary is partial

  Scenario: No insider filings means no summary
    Given the company has no insider filings
    When its insider summary is built
    Then there is no insider summary

  # ---------- The insider endpoint (/api/insiders) on the saved SEC filings ----------

  Scenario: The main results download no Form 4s
    # Reading Form 4s takes seconds: the main results come without them, and the page asks /api/insiders after.
    Given the saved SEC filings
    And Form 4 downloads are recorded
    When the financials for KO are built
    Then no Form 4 was downloaded
    And the financials have no insider trades

  Scenario: The insider endpoint stores its summary
    Given the saved SEC filings
    When the insider trades for "KO" are asked for
    Then they come from SEC with status 200 for KO, with 31 sales
    And the response is cached on the CDN
    When the insider trades for "ko" are asked for
    Then they come from storage

  Scenario: A failed insider summary is not stored, so the next request tries again
    # Regression: a failed first lookup (NVDA on the live site) was stored and served as "no insider data".
    Given the saved SEC filings
    And reading insider trades fails
    When the insider trades for "KO" are asked for
    Then the response is a 502 error saying "couldn't be loaded", neither cached nor stored
    When reading insider trades works again
    And the insider trades for "KO" are asked for
    Then they come from SEC with status 200 for KO, with 31 sales

  Scenario Outline: The insider endpoint rejects unknown and bad tickers: <ticker>
    Given the saved SEC filings
    When the insider trades for <ticker> are asked for
    Then the insider response status is <status>

    Examples:
      | ticker  | status |
      | "ZZZZQ" | 404    |
      | "x y"   | 400    |
      | (empty) | 400    |

  # ---------- Real filings (tests/fixtures/form4_*.json, 12 months to 2026-09-26) ----------

  Scenario Outline: The real insider summary for <ticker>
    Given the saved SEC filings
    When the insider trades for "<ticker>" are asked for
    Then the buys are <buys> trades by <buyers> insiders worth <bought>
    And the sales are <sales> trades by <sellers> insiders worth <sold>, <planned> of them pre-planned
    And the summary is complete

    Examples:
      | ticker | buys | buyers | bought   | sales | sellers | sold      | planned |
      | KO     | 2    | 1      | 998671   | 31    | 11      | 255746062 | 10      |
      | INTC   | 2    | 2      | 10249970 | 3     | 2       | 7474399   | 0       |
      | AAPL   | 0    | 0      | 0        | 19    | 8       | 173879888 | 16      |
      | SMCI   | 0    | 0      | 0        | 6     | 4       | 18910948  | 4       |

  Scenario: Coca-Cola's own investor filing is not counted as an insider sale
    # Its filing list includes a Form 4 of Coca-Cola as a 10% owner of another company: 18.8 million shares at $127.
    Given the saved SEC filings
    When the insider trades for "KO" are asked for
    Then the sales total 3121783 shares
    And no trade is by "COCA COLA CO"

  Scenario: A company with more filings than the cap is marked partial
    Given the saved SEC filings
    When the insider trades for "JPM" are asked for
    Then the summary read the maximum number of filings, fewer than JPM filed, and is partial
