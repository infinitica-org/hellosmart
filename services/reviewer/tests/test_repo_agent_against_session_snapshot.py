"""Proves the design claim made throughout this PR's commit history: the 8 `repo:`-based
agents need zero code changes to run against a live session's final git snapshot instead of an
arbitrary clone -- `SessionReader.materialize()` returns a plain directory, handed to
`code_quality.build_evidence()` exactly like any other clone path. This had never actually
been exercised end-to-end until this test."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from evidence_sources.code_quality import build_evidence
from evidence_sources.session_reader import SessionReader


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    ).stdout.strip()


def _make_session_from_a_real_candidate_workspace(session_dir: Path, scratch: Path) -> None:
    """One snapshot of a workspace that looks like real candidate code -- a function with a
    docstring, a README -- so code-quality's own checks (complexity, docstring samples) have
    something real to find, not just an empty tree."""
    workspace = scratch / "workspace"
    workspace.mkdir(parents=True)
    _git(["init", "-q"], workspace)
    env = {
        **os.environ, "GIT_AUTHOR_NAME": "bot", "GIT_AUTHOR_EMAIL": "b@e.com",
        "GIT_COMMITTER_NAME": "bot", "GIT_COMMITTER_EMAIL": "b@e.com",
    }
    (workspace / "app.py").write_text(
        'def add(a, b):\n    """Return the sum of a and b."""\n    return a + b\n',
        encoding="utf-8",
    )
    (workspace / "README.md").write_text("# App\n\nA small calculator.\n", encoding="utf-8")
    _git(["add", "-A"], workspace, env=env)
    tree = _git(["write-tree"], workspace, env=env)
    commit = _git(["commit-tree", tree, "-m", "snap0"], workspace, env=env)
    _git(["update-ref", "refs/hs-snapshots/main", commit], workspace, env=env)

    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)
    bundle_path = str(bundles_dir / "000000.bundle")
    _git(["bundle", "create", bundle_path, "refs/hs-snapshots/main"], workspace)


def test_code_quality_runs_unmodified_against_a_materialized_session_snapshot(
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "session"
    _make_session_from_a_real_candidate_workspace(session_dir, tmp_path / "scratch")

    reader = SessionReader(session_dir)
    worktree = reader.materialize()
    assert worktree is not None

    pack = build_evidence("sub-1", str(worktree))

    assert pack.agent_id == "code-quality"
    assert "repo:ev.readme" in pack.refs
    assert any(r.startswith("repo:ev.docstring.") for r in pack.refs)
    assert not pack.missing_required


def test_no_bundles_at_all_means_no_session_code_to_review(tmp_path: Path) -> None:
    """materialize() returning None (no git activity recorded) is the live-session equivalent
    of RepoReader seeing a missing clone -- the caller must check for it before calling any
    repo: agent, not assume a worktree always exists."""
    session_dir = tmp_path / "session"
    session_dir.mkdir()
    reader = SessionReader(session_dir)
    assert reader.materialize() is None
