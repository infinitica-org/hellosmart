"""Unusual session-activity patterns from events.jsonl, for the integrity-observer agent.

Per the delivery plan's own agent-library table (§4.2): this agent is "flags only, never
scores" -- nothing here computes a verdict, judges intent, or lowers any other agent's score.
It reports what happened (a large paste, a focus loss, an unexplained reconnect gap) as facts;
whether any of that matters is a human reviewer's call, never this check's or the model's.

A single large paste or one focus-loss event is not inherently suspicious -- candidates legally
paste code they wrote elsewhere, and switch windows to read documentation. These are flags for
a human to weigh with context, not red flags in the same sense other agents' red_flags are.
"""

from __future__ import annotations

from typing import TypedDict

from ..session_reader import SessionEvent

LARGE_PASTE_THRESHOLD_CHARS = 500


class IntegritySignals(TypedDict):
    large_paste_count: int
    focus_loss_count: int
    idle_count: int
    total_events: int


def analyze_integrity_signals(events: list[SessionEvent]) -> IntegritySignals | None:
    """None when there is nothing to report (no events recorded at all)."""
    if not events:
        return None

    large_paste = 0
    focus_loss = 0
    idle = 0

    for event in events:
        kind = event["kind"]
        detail = event["detail"]
        if kind == "large_paste":
            size = detail.get("chars")
            if isinstance(size, int) and size >= LARGE_PASTE_THRESHOLD_CHARS:
                large_paste += 1
        elif kind == "focus_loss":
            focus_loss += 1
        elif kind == "idle":
            idle += 1

    return {
        "large_paste_count": large_paste,
        "focus_loss_count": focus_loss,
        "idle_count": idle,
        "total_events": len(events),
    }
