"""Live-session evidence: integrity-observer, the flags-only agent. These tests check the
evidence builder's own correctness; whether the runner actually keeps this agent's output from
being read as a score is the separate, flagged, not-yet-solved gap documented in
agents/integrity-observer.yaml's header comment."""

from __future__ import annotations

import json
from pathlib import Path

from evidence_sources.integrity_observer import build_evidence


def _write_events(session_dir: Path, rows: list[dict[str, object]]) -> None:
    events_dir = session_dir / "events"
    events_dir.mkdir(parents=True)
    text = "\n".join(json.dumps(r) for r in rows) + "\n"
    (events_dir / "000000.jsonl").write_text(text, encoding="utf-8")


def test_no_events_is_missing_required(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    pack = build_evidence("sub-1", str(session_dir))
    assert "activity_events" in pack.missing_required


def test_clean_session_reports_zero_counts(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _write_events(
        session_dir, [{"ts": 1.0, "kind": "file_change", "detail": {"path": "app.py"}}]
    )
    pack = build_evidence("sub-1", str(session_dir))
    agg = pack.resolve("event:fact.integrity_signals.aggregate")
    assert agg is not None
    assert "large_paste_count=0" in agg.content
    assert "focus_loss_count=0" in agg.content
    assert not pack.missing_required


def test_a_large_paste_is_counted_and_reported_as_an_item(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _write_events(
        session_dir,
        [{"ts": 1.0, "kind": "large_paste", "detail": {"chars": 1200}}],
    )
    pack = build_evidence("sub-1", str(session_dir))
    agg = pack.resolve("event:fact.integrity_signals.aggregate")
    assert agg is not None
    assert "large_paste_count=1" in agg.content
    notable_refs = [r for r in pack.refs if r.startswith("event:ev.notable.")]
    assert len(notable_refs) == 1


def test_a_small_paste_under_the_threshold_is_not_counted(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _write_events(session_dir, [{"ts": 1.0, "kind": "large_paste", "detail": {"chars": 50}}])
    pack = build_evidence("sub-1", str(session_dir))
    agg = pack.resolve("event:fact.integrity_signals.aggregate")
    assert agg is not None
    assert "large_paste_count=0" in agg.content


def test_focus_loss_events_are_counted(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _write_events(
        session_dir,
        [
            {"ts": 1.0, "kind": "focus_loss", "detail": {}},
            {"ts": 2.0, "kind": "focus_loss", "detail": {}},
        ],
    )
    pack = build_evidence("sub-1", str(session_dir))
    agg = pack.resolve("event:fact.integrity_signals.aggregate")
    assert agg is not None
    assert "focus_loss_count=2" in agg.content


def test_pack_is_deterministic(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _write_events(session_dir, [{"ts": 1.0, "kind": "focus_loss", "detail": {}}])
    p1 = build_evidence("sub-1", str(session_dir))
    p2 = build_evidence("sub-1", str(session_dir))
    assert p1.model_dump() == p2.model_dump()
