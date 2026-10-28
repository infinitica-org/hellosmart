"""Tests the shadow-commit snapshotter against real throwaway git repos -- same spirit as the
reviewer's own git-based tests (services/reviewer/tests/test_ai_authorship_maturity_evidence.py):
a real `git` binary, a real temp repo, no mocking of git itself."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from ws_agent.git_snapshot import GitSnapshotter, NoChangesError


def _git(args: list[str], cwd: Path) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True  # noqa: S607
    ).stdout.strip()


def test_first_snapshot_captures_untracked_files(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")
    snap = snapshotter.snapshot()

    assert snap.seq == 0
    assert snap.is_full
    tree_files = _git(["ls-tree", "-r", "--name-only", snap.commit_sha], workspace)
    assert "app.py" in tree_files.splitlines()


def test_candidate_s_own_head_and_index_are_never_touched(tmp_path: Path) -> None:
    """The snapshotter must not disturb whatever the candidate has staged or committed on
    their own branch -- that's the entire point of using a shadow index and a separate ref."""
    workspace = tmp_path / "ws"
    workspace.mkdir()
    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")  # runs `git init`

    (workspace / "a.py").write_text("a = 1\n", encoding="utf-8")
    _git(["add", "a.py"], workspace)
    _git(
        ["-c", "user.email=c@example.invalid", "-c", "user.name=c", "commit", "-q", "-m", "init"],
        workspace,
    )
    (workspace / "b.py").write_text("b = 1\n", encoding="utf-8")  # untracked, unstaged on HEAD

    head_before = _git(["rev-parse", "HEAD"], workspace)
    status_before = _git(["status", "--porcelain=v1"], workspace)

    snapshotter.snapshot()

    assert _git(["rev-parse", "HEAD"], workspace) == head_before
    assert _git(["status", "--porcelain=v1"], workspace) == status_before


def test_unchanged_workspace_raises_no_changes(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")
    snapshotter.snapshot()
    with pytest.raises(NoChangesError):
        snapshotter.snapshot()


def test_second_snapshot_is_parented_on_the_first(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")
    snap1 = snapshotter.snapshot()
    (workspace / "app.py").write_text("x = 2\n", encoding="utf-8")
    snap2 = snapshotter.snapshot()

    parents = _git(["log", "--format=%P", "-1", snap2.commit_sha], workspace)
    assert parents.strip() == snap1.commit_sha
    assert not snap2.is_full


def test_bundle_for_first_snapshot_contains_the_file(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")
    snap = snapshotter.snapshot()
    bundle_path = tmp_path / "0000.bundle"
    snapshotter.bundle_for(snap, previous=None, out_path=bundle_path)

    assert bundle_path.exists()
    _git(["bundle", "verify", str(bundle_path)], workspace)


def test_bundle_for_second_snapshot_is_incremental_and_replays_correctly(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    snapshotter = GitSnapshotter(workspace, tmp_path / "shadow_index")
    snap1 = snapshotter.snapshot()
    bundle1 = tmp_path / "0000.bundle"
    snapshotter.bundle_for(snap1, previous=None, out_path=bundle1)

    (workspace / "app.py").write_text("x = 2\n", encoding="utf-8")
    snap2 = snapshotter.snapshot()
    bundle2 = tmp_path / "0001.bundle"
    snapshotter.bundle_for(snap2, previous=snap1, out_path=bundle2)

    # Replay both bundles into a fresh bare repo, independent of the original workspace --
    # this is exactly what the reviewer's SessionReader will do.
    replay = tmp_path / "replay"
    replay.mkdir()
    _git(["init", "-q", "--bare"], replay)
    _git(["bundle", "unbundle", str(bundle1)], replay)
    _git(["bundle", "unbundle", str(bundle2)], replay)

    content = _git(["show", f"{snap2.commit_sha}:app.py"], replay)
    assert content == "x = 2"
