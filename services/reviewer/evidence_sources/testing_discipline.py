"""Evidence builder for the testing-discipline agent (live-session evidence plan).

Combines checks/testing_cadence.py (run count, failing-then-passing) and
checks/terminal_log.py's existing aggregate (time-to-first-test-run, already computed for
debugging-process -- reused here rather than recomputed).
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack

from .checks.terminal_log import analyze_terminal_log
from .checks.testing_cadence import analyze_testing_cadence
from .session_reader import SessionReader


def build_evidence(submission_id: str, session_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="testing-discipline", submission_id=submission_id)
    reader = SessionReader(session_dir)
    commands = reader.terminal_log()

    cadence = analyze_testing_cadence(commands)
    terminal_agg = analyze_terminal_log(commands)

    if cadence is None or terminal_agg is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="terminal_log", status="unavailable", reason="no commands recorded"
            )
        )
        pack.missing_required.append("session_evidence")
        if reader.skipped:
            pack.truncations.extend(reader.skipped)
        return pack

    ref = "term:fact.testing_cadence.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in cadence.items()),
            untrusted=False, sanitized=False,
        )
    )
    ref = "term:fact.terminal_log.time_to_first_test_run_ms"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content=str(terminal_agg["time_to_first_test_run_ms"]),
            untrusted=False, sanitized=False,
        )
    )

    if reader.skipped:
        pack.truncations.extend(reader.skipped)
    return pack
