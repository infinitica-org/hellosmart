"""Shared git-history plumbing (ported from ProjAgentScan's src/checks/provenance/_git.py,
logic unchanged; the fact-store wrapper was dropped, see package docstring).

Reads only the clone's own `.git` object database via `git log --numstat` -- never a candidate's
working-tree file content, and never commit messages, author names or emails (identities are a
separate, pseudonymized concern). `git log` itself is read-only and never executes anything from
the candidate's tree.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import TypedDict

TIMEOUT_S = 30
_RECORD_SEP = "\x01"


class FileChange(TypedDict):
    path: str
    added: int
    removed: int


class Commit(TypedDict):
    sha: str
    ts: int
    files: list[FileChange]


def has_git_history(clone_dir: Path | str) -> bool:
    return (Path(clone_dir) / ".git").is_dir()


def git_log(clone_dir: Path | str) -> tuple[str | None, str | None]:
    """Run `git log --numstat` once. Returns (stdout, None) or (None, reason)."""
    try:
        # Fixed argv, no untrusted input in the command itself (only `cwd` is caller-supplied,
        # already a validated clone path) -- the candidate's own git history is what `git log`
        # reads, not executed.
        proc = subprocess.run(  # noqa: S603
            ["git", "log", "--no-merges", f"--format={_RECORD_SEP}%H|%at", "--numstat"],  # noqa: S607
            cwd=str(clone_dir), capture_output=True, text=True, timeout=TIMEOUT_S,
            encoding="utf-8", errors="replace",
        )
    except subprocess.TimeoutExpired:
        return None, f"timed out after {TIMEOUT_S}s"
    except (OSError, subprocess.SubprocessError) as e:
        return None, type(e).__name__
    if proc.returncode != 0:
        return None, "git log exited non-zero"
    return proc.stdout, None


def parse_log(output: str) -> list[Commit]:
    """[{sha, ts, files: [{path, added, removed}]}], oldest first. Binary files report
    added=removed=0."""
    commits: list[Commit] = []
    for raw_record in output.split(_RECORD_SEP):
        record = raw_record.strip("\n")
        if not record:
            continue
        lines = record.splitlines()
        header, rows = lines[0], lines[1:]
        sha, _, ts_raw = header.partition("|")
        try:
            ts = int(ts_raw)
        except ValueError:
            continue
        files: list[FileChange] = []
        for row in rows:
            parts = row.split("\t")
            if len(parts) != 3:
                continue
            added_raw, removed_raw, path = parts
            added = int(added_raw) if added_raw.isdigit() else 0
            removed = int(removed_raw) if removed_raw.isdigit() else 0
            files.append({"path": path, "added": added, "removed": removed})
        commits.append({"sha": sha, "ts": ts, "files": files})
    commits.sort(key=lambda c: c["ts"])
    return commits
