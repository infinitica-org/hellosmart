"""Facts from a session's recorded terminal commands (see session_reader.py): how much testing
and linting actually happened, not just what the final code looks like.

Reuses the same CI test/lint detection regexes production_signals.py already has -- a command
is "testing" or "linting" by the same rule whether it ran in a candidate's terminal or in a CI
workflow step, so this is deliberately the same pattern, not a second one invented from scratch.
"""

from __future__ import annotations

from typing import TypedDict

from ..session_reader import CommandRecord
from .production_signals import _CI_LINT_RE, _CI_TEST_RE


class TerminalLogAggregate(TypedDict):
    total_commands: int
    distinct_test_runs: int
    distinct_lint_runs: int
    failed_command_count: int
    failed_command_ratio: float
    time_to_first_test_run_ms: int | None


def analyze_terminal_log(commands: list[CommandRecord]) -> TerminalLogAggregate | None:
    """None when there is nothing to report (no commands recorded at all)."""
    if not commands:
        return None

    test_runs = 0
    lint_runs = 0
    failed = 0
    elapsed_ms = 0
    time_to_first_test_run_ms: int | None = None

    for cmd in commands:
        text = cmd["command"]
        if _CI_TEST_RE.search(text):
            test_runs += 1
            if time_to_first_test_run_ms is None:
                time_to_first_test_run_ms = elapsed_ms
        if _CI_LINT_RE.search(text):
            lint_runs += 1
        if cmd["exit_code"] is not None and cmd["exit_code"] != 0:
            failed += 1
        elapsed_ms += cmd["duration_ms"]

    total = len(commands)
    return {
        "total_commands": total,
        "distinct_test_runs": test_runs,
        "distinct_lint_runs": lint_runs,
        "failed_command_count": failed,
        "failed_command_ratio": round(failed / total, 3),
        "time_to_first_test_run_ms": time_to_first_test_run_ms,
    }
