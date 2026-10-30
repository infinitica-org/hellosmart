"""Facts from the sequence of git snapshots across a session: how work was paced, not just
what the final diff looks like.

`session_count` treats a gap longer than `SESSION_GAP_SECONDS` between consecutive snapshots as
a new working session (the candidate stepped away and came back) -- a cheap, deterministic
proxy for "did they work in one sitting or several," which `debugging-process`'s rubric cares
about when distinguishing a candidate who paced their debugging from one who rushed it in a
single large edit.

`largest_single_snapshot_lines` is the "wrote it all at once" red flag debugging-process.yaml's
own anchors already name under the 1-anchor ("random edits with no hypothesis") -- a single
snapshot that accounts for most of the session's total change is evidence against any claimed
incremental, hypothesis-driven process.
"""

from __future__ import annotations

from itertools import pairwise
from typing import TypedDict

from ..session_reader import SnapshotInfo

SESSION_GAP_SECONDS = 20 * 60


class SessionTimelineAggregate(TypedDict):
    snapshot_count: int
    session_count: int
    total_lines_changed: int
    largest_single_snapshot_lines: int
    largest_snapshot_share: float


def analyze_session_timeline(snapshots: list[SnapshotInfo]) -> SessionTimelineAggregate | None:
    """None when there is nothing to report (no snapshots recorded at all)."""
    if not snapshots:
        return None

    session_count = 1
    for prev, curr in pairwise(snapshots):
        if curr["ts"] - prev["ts"] > SESSION_GAP_SECONDS:
            session_count += 1

    total_lines = sum(s["lines_changed"] for s in snapshots)
    largest = max(s["lines_changed"] for s in snapshots)
    share = round(largest / total_lines, 3) if total_lines else 0.0

    return {
        "snapshot_count": len(snapshots),
        "session_count": session_count,
        "total_lines_changed": total_lines,
        "largest_single_snapshot_lines": largest,
        "largest_snapshot_share": share,
    }
