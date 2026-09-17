"""Static guard against undefined names in backend code.

Background jobs and rarely hit endpoints can carry a NameError for weeks without anyone
noticing — a missing variable once silently froze the market research rebuild. Python
only raises these at call time, so scan the whole package instead.
"""

from pathlib import Path

import pytest

pyflakes_api = pytest.importorskip("pyflakes.api")
pyflakes_reporter = pytest.importorskip("pyflakes.reporter")

APP_DIR = Path(__file__).resolve().parents[1] / "app"

# pyflakes message classes that mean "this will raise at runtime".
FATAL_MESSAGES = (
    "UndefinedName",
    "UndefinedLocal",
    "UndefinedExport",
)


class _Collector(pyflakes_reporter.Reporter):
    def __init__(self):
        super().__init__(None, None)
        self.problems: list[str] = []

    def unexpectedError(self, filename, msg):
        self.problems.append(f"{filename}: {msg}")

    def syntaxError(self, filename, msg, lineno, offset, text):
        self.problems.append(f"{filename}:{lineno}: syntax error: {msg}")

    def flake(self, message):
        if type(message).__name__ in FATAL_MESSAGES:
            self.problems.append(str(message))


def test_backend_has_no_undefined_names():
    collector = _Collector()
    for path in sorted(APP_DIR.rglob("*.py")):
        pyflakes_api.checkPath(str(path), collector)

    assert not collector.problems, "Names used but never defined:\n" + "\n".join(collector.problems)
