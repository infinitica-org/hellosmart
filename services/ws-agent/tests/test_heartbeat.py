from __future__ import annotations

from ws_agent.heartbeat import Heartbeat


class RecordingSink:
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, object]]] = []

    def send(self, slot_id: str, payload: dict[str, object]) -> None:
        self.sent.append((slot_id, payload))


class FailingSink:
    def send(self, slot_id: str, payload: dict[str, object]) -> None:
        raise OSError("unreachable")


def test_beat_sends_slot_id_and_timestamp() -> None:
    sink = RecordingSink()
    hb = Heartbeat("slot-123", sink)
    hb.beat()
    assert len(sink.sent) == 1
    slot_id, payload = sink.sent[0]
    assert slot_id == "slot-123"
    assert "ts" in payload
    assert hb.stats.sent == 1
    assert hb.stats.failed == 0


def test_beat_includes_extra_fields() -> None:
    sink = RecordingSink()
    hb = Heartbeat("slot-123", sink)
    hb.beat(extra={"cpu_pct": 12.5})
    assert sink.sent[0][1]["cpu_pct"] == 12.5


def test_beat_failure_is_counted_not_raised() -> None:
    """A heartbeat failure must never propagate -- it would take down the capture loop that
    calls it, for a problem that's purely about the network to the orchestrator."""
    hb = Heartbeat("slot-123", FailingSink())
    hb.beat()  # must not raise
    assert hb.stats.failed == 1
    assert hb.stats.sent == 0
