from __future__ import annotations

from evidence_sources.checks.testing_cadence import analyze_testing_cadence
from evidence_sources.session_reader import CommandRecord


def _cmd(command: str, exit_code: int | None) -> CommandRecord:
    return {"command": command, "cwd": "/w", "exit_code": exit_code, "duration_ms": 100}


def test_no_commands_returns_none() -> None:
    assert analyze_testing_cadence([]) is None


def test_no_test_commands_at_all() -> None:
    result = analyze_testing_cadence([_cmd("ls", 0)])
    assert result is not None
    assert result["test_run_count"] == 0
    assert result["only_run_once"] is False


def test_a_single_test_run_is_flagged_as_only_run_once() -> None:
    result = analyze_testing_cadence([_cmd("pytest -q", 0)])
    assert result is not None
    assert result["test_run_count"] == 1
    assert result["only_run_once"] is True
    assert result["failing_then_passing"] is False


def test_a_failing_run_followed_by_a_passing_run_is_detected() -> None:
    commands = [_cmd("pytest -q", 1), _cmd("pytest -q", 0)]
    result = analyze_testing_cadence(commands)
    assert result is not None
    assert result["failing_then_passing"] is True
    assert result["only_run_once"] is False


def test_two_passing_runs_with_no_failure_is_not_failing_then_passing() -> None:
    commands = [_cmd("pytest -q", 0), _cmd("pytest -q", 0)]
    result = analyze_testing_cadence(commands)
    assert result is not None
    assert result["failing_then_passing"] is False
