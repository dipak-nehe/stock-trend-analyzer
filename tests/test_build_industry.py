"""The industry builder's summary maths (no network): quartiles per ratio, and too-small groups left out."""
import importlib.util
import os

spec = importlib.util.spec_from_file_location(
    "build_industry", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "build_industry.py"))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def test_quartiles_and_median():
    s = build.summarise([0.0, 0.1, 0.2, 0.3, 0.4])
    assert s == {"n": 5, "p25": 0.1, "median": 0.2, "p75": 0.3}


def test_groups_with_too_few_companies_are_left_out():
    assert build.summarise([0.1, 0.2, 0.3, 0.4]) is None  # fewer than MIN_COMPANIES (5)
