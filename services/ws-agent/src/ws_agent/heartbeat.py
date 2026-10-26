"""Periodic liveness ping to the orchestrator. Missed heartbeats past a threshold are the
orchestrator's signal to drain the host and resume the session elsewhere from the last
uploaded snapshot (that resume behavior lives in the orchestrator, not here) -- this module's
only job is to send the heartbeat reliably, including when the uploader is backed up, since the
two must never share a thread that can block.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Protocol


class HeartbeatSink(Protocol):
    def send(self, slot_id: str, payload: dict[str, object]) -> None: ...


@dataclass
class HeartbeatStats:
    sent: int = 0
    failed: int = 0


class Heartbeat:
    def __init__(self, slot_id: str, sink: HeartbeatSink, interval_seconds: float = 5.0) -> None:
        self.slot_id = slot_id
        self.sink = sink
        self.interval_seconds = interval_seconds
        self.stats = HeartbeatStats()

    def beat(self, extra: dict[str, object] | None = None) -> None:
        payload: dict[str, object] = {"ts": time.time(), **(extra or {})}
        try:
            self.sink.send(self.slot_id, payload)
            self.stats.sent += 1
        except OSError:
            self.stats.failed += 1
