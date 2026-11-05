"""Test-run cadence facts for the testing-discipline agent: were tests run more than once, and
did a failing run get followed by a later passing one (iteration), or is the only test run in
the whole session a single pass/fail with nothing after it.

Reuses production_signals.py's own CI test-command regex, same reasoning as
checks/terminal_log.py: a command is "a test run" by the same rule everywhere in this package.
"""

from __future__ import annotations

from typing import TypedDict

from ..session_reader import CommandRecord
from .production_signals import _CI_TEST_RE


class TestingCadence(TypedDict):
    test_run_count: int
    test_run_ratio: float
    failing_then_passing: bool
    only_run_once: bool


def analyze_testing_cadence(commands: list[CommandRecord]) -> TestingCadence | None:
    """None when there is nothing to report (no commands recorded at all)."""
    if not commands:
        return None

    test_runs = [c for c in commands if _CI_TEST_RE.search(c["command"])]
    if not test_runs:
        return {
            "test_run_count": 0, "test_run_ratio": 0.0,
            "failing_then_passing": False, "only_run_once": False,
        }

    failing_then_passing = False
    seen_failure = False
    for run in test_runs:
        if run["exit_code"] is not None and run["exit_code"] != 0:
            seen_failure = True
        elif run["exit_code"] == 0 and seen_failure:
            failing_then_passing = True

    return {
        "test_run_count": len(test_runs),
        "test_run_ratio": round(len(test_runs) / len(commands), 3),
        "failing_then_passing": failing_then_passing,
        "only_run_once": len(test_runs) == 1,
    }
