"""Evidence builder for the problem-decomposition agent (live-session evidence plan).

Combines checks/exploration_signals.py (command-ordering: did exploration happen before
acting) and checks/session_timeline.py (snapshot pacing, shared with debugging-process).
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack

from .checks.exploration_signals import analyze_exploration
from .checks.session_timeline import analyze_session_timeline
from .session_reader import SessionReader


def _add_exploration_facts(pack: EvidencePack, reader: SessionReader) -> bool:
    result = analyze_exploration(reader.terminal_log())
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="terminal_log", status="unavailable", reason="no commands recorded"
            )
        )
        return False

    ref = "term:fact.exploration_signals.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in result.items()),
            untrusted=False, sanitized=False,
        )
    )
    return True


def _add_session_timeline_facts(pack: EvidencePack, reader: SessionReader) -> bool:
    result = analyze_session_timeline(reader.snapshot_timeline())
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="git_timeline", status="unavailable", reason="no snapshots recorded"
            )
        )
        return False

    ref = "git:fact.session_timeline.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in result.items()),
            untrusted=False, sanitized=False,
        )
    )
    return True


def build_evidence(submission_id: str, session_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="problem-decomposition", submission_id=submission_id)
    reader = SessionReader(session_dir)

    has_exploration = _add_exploration_facts(pack, reader)
    has_timeline = _add_session_timeline_facts(pack, reader)

    if reader.skipped:
        pack.truncations.extend(reader.skipped)
    if not has_exploration and not has_timeline:
        pack.missing_required.append("session_evidence")
    return pack
