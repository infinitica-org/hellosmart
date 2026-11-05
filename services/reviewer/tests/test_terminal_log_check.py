from __future__ import annotations

from evidence_sources.checks.terminal_log import analyze_terminal_log
from evidence_sources.session_reader import CommandRecord


def _cmd(command: str, exit_code: int | None, duration_ms: int = 100) -> CommandRecord:
    return {
        "command": command, "cwd": "/workspace", "exit_code": exit_code,
        "duration_ms": duration_ms,
    }


def test_no_commands_returns_none() -> None:
    assert analyze_terminal_log([]) is None


def test_test_and_lint_commands_are_counted() -> None:
    commands = [
        _cmd("ls -la", 0),
        _cmd("pytest -q", 0),
        _cmd("ruff check .", 0),
        _cmd("pytest -q", 1),
    ]
    result = analyze_terminal_log(commands)
    assert result is not None
    assert result["distinct_test_runs"] == 2
    assert result["distinct_lint_runs"] == 1
    assert result["failed_command_count"] == 1
    assert result["failed_command_ratio"] == 0.25


def test_time_to_first_test_run_is_the_elapsed_duration_before_it() -> None:
    commands = [
        _cmd("ls -la", 0, duration_ms=50),
        _cmd("cd app", 0, duration_ms=10),
        _cmd("pytest -q", 0, duration_ms=800),
    ]
    result = analyze_terminal_log(commands)
    assert result is not None
    assert result["time_to_first_test_run_ms"] == 60


def test_no_test_run_at_all_leaves_time_to_first_test_run_none() -> None:
    result = analyze_terminal_log([_cmd("ls -la", 0)])
    assert result is not None
    assert result["time_to_first_test_run_ms"] is None


def test_all_commands_succeeding_gives_zero_failure_ratio() -> None:
    result = analyze_terminal_log([_cmd("echo ok", 0), _cmd("echo ok2", 0)])
    assert result is not None
    assert result["failed_command_ratio"] == 0.0


def test_a_command_with_no_recorded_exit_code_is_not_counted_as_failed() -> None:
    """A command that never finished (slot destroyed mid-run) has exit_code=None -- that is
    not the same as a real failure and must not inflate the failure ratio."""
    result = analyze_terminal_log([_cmd("sleep 100", None)])
    assert result is not None
    assert result["failed_command_count"] == 0
