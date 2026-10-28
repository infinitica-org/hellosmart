"""Parses shell-integration (OSC 133) escape sequences out of a terminal byte stream into
discrete command records.

OSC 133 is the same mechanism VS Code's own integrated terminal and iTerm2 use to know where a
command starts and what it exited with -- not a project-specific hack. A shell-integration
snippet (bash-preexec-style, sourced from the slot's shell rc) emits:
  ESC ] 133 ; A ESC \\     -- prompt start
  ESC ] 133 ; B ESC \\     -- command-line start (user's typed command follows, until Enter)
  ESC ] 133 ; C ESC \\     -- command output start
  ESC ] 133 ; D ; <exit> ESC \\   -- command finished, with its exit code

Between B and C is the literal command text (as typed, including the newline that submits it).
Between C and the next A is the command's output, which this parser does not need to isolate --
the raw byte stream (recorded separately, unparsed) is what preserves that for replay.

This module is pure and synchronous: bytes in, structured events out. It holds no process,
PTY, or file-descriptor state, so it is exercised directly in tests without a real terminal.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass

_OSC = re.compile(rb"\x1b\]133;([ABCD])(?:;([^\x1b]*))?\x1b\\")
CwdProvider = Callable[[], "str | None"]


@dataclass
class CommandEvent:
    command: str
    cwd: str | None
    exit_code: int | None
    started_at: float
    ended_at: float

    @property
    def duration_ms(self) -> int:
        return round((self.ended_at - self.started_at) * 1000)


class Osc133Parser:
    """Feed raw PTY bytes in with `feed()`; completed `CommandEvent`s come back from it.
    An in-flight command (the shell is between B and D) stays buffered until the matching D
    marker arrives -- a command that never finishes (slot destroyed mid-run) never emits one,
    which is correct: there is no exit code to report."""

    def __init__(self, cwd_provider: CwdProvider | None = None) -> None:
        self._cwd_provider = cwd_provider
        self._pending_command: str | None = None
        self._pending_started_at: float | None = None
        self._buffer = b""
        self._state = "idle"  # idle | command_line | output

    def feed(self, chunk: bytes, now: float | None = None) -> list[CommandEvent]:
        now = now if now is not None else time.time()
        self._buffer += chunk
        events: list[CommandEvent] = []

        while True:
            match = _OSC.search(self._buffer)
            if match is None:
                break
            marker = match.group(1).decode("ascii")
            payload = match.group(2).decode("ascii", errors="replace") if match.group(2) else ""
            before = self._buffer[: match.start()]
            self._buffer = self._buffer[match.end() :]

            if self._state == "command_line" and marker in ("B", "C"):
                # Text between B and C is the literal typed command line.
                typed = before.decode("utf-8", errors="replace").strip("\r\n")
                if typed:
                    self._pending_command = typed

            if marker == "B":
                self._state = "command_line"
                self._pending_started_at = now
                self._pending_command = None
            elif marker == "C":
                self._state = "output"
            elif marker == "D":
                if self._pending_command is not None and self._pending_started_at is not None:
                    exit_code = int(payload) if payload.lstrip("-").isdigit() else None
                    events.append(
                        CommandEvent(
                            command=self._pending_command,
                            cwd=self._cwd_provider() if self._cwd_provider else None,
                            exit_code=exit_code,
                            started_at=self._pending_started_at,
                            ended_at=now,
                        )
                    )
                self._pending_command = None
                self._pending_started_at = None
                self._state = "idle"
            elif marker == "A":
                self._state = "idle"

        return events
