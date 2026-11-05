"""Shared helper for emitting per-snapshot citable evidence items -- used by every
live-session agent that cites `git_timeline` evidence (debugging-process,
problem-decomposition so far). Centralized so the citation shape (exact commit sha, not just an
aggregate stat) stays consistent across agents rather than being reimplemented per builder.

Per architecture review feedback on this PR: "Every score emitted must cite concrete evidence
-- exact commit hash, file path, line numbers, or terminal snippet. No agent can emit a rating
without citations." An aggregate fact (`session_count=2`) is not itself a citable claim about
any specific point in the session -- this is what makes an individual snapshot citable.
"""

from __future__ import annotations

from app.evidence import EvidenceItem, EvidencePack

from .session_reader import SnapshotInfo

MAX_SNAPSHOT_CITATIONS = 10


def add_snapshot_citations(pack: EvidencePack, snapshots: list[SnapshotInfo]) -> None:
    for snap in snapshots[:MAX_SNAPSHOT_CITATIONS]:
        ref = f"git:ev.snapshot.{snap['seq']}"
        content = (
            f"commit={snap['commit_sha']}; seq={snap['seq']}; ts={snap['ts']}; "
            f"lines_changed={snap['lines_changed']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=content, untrusted=False, sanitized=False,
            )
        )
