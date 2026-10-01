"""behave hooks: every scenario starts isolated, like the pytest fixtures in tests/conftest.py.

- No scenario downloads a document from SEC, and "today" is the saved filings' date (the insider window).
- Every scenario starts with an empty in-memory store, so nothing stored by one answers another.
- Whatever a scenario swaps out (a module attribute or an environment variable) is put back afterwards.
- In the Allure report the scenarios join the pytest unit tests in "1 · Unit: data rules".
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [ROOT, os.path.join(ROOT, "tests")]  # `backend` and the shared test helpers

from helpers import FIXTURE_TODAY, _not_found  # noqa: E402

from backend import stock_data, store  # noqa: E402

LAYER = "1 · Unit: data rules"
_MISSING = object()


class Patches:
    """Swap module attributes and environment variables for one scenario, and undo them all afterwards."""

    def __init__(self):
        self._undo = []

    def attr(self, obj, name, value):
        old = getattr(obj, name, _MISSING)
        self._undo.append(lambda: setattr(obj, name, old) if old is not _MISSING else delattr(obj, name))
        setattr(obj, name, value)

    def env(self, name, value):
        """Set an environment variable, or remove it when value is None."""
        old = os.environ.get(name)
        self._undo.append(lambda: os.environ.__setitem__(name, old) if old is not None else os.environ.pop(name, None))
        if value is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = value

    def undo(self):
        while self._undo:
            self._undo.pop()()


def _refuse_download(url):
    raise _not_found(url)


def before_feature(context, feature):
    # Allure's Suites view: layer → feature → scenario, like the pytest files. allure-behave reads labels only
    # from tags (allure.dynamic does nothing there), so add them as tags; a tag added here may contain spaces.
    feature.tags += [f"allure.label.parentSuite:{LAYER}", f"allure.label.suite:{feature.name}"]


def before_scenario(context, scenario):
    context.patches = Patches()
    context.patches.attr(stock_data, "sec_get_text", _refuse_download)
    context.patches.env("STOCK_DATA_TODAY", FIXTURE_TODAY)
    context.patches.attr(stock_data, "store", store.MemoryStore())


def after_scenario(context, scenario):
    context.patches.undo()
