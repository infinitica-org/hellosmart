"""Evidence builder for the ai-authorship-maturity agent (AD-014b).

Narrower first-pass port of ProjAgentScan's src/agents/ai_authorship_maturity/evidence.py:
per-file commit counts and whether a file's follow-up commits (after its first) carry a
meaningful diff, as a proxy for "iterative refinement vs one-shot dump". ProjAgentScan's
original also detects commit-count stuffing and squashed-history edge cases; that depth is a
follow-up, not carried over here -- the agent's own disallowed_inferences already tell the model
not to over-read a squashed history as low refinement.
"""

from __future__ import annotations

import subprocess
from collections import defaultdict
from dataclasses import dataclass, field

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .repo_io import safe_id

MAX_FILES_REPORTED = 20


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


@dataclass
class _FileHistory:
    commit_count: int = 0
    first_commit_lines: int = 0
    later_substantive_commits: int = 0
    revisions: list[int] = field(default_factory=list)


def _per_file_history(clone_dir: str) -> dict[str, _FileHistory]:
    try:
        # Fixed argv, no untrusted input in the command itself (only `cwd` is caller-supplied,
        # already a validated clone path).
        proc = subprocess.run(  # noqa: S603
            ["git", "log", "--no-merges", "--reverse", "--format=C|%H", "--numstat"],  # noqa: S607
            cwd=clone_dir, capture_output=True, text=True, check=True, timeout=30,
        )
    except (subprocess.CalledProcessError, OSError, subprocess.TimeoutExpired):
        return {}

    history: dict[str, _FileHistory] = defaultdict(_FileHistory)
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("C|"):
            continue
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        try:
            added = int(parts[0]) if parts[0] != "-" else 0
            removed = int(parts[1]) if parts[1] != "-" else 0
        except ValueError:
            continue
        path = parts[2]
        h = history[path]
        lines_changed = added + removed
        if h.commit_count == 0:
            h.first_commit_lines = lines_changed
        elif lines_changed >= 2:  # a trivial 0-1 line touch is not a substantive revision
            h.later_substantive_commits += 1
        h.commit_count += 1
        h.revisions.append(lines_changed)
    return dict(history)


def build_evidence(submission_id: str, clone_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="ai-authorship-maturity", submission_id=submission_id)
    history = _per_file_history(clone_dir)
    if not history:
        pack.missing_required.append("commit_log")
        pack.coverage.append(
            EvidenceCoverage(channel="git_timeline", status="unavailable", reason="no git history")
        )
        return pack

    touched_more_than_once = {p: h for p, h in history.items() if h.commit_count > 1}
    refined = sum(1 for h in touched_more_than_once.values() if h.later_substantive_commits > 0)
    total_touched = len(touched_more_than_once)

    ref = "repo:fact.refinement_summary"
    summary = (
        f"files_touched_more_than_once={total_touched}; "
        f"files_with_substantive_followup={refined}; "
        f"total_files_in_history={len(history)}"
    )
    pack.items.append(
        EvidenceItem(
            ref=ref, source="git_timeline", content=summary, untrusted=False, sanitized=False
        )
    )

    ranked = sorted(touched_more_than_once.items(), key=lambda kv: -kv[1].commit_count)
    for path, h in ranked[:MAX_FILES_REPORTED]:
        safe_path, _ = safe_id(path)
        item_ref = f"repo:ev.file_history.{safe_path}"
        content = (
            f"file={path}; commits={h.commit_count}; "
            f"substantive_followups={h.later_substantive_commits}; revisions={h.revisions}"
        )
        pack.items.append(
            EvidenceItem(
                ref=item_ref, source="git_timeline", content=_sanitize(pack, item_ref, content),
                untrusted=True, sanitized=True,
            )
        )

    pack.coverage.append(EvidenceCoverage(channel="git_timeline", status="available"))
    return pack
