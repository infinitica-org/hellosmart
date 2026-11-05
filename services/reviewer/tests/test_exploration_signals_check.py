from __future__ import annotations

from evidence_sources.checks.exploration_signals import analyze_exploration
from evidence_sources.session_reader import CommandRecord


def _cmd(command: str) -> CommandRecord:
    return {"command": command, "cwd": "/workspace", "exit_code": 0, "duration_ms": 100}


def test_no_commands_returns_none() -> None:
    assert analyze_exploration([]) is None


def test_exploring_before_acting_is_detected() -> None:
    commands = [_cmd("ls -la"), _cmd("cat app.py"), _cmd("git status"), _cmd("python app.py")]
    result = analyze_exploration(commands)
    assert result is not None
    assert result["explored_before_first_other_command"] is True
    assert result["explore_command_count"] == 3


def test_acting_immediately_with_no_exploration_is_detected() -> None:
    commands = [_cmd("python app.py"), _cmd("python app.py")]
    result = analyze_exploration(commands)
    assert result is not None
    assert result["explored_before_first_other_command"] is False
    assert result["explore_command_count"] == 0


def test_exploring_only_after_acting_does_not_count_as_explored_before() -> None:
    commands = [_cmd("python app.py"), _cmd("cat app.py")]
    result = analyze_exploration(commands)
    assert result is not None
    assert result["explored_before_first_other_command"] is False


def test_only_exploration_commands_counts_as_explored_before() -> None:
    commands = [_cmd("ls"), _cmd("cat app.py"), _cmd("git log")]
    result = analyze_exploration(commands)
    assert result is not None
    assert result["explored_before_first_other_command"] is True
    assert result["explore_ratio"] == 1.0
