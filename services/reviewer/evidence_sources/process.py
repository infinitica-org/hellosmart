"""Evidence builder for the process agent (AD-014b).

Ported from ProjAgentScan's src/agents/process/evidence.py: commit-message semantics
(conventional-commit / generic-message detection), commit granularity (lines changed per
commit), and repo hygiene (.gitignore, committed build artifacts / dependency directories).
PR/review-quality evidence is not ported -- it is template-specific metadata this ticket has no
source for; the agent's rubric already treats that signal as not_applicable when absent.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .repo_io import RepoReader


@dataclass
class Commit:
    sha: str
    ts: int
    message: str
    lines: int = 0

_CONVENTIONAL_RE = re.compile(
    r"^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w\-./]+\))?:\s*.+",
    re.IGNORECASE,
)
_GENERIC_PATTERNS = {
    "update", "updates", "fix", "fixes", "wip", "asdf", "final", "test", "tests",
    "commit", "first commit", "initial commit", "changes", "done", "stuff", "temp", "patch",
}
_BAD_ARTIFACT_NAMES = {".ds_store", "thumbs.db", ".env"}
_BAD_ARTIFACT_DIRS = {
    "node_modules", "__pycache__", ".pytest_cache", ".ruff_cache", "venv", ".venv",
}


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _git_log(clone_dir: str) -> list[Commit]:
    try:
        # Fixed argv, no untrusted input in the command itself (only `cwd` is caller-supplied,
        # already a validated clone path) -- the candidate's own git history is what `git log`
        # reads, not executed.
        proc = subprocess.run(  # noqa: S603
            ["git", "log", "--no-merges", "--format=%H|%at|%s", "--numstat"],  # noqa: S607
            cwd=clone_dir, capture_output=True, text=True, check=True, timeout=30,
        )
    except (subprocess.CalledProcessError, OSError, subprocess.TimeoutExpired):
        return []

    commits: list[Commit] = []
    current: Commit | None = None
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("|", 2)
        if len(parts) == 3 and len(parts[0]) == 40:
            if current is not None:
                commits.append(current)
            current = Commit(sha=parts[0][:8], ts=int(parts[1]), message=parts[2])
        elif current is not None and "\t" in line:
            stat = line.split("\t")
            if len(stat) == 3:
                try:
                    added = int(stat[0]) if stat[0] != "-" else 0
                    removed = int(stat[1]) if stat[1] != "-" else 0
                except ValueError:
                    continue
                current.lines += added + removed
    if current is not None:
        commits.append(current)
    return commits


def _granularity_stats(commits: list[Commit]) -> dict[str, object]:
    if not commits:
        return {"total_commits": 0}
    total_lines = sum(c.lines for c in commits)
    under_300 = sum(1 for c in commits if c.lines <= 300)
    sorted_by_lines = sorted(commits, key=lambda c: c.lines, reverse=True)
    top_2 = sum(c.lines for c in sorted_by_lines[:2])

    conventional = sum(1 for c in commits if _CONVENTIONAL_RE.match(c.message.strip()))
    generic = 0
    for c in commits:
        msg = c.message.strip()
        first = msg.split()[0].lower().rstrip("!.,:;") if msg else ""
        clean = re.sub(r"[^a-zA-Z0-9\s]", "", msg).lower().strip()
        if clean in _GENERIC_PATTERNS or first in _GENERIC_PATTERNS:
            generic += 1

    n = len(commits)
    return {
        "total_commits": n,
        "commits_under_300_lines_pct": round(under_300 / n * 100, 2),
        "top_2_commits_lines_pct": round(top_2 / max(total_lines, 1) * 100, 2),
        "conventional_commits_pct": round(conventional / n * 100, 2),
        "generic_messages_pct": round(generic / n * 100, 2),
    }


def _hygiene(reader: RepoReader) -> dict[str, object]:
    has_gitignore = reader.exists(".gitignore")
    stray: list[str] = []
    dependency_dirs: list[str] = []
    for rel in reader.iter_files("any"):
        parts = rel.lower().split("/")
        base = parts[-1]
        if base in _BAD_ARTIFACT_NAMES:
            stray.append(rel)
        if any(d in _BAD_ARTIFACT_DIRS for d in parts[:-1]):
            dependency_dirs.append(rel)
    return {
        "has_gitignore": has_gitignore,
        "stray_artifact_count": len(stray),
        "committed_dependency_count": len(dependency_dirs),
    }


def build_evidence(submission_id: str, clone_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="process", submission_id=submission_id)
    commits = _git_log(clone_dir)
    if not commits:
        pack.missing_required.append("commit_log")
        pack.coverage.append(
            EvidenceCoverage(channel="git_timeline", status="unavailable", reason="no git history")
        )
        return pack

    stats = _granularity_stats(commits)
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.commit_granularity", source="git_timeline",
            content="; ".join(f"{k}={v}" for k, v in stats.items()),
            untrusted=False, sanitized=False,
        )
    )

    reader = RepoReader(clone_dir)
    hygiene = _hygiene(reader)
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.repo_hygiene", source="artifact",
            content="; ".join(f"{k}={v}" for k, v in hygiene.items()),
            untrusted=False, sanitized=False,
        )
    )

    for c in commits[:30]:
        ref = f"repo:ev.commit.{c.sha}"
        content = f"sha={c.sha}; lines_changed={c.lines}; message={c.message}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="git_timeline", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )

    pack.coverage.append(EvidenceCoverage(channel="git_timeline", status="available"))
    pack.coverage.append(
        EvidenceCoverage(
            channel="artifact", status="not_applicable",
            reason="PR/review metadata not exported for this submission",
        )
    )
    pack.truncations.extend(reader.truncations)
    return pack
