Feature: SEC filing history and the latest report
  From the company's filing list the app picks out the events worth knowing about (restatement warnings,
  auditor changes, late filings, serious 8-K events, amendments, SEC comment letters), and the newest
  annual or quarterly report. Routine filings such as earnings releases and officer changes are left out.

  Scenario Outline: A <form> filing with 8-K items <items> is classified as <events>
    When a "<form>" filing with items "<items>" is classified
    Then its events are "<events>"

    Examples:
      | form    | items          | events                   | note                                         |
      | 8-K     | 4.02,9.01      | non_reliance             | restatement warning                          |
      | 8-K/A   | 4.01           | auditor_change           |                                              |
      | 8-K     | 2.02,9.01      | none                     | an earnings release                          |
      | 8-K     | 5.02,9.01      | none                     | officer and pay changes: too routine to show |
      | 8-K     | 1.03           | bankruptcy               |                                              |
      | 8-K     | 3.01,9.01      | delisting_notice         |                                              |
      | 8-K     | 1.05           | cyber_incident           |                                              |
      | 8-K     | 2.01,9.01      | acquisition              |                                              |
      | 8-K     | 4.02,2.06,9.01 | non_reliance, impairment | one filing, two events                       |
      | NT 10-K | none           | late_filing              |                                              |
      | NT 10-Q | none           | late_filing              |                                              |
      | 10-K/A  | none           | amendment                |                                              |
      | 20-F/A  | none           | amendment                |                                              |
      | UPLOAD  | none           | sec_letter               |                                              |
      | CORRESP | none           | company_response         |                                              |
      | 10-K    | none           | none                     |                                              |
      | 4       | none           | none                     |                                              |

  Scenario: The history covers the window, links to each filing and reads older pages only when needed
    Given a company in the "Widgets" industry whose recent filings are:
      | accession      | filed      | form    | items     | document    |
      | 0001-24-000001 | 2024-05-01 | NT 10-Q |           | nt.htm      |
      | 0001-23-000002 | 2023-03-01 | 8-K     | 4.01,2.06 | auditor.htm |
      | 0001-23-000003 | 2023-01-01 | 4       |           | form4.xml   |
    And an older page of its filings, covering 2009 to 2019:
      | accession      | filed      | form   | items | document    | note              |
      | 0001-18-000004 | 2018-11-15 | 8-K    | 4.02  | restate.htm |                   |
      | 0001-09-000005 | 2009-01-01 | UPLOAD |       | letter.pdf  | before the window |
    And an even older page covering 1995 to 2008
    When its filing history since 2016-01-01 is read
    Then its events, newest first, are "late_filing, auditor_change, impairment, non_reliance"
    And each of those events is counted once
    And the industry is "Widgets"
    And the first event links to "https://www.sec.gov/Archives/edgar/data/1/000124000001/nt.htm"
    And the page entirely before the window is not downloaded

  Scenario: The financials still load when the filing history fails
    Given a company that reported net income for 2016 to 2025
    And reading its filing history times out
    When its financials are built
    Then there is no filing history
    And the latest year is 2025

  Scenario: The latest report is the newest annual or quarterly filing
    Given a company that reported net income for 2016 to 2025
    And its recent filings are:
      | accession      | filed      | form   | items | document     | note                      |
      | 0001-25-000009 | 2025-11-01 | 8-K    | 2.02  | earnings.htm | newer, but not a report   |
      | 0001-25-000008 | 2025-10-30 | 10-Q   |       | q3.htm       |                           |
      | 0001-25-000004 | 2025-02-20 | 10-K   |       | annual.htm   |                           |
      | 0001-24-000007 | 2024-10-30 | 10-Q/A |       | q3a.htm      |                           |
    When its financials are built
    Then the latest report is the 10-Q filed on 2025-10-30, accession 0001-25-000008
    And the latest report links to "https://www.sec.gov/Archives/edgar/data/1/000125000008/q3.htm"

  Scenario: There is no latest report without annual or quarterly filings
    Given a company that reported net income for 2016 to 2025
    And its recent filings are:
      | accession      | filed      | form | items | document |
      | 0001-25-000001 | 2025-01-01 | 8-K  | 5.02  | x.htm    |
    When its financials are built
    Then there is no latest report
