from __future__ import annotations

import json
from pathlib import Path

from evidence_sources.testing_discipline import build_evidence


def _write_terminal_log(session_dir: Path, rows: list[dict[str, object]]) -> None:
    terminal_dir = session_dir / "terminal_log"
    terminal_dir.mkdir(parents=True)
    text = "\n".join(json.dumps(r) for r in rows) + "\n"
    (terminal_dir / "000000.jsonl").write_text(text, encoding="utf-8")


def test_no_session_data_is_missing_required(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    pack = build_evidence("sub-1", str(session_dir))
    assert "session_evidence" in pack.missing_required


def test_failing_then_passing_is_reported(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    rows = [
        {"command": "pytest -q", "cwd": "/w", "exit_code": 1, "duration_ms": 100},
        {"command": "pytest -q", "cwd": "/w", "exit_code": 0, "duration_ms": 100},
    ]
    _write_terminal_log(session_dir, rows)

    pack = build_evidence("sub-1", str(session_dir))
    agg = pack.resolve("term:fact.testing_cadence.aggregate")
    assert agg is not None
    assert "failing_then_passing=True" in agg.content
    assert "term:fact.terminal_log.time_to_first_test_run_ms" in pack.refs


def test_pack_is_deterministic(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    rows = [{"command": "pytest -q", "cwd": "/w", "exit_code": 0, "duration_ms": 100}]
    _write_terminal_log(session_dir, rows)

    p1 = build_evidence("sub-1", str(session_dir))
    p2 = build_evidence("sub-1", str(session_dir))
    assert p1.model_dump() == p2.model_dump()
