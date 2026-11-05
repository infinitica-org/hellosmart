"""AD-014b: process evidence builder (git log / hygiene), against a real throwaway git repo."""

from __future__ import annotations

import subprocess
from pathlib import Path

from evidence_sources.process import build_evidence


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


def test_conventional_commits_and_clean_hygiene(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / ".gitignore").write_text("__pycache__/\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "chore: add gitignore"], repo)
    (repo / "app.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "feat(core): add run entry point"], repo)

    pack = build_evidence("sub-1", str(repo))
    granularity = pack.resolve("repo:fact.commit_granularity")
    hygiene = pack.resolve("repo:fact.repo_hygiene")
    assert granularity is not None and "total_commits=2" in granularity.content
    assert "conventional_commits_pct=100.0" in granularity.content
    assert hygiene is not None and "has_gitignore=True" in hygiene.content


def test_generic_commit_messages_are_detected(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    for msg in ("wip", "update", "fix"):
        (repo / "f.py").write_text(f"# {msg}\n", encoding="utf-8")
        _git(["add", "-A"], repo)
        _git(["commit", "-q", "-m", msg], repo)

    pack = build_evidence("sub-1", str(repo))
    granularity = pack.resolve("repo:fact.commit_granularity")
    assert granularity is not None
    assert "generic_messages_pct=100.0" in granularity.content
    assert "conventional_commits_pct=0.0" in granularity.content


def test_no_git_history_is_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "not_a_repo"
    root.mkdir()
    pack = build_evidence("sub-1", str(root))
    assert "commit_log" in pack.missing_required


def test_pack_is_deterministic(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", "feat: add a"], repo)

    p1 = build_evidence("sub-1", str(repo))
    p2 = build_evidence("sub-1", str(repo))
    assert p1.model_dump() == p2.model_dump()
