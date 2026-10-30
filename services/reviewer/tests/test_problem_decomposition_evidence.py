from __future__ import annotations

import json
from pathlib import Path

from evidence_sources.problem_decomposition import build_evidence


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


def test_terminal_log_facts_are_reported(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    row1 = {"command": "ls", "cwd": "/w", "exit_code": 0, "duration_ms": 10}
    row2 = {"command": "python app.py", "cwd": "/w", "exit_code": 0, "duration_ms": 10}
    _write_terminal_log(session_dir, [row1, row2])

    pack = build_evidence("sub-1", str(session_dir))

    agg = pack.resolve("term:fact.exploration_signals.aggregate")
    assert agg is not None
    assert "explored_before_first_other_command=True" in agg.content
    assert "git_timeline" in {c.channel for c in pack.coverage}


def test_pack_is_deterministic(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    row = {"command": "ls", "cwd": "/w", "exit_code": 0, "duration_ms": 10}
    _write_terminal_log(session_dir, [row])

    p1 = build_evidence("sub-1", str(session_dir))
    p2 = build_evidence("sub-1", str(session_dir))
    assert p1.model_dump() == p2.model_dump()
