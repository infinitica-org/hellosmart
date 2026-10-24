"""AD-014b: ai-authorship-maturity evidence builder, against a real throwaway git repo."""

from __future__ import annotations

import subprocess
from pathlib import Path

from evidence_sources.ai_authorship_maturity import build_evidence


def _git(args: list[str], cwd: Path) -> None:
    subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True  # noqa: S607
    )


def _init_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(["init", "-q", "-b", "main"], repo)
    _git(["config", "user.email", "c@example.invalid"], repo)
    _git(["config", "user.name", "c"], repo)
    return repo


def test_iteratively_refined_file_is_detected(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "initial"], repo)

    (repo / "app.py").write_text(
        "def run():\n    if True:\n        return 1\n    return 0\n", encoding="utf-8"
    )
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "refine"], repo)

    pack = build_evidence("sub-1", str(repo))
    summary = pack.resolve("repo:fact.refinement_summary")
    assert summary is not None
    assert "files_touched_more_than_once=1" in summary.content
    assert "files_with_substantive_followup=1" in summary.content


def test_one_shot_file_shows_no_followup(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "initial"], repo)

    pack = build_evidence("sub-1", str(repo))
    summary = pack.resolve("repo:fact.refinement_summary")
    assert summary is not None
    assert "files_touched_more_than_once=0" in summary.content


def test_no_git_history_is_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "not_a_repo"
    root.mkdir()
    pack = build_evidence("sub-1", str(root))
    assert "commit_log" in pack.missing_required


def test_pack_is_deterministic(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "initial"], repo)

    p1 = build_evidence("sub-1", str(repo))
    p2 = build_evidence("sub-1", str(repo))
    assert p1.model_dump() == p2.model_dump()
