"""AD-014b: ai-authorship-maturity evidence builder (full depth: edit-concentration,
substantive-revision-count, signal-stuffing, boilerplate markers), against real throwaway git
repos."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from evidence_sources.ai_authorship_maturity import build_evidence

BASE_TS = 1700000000


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> None:
    subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    )


def _init_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(["init", "-q", "-b", "main"], repo)
    _git(["config", "user.email", "c@example.invalid"], repo)
    _git(["config", "user.name", "c"], repo)
    return repo


def _commit(repo: Path, message: str, commit_index: int) -> None:
    """Commits made within the same shell session can land in the same Unix second, which makes
    `git_log`'s sort-by-%at non-deterministic about which commit came first -- deterministic,
    strictly increasing timestamps avoid that, same convention ProjAgentScan's own ai_authorship_
    maturity test fixtures use."""
    ts = BASE_TS + commit_index * 86400
    env = {**os.environ, "GIT_AUTHOR_DATE": f"{ts} +0000", "GIT_COMMITTER_DATE": f"{ts} +0000"}
    _git(["add", "-A"], repo)
    _git(["commit", "-q", "-m", message], repo, env=env)


def test_iteratively_refined_file_shows_a_substantive_revision(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text("def run():\n    return 1\n", encoding="utf-8")
    _commit(repo, "initial", 0)

    (repo / "app.py").write_text(
        "def run():\n"
        + "".join(f"    step_{i}()\n" for i in range(10))
        + "    return 1\n",
        encoding="utf-8",
    )
    _commit(repo, "refine", 1)

    pack = build_evidence("sub-1", str(repo))
    summary = pack.resolve("repo:fact.refinement_summary")
    assert summary is not None
    assert "files_with_stuffed_revisions=0" in summary.content
    file_history = pack.resolve("repo:ev.file_history.app_py")
    assert file_history is not None
    assert "revision_count=1" in file_history.content
    assert "substantive_revision_count=1" in file_history.content


def test_cosmetic_only_followup_is_detected_as_stuffed(tmp_path: Path) -> None:
    """A file touched again, but only by a trivial (<=2 line) edit, "looks" iterated on by
    revision_count alone -- this is exactly the signal-stuffing case the full-depth port adds
    over the narrower first pass, which only compared first-vs-later diff size, not cosmetic-vs-
    substantive."""
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text(
        "\n".join(f"line_{i} = {i}" for i in range(50)) + "\n", encoding="utf-8"
    )
    _commit(repo, "initial", 0)

    # Modifies exactly one existing line (git reports this as -1/+1 = 2 lines touched, at, not
    # over, COSMETIC_CHANGE_LINES -- deliberately the boundary case).
    lines = [f"line_{i} = {i}" for i in range(50)]
    lines[0] = "line_0 = 0  # tweak"
    (repo / "app.py").write_text("\n".join(lines) + "\n", encoding="utf-8")
    _commit(repo, "cosmetic tweak", 1)

    pack = build_evidence("sub-1", str(repo))
    summary = pack.resolve("repo:fact.refinement_summary")
    assert summary is not None
    assert "files_with_stuffed_revisions=1" in summary.content
    file_history = pack.resolve("repo:ev.file_history.app_py")
    assert file_history is not None
    assert "revision_count=1" in file_history.content
    assert "substantive_revision_count=0" in file_history.content


def test_boilerplate_marker_in_current_text_is_flagged(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text(
        "def run():\n    pass  # stub\n", encoding="utf-8"
    )
    _commit(repo, "initial", 0)

    pack = build_evidence("sub-1", str(repo))
    flag = pack.resolve("repo:ev.boilerplate_flag.app_py")
    assert flag is not None
    assert "placeholder_stub" in flag.content


def test_one_shot_large_commit_is_low_iteration(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "app.py").write_text(
        "\n".join(f"line_{i} = {i}" for i in range(600)) + "\n", encoding="utf-8"
    )
    _commit(repo, "initial dump", 0)

    pack = build_evidence("sub-1", str(repo))
    summary = pack.resolve("repo:fact.refinement_summary")
    assert summary is not None
    assert "large_single_commit_pct=100.0" in summary.content


def test_no_git_history_is_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "not_a_repo"
    root.mkdir()
    pack = build_evidence("sub-1", str(root))
    assert "commit_log" in pack.missing_required


def test_commit_history_fact_and_raw_sample_are_reported(tmp_path: Path) -> None:
    """commit_history is a structurally distinct fact from refinement/boilerplate signals --
    total activity and cadence, not revision-stuffing -- and the rubric cites it separately;
    the narrower depth pass had no fact or raw commit sample to back it at all."""
    repo = _init_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    _commit(repo, "initial", 0)
    (repo / "a.py").write_text("x = 1\ny = 2\n", encoding="utf-8")
    _commit(repo, "follow up", 1)

    pack = build_evidence("sub-1", str(repo))
    history = pack.resolve("repo:fact.commit_history")
    assert history is not None
    assert "total_commits=2" in history.content
    assert "files_touched=1" in history.content
    assert "avg_time_between_commits_hours=24.0" in history.content

    sample = pack.resolve("repo:ev.commits.sample")
    assert sample is not None
    assert "a.py +1/-0" in sample.content
    assert "a.py +1/-0" in sample.content or "a.py +2/-0" in sample.content


def test_pack_is_deterministic(tmp_path: Path) -> None:
    repo = _init_repo(tmp_path)
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    _commit(repo, "initial", 0)

    p1 = build_evidence("sub-1", str(repo))
    p2 = build_evidence("sub-1", str(repo))
    assert p1.model_dump() == p2.model_dump()
