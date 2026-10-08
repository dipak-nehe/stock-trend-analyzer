"""Company search for the search box: ranking rules on a small hand-built ticker table (in SEC's order)."""
from backend.search import normalize, search

TABLE = {  # {TICKER: [cik, title, ticker]}, largest company first like SEC's list
    "AAPL": [1, "Apple Inc.", "AAPL"],
    "GOOGL": [2, "Alphabet Inc.", "GOOGL"],
    "GOOG": [2, "Alphabet Inc.", "GOOG"],
    "JPM": [3, "JPMORGAN CHASE & CO", "JPM"],
    "KO": [4, "COCA COLA CO", "KO"],
    "T": [5, "AT&T INC.", "T"],
    "APLE": [6, "Apple Hospitality REIT, Inc.", "APLE"],
    "COKE": [7, "Coca-Cola Consolidated, Inc.", "COKE"],
    "BRK-B": [8, "BERKSHIRE HATHAWAY INC", "BRK-B"],
    "VCV": [9, "Invesco California Value Municipal", "VCV"],
}
tickers = lambda q, **kw: [r["ticker"] for r in search(TABLE, q, **kw)]  # noqa: E731


def test_names_are_compared_without_case_punctuation_or_ampersands():
    assert normalize("AT&T Inc.") == "at and t inc"
    assert normalize("  Coca-Cola  ") == "coca cola"


def test_an_exact_ticker_comes_first():
    assert tickers("KO")[0] == "KO"
    assert tickers("goog")[0] == "GOOG"  # exact, ahead of GOOGL which only starts with it


def test_company_names_find_their_tickers():
    assert tickers("apple") == ["AAPL", "APLE"]          # name starts with it, bigger company first
    assert tickers("coca cola") == ["KO", "COKE"]
    assert tickers("hathaway") == ["BRK-B"]              # a later word of the name
    assert tickers("at&t") == ["T"]


def test_spaces_inside_a_name_dont_matter_for_longer_queries():
    assert tickers("jp morgan") == ["JPM"]
    assert tickers("cocacola") == ["KO", "COKE"]
    assert "VCV" not in tickers("coca")  # short queries don't match across words ("invesCO CAlifornia")


def test_well_known_brands_find_the_listed_company():
    assert tickers("google") == ["GOOGL"]
    assert tickers("berkshire")[0] == "BRK-B"


def test_a_company_with_two_tickers_shows_once_for_a_name_search():
    assert tickers("alphabet") == ["GOOGL"]


def test_empty_queries_and_the_limit():
    assert tickers("   ") == []
    assert len(tickers("c", limit=2)) == 2
