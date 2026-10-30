"""Command-ordering facts for the problem-decomposition agent: did the candidate look around
before acting, or jump straight in?

`CommandRecord` (see session_reader.py) has no absolute timestamp, only `duration_ms` -- so
this check works from sequence position within the recorded command list (which is written in
chronological order by ws-agent) rather than wall-clock correlation with the git-snapshot
timeline. That is a real, documented limit, not an oversight: a "did they explore before this
specific edit" signal, correlated against git_timeline's snapshot timestamps, would need
terminal_log to carry an absolute `ts` per command, which it does not yet (see the live-session
evidence plan's open items). This check answers a coarser question that doesn't need it: did
exploration happen early in the session at all.
"""

from __future__ import annotations

import re
from typing import TypedDict

from ..session_reader import CommandRecord

_EXPLORE_RE = re.compile(
    r"^(ls|cat|head|tail|find|grep|tree|less|more|cd|pwd|git\s+(log|status|diff|show))\b"
)


class ExplorationSignals(TypedDict):
    total_commands: int
    explore_command_count: int
    explore_ratio: float
    explored_before_first_other_command: bool


def analyze_exploration(commands: list[CommandRecord]) -> ExplorationSignals | None:
    """None when there is nothing to report (no commands recorded at all)."""
    if not commands:
        return None

    explore_count = 0
    first_other_index: int | None = None
    first_explore_index: int | None = None

    for i, cmd in enumerate(commands):
        is_explore = bool(_EXPLORE_RE.match(cmd["command"].strip()))
        if is_explore:
            explore_count += 1
            if first_explore_index is None:
                first_explore_index = i
        elif first_other_index is None:
            first_other_index = i

    explored_before = (
        first_explore_index is not None
        and (first_other_index is None or first_explore_index < first_other_index)
    )

    return {
        "total_commands": len(commands),
        "explore_command_count": explore_count,
        "explore_ratio": round(explore_count / len(commands), 3),
        "explored_before_first_other_command": explored_before,
    }
