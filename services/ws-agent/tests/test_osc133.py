"""Unit tests for the OSC 133 parser -- the one piece of terminal capture that's pure and
testable without a real PTY (see pty_session.py's module docstring for why that module itself
has no unit test here)."""

from __future__ import annotations

from ws_agent.terminal.osc133 import Osc133Parser


def _seq(marker: str, payload: str | None = None) -> bytes:
    body = f"133;{marker}" + (f";{payload}" if payload is not None else "")
    return f"\x1b]{body}\x1b\\".encode()


def test_single_command_with_zero_exit() -> None:
    parser = Osc133Parser()
    stream = (
        _seq("A")
        + _seq("B")
        + b"pytest -q\n"
        + _seq("C")
        + b"5 passed in 0.3s\n"
        + _seq("D", "0")
    )
    events = parser.feed(stream, now=100.0)
    assert len(events) == 1
    assert events[0].command == "pytest -q"
    assert events[0].exit_code == 0


def test_nonzero_exit_is_captured() -> None:
    parser = Osc133Parser()
    stream = _seq("A") + _seq("B") + b"pytest -q\n" + _seq("C") + b"1 failed\n" + _seq("D", "1")
    events = parser.feed(stream, now=100.0)
    assert events[0].exit_code == 1


def test_duration_is_measured_between_command_start_and_exit() -> None:
    parser = Osc133Parser()
    parser.feed(_seq("A") + _seq("B") + b"sleep 2\n", now=100.0)
    events = parser.feed(_seq("C") + _seq("D", "0"), now=102.0)
    assert events[0].duration_ms == 2000


def test_bytes_arriving_in_separate_chunks_still_produce_one_event() -> None:
    """A real PTY delivers output in arbitrary-sized reads -- the parser must not assume one
    `feed()` call sees a whole command."""
    parser = Osc133Parser()
    assert parser.feed(_seq("A"), now=100.0) == []
    assert parser.feed(_seq("B"), now=100.0) == []
    assert parser.feed(b"ec", now=100.0) == []
    assert parser.feed(b"ho hi\n", now=100.0) == []
    assert parser.feed(_seq("C"), now=100.0) == []
    events = parser.feed(_seq("D", "0"), now=100.1)
    assert len(events) == 1
    assert events[0].command == "echo hi"


def test_command_that_never_exits_emits_nothing() -> None:
    """A slot destroyed mid-command (no D marker ever arrives) must not fabricate an exit
    code -- there is nothing to report, not a guessed zero."""
    parser = Osc133Parser()
    events = parser.feed(_seq("A") + _seq("B") + b"sleep 100\n" + _seq("C"), now=100.0)
    assert events == []


def test_cwd_provider_is_attached_to_each_event() -> None:
    parser = Osc133Parser(cwd_provider=lambda: "/home/candidate/app")
    stream = _seq("A") + _seq("B") + b"ls\n" + _seq("C") + _seq("D", "0")
    events = parser.feed(stream, now=100.0)
    assert events[0].cwd == "/home/candidate/app"


def test_two_commands_in_sequence_both_captured() -> None:
    parser = Osc133Parser()
    stream = (
        _seq("A") + _seq("B") + b"echo a\n" + _seq("C") + b"a\n" + _seq("D", "0")
        + _seq("A") + _seq("B") + b"echo b\n" + _seq("C") + b"b\n" + _seq("D", "0")
    )
    events = parser.feed(stream, now=100.0)
    assert [e.command for e in events] == ["echo a", "echo b"]
