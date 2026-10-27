"""AD-014b / live-session evidence: the first real evidence builder behind
agents/debugging-process.yaml, which has had a spec since AD-014a with nothing feeding it."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from evidence_sources.debugging_process import build_evidence


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    ).stdout.strip()


def _make_session_with_one_snapshot(session_dir: Path, scratch: Path) -> None:
    workspace = scratch / "workspace"
    workspace.mkdir(parents=True)
    _git(["init", "-q"], workspace)
    env = {
        **os.environ, "GIT_AUTHOR_NAME": "bot", "GIT_AUTHOR_EMAIL": "b@e.com",
        "GIT_COMMITTER_NAME": "bot", "GIT_COMMITTER_EMAIL": "b@e.com",
    }
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")
    _git(["add", "-A"], workspace, env=env)
    tree = _git(["write-tree"], workspace, env=env)
    commit = _git(["commit-tree", tree, "-m", "snap0"], workspace, env=env)
    _git(["update-ref", "refs/hs-snapshots/main", commit], workspace, env=env)

    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)
    bundle_path = str(bundles_dir / "000000.bundle")
    _git(["bundle", "create", bundle_path, "refs/hs-snapshots/main"], workspace)


def _write_terminal_log(session_dir: Path, rows: list[dict[str, object]]) -> None:
    terminal_dir = session_dir / "terminal_log"
    terminal_dir.mkdir(parents=True)
    text = "\n".join(json.dumps(r) for r in rows) + "\n"
    (terminal_dir / "000000.jsonl").write_text(text, encoding="utf-8")


def test_a_session_with_commands_and_a_snapshot_produces_both_fact_channels(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_session_with_one_snapshot(session_dir, tmp_path / "scratch")
    _write_terminal_log(
        session_dir,
        [
            {"command": "pytest -q", "cwd": "/workspace", "exit_code": 1, "duration_ms": 500},
            {"command": "pytest -q", "cwd": "/workspace", "exit_code": 0, "duration_ms": 520},
        ],
    )

    pack = build_evidence("sub-1", str(session_dir))

    assert pack.agent_id == "debugging-process"
    assert "term:fact.terminal_log.aggregate" in pack.refs
    assert "git:fact.session_timeline.aggregate" in pack.refs
    assert not pack.missing_required


def test_each_snapshot_is_its_own_citable_item_with_a_real_commit_sha(tmp_path: Path) -> None:
    """Architecture review requirement: every score must cite concrete evidence -- an exact
    commit hash, not just an aggregate stat like session_count."""
    session_dir = tmp_path / "session"
    _make_session_with_one_snapshot(session_dir, tmp_path / "scratch")
    row = {"command": "ls", "cwd": "/workspace", "exit_code": 0, "duration_ms": 10}
    _write_terminal_log(session_dir, [row])

    pack = build_evidence("sub-1", str(session_dir))

    snapshot_refs = [r for r in pack.refs if r.startswith("git:ev.snapshot.")]
    assert len(snapshot_refs) == 1
    item = pack.resolve(snapshot_refs[0])
    assert item is not None
    assert "commit=" in item.content
    assert len(item.content.split("commit=")[1].split(";")[0]) == 40  # a real git sha


def test_a_failed_command_is_reported_as_its_own_evidence_item(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_session_with_one_snapshot(session_dir, tmp_path / "scratch")
    _write_terminal_log(
        session_dir,
        [{"command": "pytest -q", "cwd": "/workspace", "exit_code": 1, "duration_ms": 500}],
    )

    pack = build_evidence("sub-1", str(session_dir))

    failed_refs = [r for r in pack.refs if r.startswith("term:ev.failed_command.")]
    assert len(failed_refs) == 1
    item = pack.resolve(failed_refs[0])
    assert item is not None
    assert "exit_code=1" in item.content


def test_ai_transcript_channel_is_reported_as_unavailable_not_silently_skipped(
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "session"
    _make_session_with_one_snapshot(session_dir, tmp_path / "scratch")
    row = {"command": "ls", "cwd": "/workspace", "exit_code": 0, "duration_ms": 10}
    _write_terminal_log(session_dir, [row])

    pack = build_evidence("sub-1", str(session_dir))

    ai_coverage = [c for c in pack.coverage if c.channel == "ai_transcript"]
    assert len(ai_coverage) == 1
    assert ai_coverage[0].status == "unavailable"


def test_no_session_data_at_all_is_missing_required(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    pack = build_evidence("sub-1", str(session_dir))
    assert "session_evidence" in pack.missing_required


def test_pack_is_deterministic(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    _make_session_with_one_snapshot(session_dir, tmp_path / "scratch")
    row = {"command": "ls", "cwd": "/workspace", "exit_code": 0, "duration_ms": 10}
    _write_terminal_log(session_dir, [row])

    p1 = build_evidence("sub-1", str(session_dir))
    p2 = build_evidence("sub-1", str(session_dir))
    assert p1.model_dump() == p2.model_dump()
