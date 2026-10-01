Feature: API responses: tickers, errors and caching
  /api/financials validates the ticker, turns SEC problems into friendly errors that are never cached and
  never leak internal details, and lets Vercel's CDN cache good results while browsers always re-check.

  Scenario: Class-share tickers with a dot are found
    Given SEC's ticker list includes BRK-B for Berkshire
    When the ticker "brk.b" is looked up
    Then it is found as BRK-B, Berkshire, CIK 2

  Scenario Outline: A bad or unknown ticker is rejected: <ticker>
    Given a company that reported net income for 2016 to 2025
    When the API is asked for the ticker <ticker>
    Then the response is an error with status <status>
    And the response is <caching>

    Examples:
      | ticker         | status | caching                    |
      | (empty)        | 400    | not cached                 |
      | (three spaces) | 400    | not cached                 |
      | <script>       | 400    | not cached                 |
      | TOOLONGTICKER1 | 400    | not cached                 |
      | NOPE           | 404    | cached briefly as not found |

  Scenario: A good result is cached on the CDN only
    Given a company that reported net income for 2016 to 2025
    When the API is asked for the ticker test
    Then the response is the company TEST
    And the response is cached on the CDN for a day, while browsers always re-check

  Scenario Outline: SEC failures become friendly, uncached errors: <failure>
    Given SEC fails with <failure>
    When the API is asked for the ticker AAPL
    Then the response is an error with status <status>
    And the error says "<text>"
    And the response is not cached
    And the error doesn't reveal internal details

    Examples:
      | failure                | status | text                 |
      | HTTP 403               | 502    | limiting requests    |
      | HTTP 429               | 502    | limiting requests    |
      | HTTP 500               | 502    | HTTP 500             |
      | a network error        | 504    | too long             |
      | a timeout              | 504    | too long             |
      | an unexpected error    | 500    | Something went wrong |

  Scenario Outline: An SEC contact is required before anything is downloaded: SEC_USER_AGENT <setting>
    Given SEC_USER_AGENT <setting>
    And the real SEC downloader is used
    When the API is asked for the ticker AAPL
    Then the response is an error with status 500
    And the error says "SEC_USER_AGENT"

    Examples:
      | setting                     |
      | is not set                  |
      | is empty                    |
      | is "NoEmailHere", no email  |
