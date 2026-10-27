"""SessionReader, exercised against a synthetic session directory built the same way ws-agent
would produce one -- real git bundles (via the same shadow-commit mechanism, reproduced here
with plain subprocess calls rather than importing services/ws-agent, which is a separate
deployable with its own dependencies), real JSONL segments. No mocking of git."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from evidence_sources.session_reader import SessionReader


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    ).stdout.strip()


def _make_synthetic_session(session_dir: Path, scratch: Path) -> None:
    """Builds two snapshots (app.py created, then modified) and writes them as bundles under
    session_dir/git_bundles/, plus one terminal_log segment and one events segment."""
    workspace = scratch / "workspace"
    workspace.mkdir(parents=True)
    _git(["init", "-q"], workspace)
    import os

    env = {
        **os.environ, "GIT_AUTHOR_NAME": "bot", "GIT_AUTHOR_EMAIL": "b@e.com",
        "GIT_COMMITTER_NAME": "bot", "GIT_COMMITTER_EMAIL": "b@e.com",
    }

    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")
    _git(["add", "-A"], workspace, env=env)
    tree1 = _git(["write-tree"], workspace, env=env)
    commit1 = _git(["commit-tree", tree1, "-m", "snap0"], workspace, env=env)
    _git(["update-ref", "refs/hs-snapshots/main", commit1], workspace, env=env)

    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)
    bundle0 = str(bundles_dir / "000000.bundle")
    _git(["bundle", "create", bundle0, "refs/hs-snapshots/main"], workspace)

    (workspace / "app.py").write_text("x = 2\n", encoding="utf-8")
    _git(["add", "-A"], workspace, env=env)
    tree2 = _git(["write-tree"], workspace, env=env)
    commit2 = _git(["commit-tree", tree2, "-p", commit1, "-m", "snap1"], workspace, env=env)
    _git(["update-ref", "refs/hs-snapshots/main", commit2], workspace, env=env)
    bundle1 = str(bundles_dir / "000001.bundle")
    rev_range = f"{commit1}..refs/hs-snapshots/main"
    _git(["bundle", "create", bundle1, rev_range], workspace)

    terminal_dir = session_dir / "terminal_log"
    terminal_dir.mkdir(parents=True)
    log_row = {"command": "pytest -q", "cwd": "/workspace", "exit_code": 0, "duration_ms": 842}
    (terminal_dir / "000000.jsonl").write_text(json.dumps(log_row) + "\n", encoding="utf-8")

    events_dir = session_dir / "events"
    events_dir.mkdir(parents=True)
    event_row = {"ts": 1732600000.0, "kind": "file_change", "detail": {"path": "app.py"}}
    (events_dir / "000000.jsonl").write_text(json.dumps(event_row) + "\n", encoding="utf-8")


def test_materialize_reconstructs_the_final_snapshot(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_synthetic_session(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    worktree = reader.materialize()

    assert worktree is not None
    assert (worktree / "app.py").read_text(encoding="utf-8") == "x = 2\n"
    assert reader.skipped == []


def test_materialize_upto_an_earlier_seq_gives_the_earlier_state(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_synthetic_session(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    worktree = reader.materialize(upto_seq=0)

    assert worktree is not None
    assert (worktree / "app.py").read_text(encoding="utf-8") == "x = 1\n"


def test_snapshot_timeline_reports_both_commits_in_order_with_lines_changed(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_synthetic_session(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    timeline = reader.snapshot_timeline()

    assert [s["seq"] for s in timeline] == [0, 1]
    # snap0 adds app.py with one line ("x = 1"); snap1 changes that one line ("x = 2").
    assert timeline[0]["lines_changed"] == 1
    assert timeline[1]["lines_changed"] == 2  # one line removed, one line added
    assert timeline[0]["ts"] <= timeline[1]["ts"]


def test_snapshot_timeline_with_no_bundles_returns_empty_list(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    reader = SessionReader(session_dir)
    assert reader.snapshot_timeline() == []


def test_materialize_with_no_bundles_returns_none(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    reader = SessionReader(session_dir)
    assert reader.materialize() is None


def test_terminal_log_is_parsed(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_synthetic_session(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    records = reader.terminal_log()

    assert len(records) == 1
    assert records[0]["command"] == "pytest -q"
    assert records[0]["exit_code"] == 0
    assert records[0]["duration_ms"] == 842


def test_events_are_parsed(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_synthetic_session(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    events = reader.events()

    assert len(events) == 1
    assert events[0]["kind"] == "file_change"
    assert events[0]["detail"]["path"] == "app.py"


def test_malformed_jsonl_line_is_skipped_not_raised(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    terminal_dir = session_dir / "terminal_log"
    terminal_dir.mkdir()
    (terminal_dir / "000000.jsonl").write_text("not json\n", encoding="utf-8")

    reader = SessionReader(session_dir)
    records = reader.terminal_log()

    assert records == []
    assert any("malformed" in s for s in reader.skipped)


def test_a_line_that_is_valid_json_but_fails_schema_validation_is_skipped(tmp_path: Path) -> None:
    """Valid JSON, wrong shape -- an unknown event `kind` is a schema violation, not a parse
    error, and must be distinguished from the malformed-JSON case above."""
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    events_dir = session_dir / "events"
    events_dir.mkdir()
    (events_dir / "000000.jsonl").write_text(
        json.dumps({"ts": 1.0, "kind": "not_a_real_kind", "detail": {}}) + "\n",
        encoding="utf-8",
    )

    reader = SessionReader(session_dir)
    events = reader.events()

    assert events == []
    assert any("schema validation" in s for s in reader.skipped)
