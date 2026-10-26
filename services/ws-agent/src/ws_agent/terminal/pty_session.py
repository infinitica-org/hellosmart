"""Allocates a PTY, forks the candidate's real shell inside it, and sits in the middle of the
byte stream both directions -- the same place terminal multiplexers and `script`/`asciinema`
sit. Every byte is handed to two places: `on_raw` (the unparsed replay stream, written to the
spool as-is after redaction) and an `Osc133Parser` (the structured command log).

POSIX-only (`pty`, `select`, `termios`/`tty` are not available on Windows) -- this is correct
for the production target (the slot is always Linux) but means this module has no unit test in
this repo's CI if CI ever runs on a non-Linux runner, and cannot be exercised at all on a
Windows dev machine. `osc133.py` carries the actual parsing logic and is fully unit-tested
there; this module is the thin, mostly-untested glue around a real PTY. Treat it as the one
piece of `ws-agent` that needs an actual Linux integration test (a scripted session played back
through a real `pty.fork()`) before it ships, not just unit coverage.
"""

from __future__ import annotations

import os
import pty
import select
import sys
from collections.abc import Callable

from .osc133 import CommandEvent, Osc133Parser

RawSink = Callable[[bytes], None]
CommandSink = Callable[[CommandEvent], None]


def run_recorded_shell(
    shell_cmd: list[str],
    on_raw: RawSink,
    on_command: CommandSink,
    cwd_provider: Callable[[], str | None] | None = None,
) -> int:
    """Forks `shell_cmd` under a PTY. Blocks until the shell exits; returns its exit status.
    Candidate keystrokes pass straight through to the shell unmodified (this never injects or
    alters input) -- it only observes what comes back out."""
    parser = Osc133Parser(cwd_provider)
    pid, master_fd = pty.fork()

    if pid == 0:  # child: becomes the shell
        os.execvp(shell_cmd[0], shell_cmd)  # noqa: S606 -- fixed, caller-supplied shell argv
        return 0  # unreachable; execvp replaces this process

    try:
        while True:
            try:
                readable, _, _ = select.select([master_fd, sys.stdin.fileno()], [], [], 0.1)
            except OSError:
                break
            if master_fd in readable:
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError:
                    break
                if not chunk:
                    break
                on_raw(chunk)
                for event in parser.feed(chunk):
                    on_command(event)
            if sys.stdin.fileno() in readable:
                data = os.read(sys.stdin.fileno(), 4096)
                if data:
                    os.write(master_fd, data)
    finally:
        os.close(master_fd)

    _, status = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(status)
