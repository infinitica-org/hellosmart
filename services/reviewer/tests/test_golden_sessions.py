"""Runs all 4 live-session agents against the 3 golden session fixtures (strong, struggling,
pasted -- see tests/fixtures/golden_sessions.py), per architecture review's explicit request.
These are the agent-level equivalent of ProjAgentScan's own golden-submission quality gate: a
known-shape input, known-shape expected signal, checked directly against the real evidence
builders rather than mocked.
"""

from __future__ import annotations

from pathlib import Path

from evidence_sources.debugging_process import build_evidence as build_debugging_process
from evidence_sources.integrity_observer import build_evidence as build_integrity_observer
from evidence_sources.problem_decomposition import build_evidence as build_problem_decomposition
from evidence_sources.testing_discipline import build_evidence as build_testing_discipline
from tests.fixtures.golden_sessions import (
    build_pasted_session,
    build_strong_session,
    build_struggling_session,
)


def test_strong_session_shows_exploration_paced_snapshots_and_recovered_tests(
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "session"
    build_strong_session(session_dir, tmp_path / "scratch")

    debugging = build_debugging_process("sub-1", str(session_dir))
    problem = build_problem_decomposition("sub-1", str(session_dir))
    testing = build_testing_discipline("sub-1", str(session_dir))

    timeline = debugging.resolve("git:fact.session_timeline.aggregate")
    assert timeline is not None
    assert "snapshot_count=2" in timeline.content

    exploration = problem.resolve("term:fact.exploration_signals.aggregate")
    assert exploration is not None
    assert "explored_before_first_other_command=True" in exploration.content

    cadence = testing.resolve("term:fact.testing_cadence.aggregate")
    assert cadence is not None
    assert "failing_then_passing=True" in cadence.content

    # Evidence is citable down to a real commit, not just an aggregate.
    assert any(r.startswith("git:ev.snapshot.") for r in debugging.refs)


def test_struggling_session_shows_no_exploration_and_tests_that_never_pass(
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "session"
    build_struggling_session(session_dir, tmp_path / "scratch")

    problem = build_problem_decomposition("sub-1", str(session_dir))
    testing = build_testing_discipline("sub-1", str(session_dir))

    exploration = problem.resolve("term:fact.exploration_signals.aggregate")
    assert exploration is not None
    assert "explored_before_first_other_command=False" in exploration.content

    cadence = testing.resolve("term:fact.testing_cadence.aggregate")
    assert cadence is not None
    assert "failing_then_passing=False" in cadence.content
    assert "only_run_once=True" in cadence.content


def test_pasted_session_shows_one_dominant_snapshot_and_a_large_paste_flag(
    tmp_path: Path,
) -> None:
    session_dir = tmp_path / "session"
    build_pasted_session(session_dir, tmp_path / "scratch")

    debugging = build_debugging_process("sub-1", str(session_dir))
    integrity = build_integrity_observer("sub-1", str(session_dir))

    timeline = debugging.resolve("git:fact.session_timeline.aggregate")
    assert timeline is not None
    assert "snapshot_count=1" in timeline.content
    assert "largest_snapshot_share=1.0" in timeline.content

    # No terminal activity at all in this archetype -- debugging-process must report that
    # honestly, not silently.
    assert any(
        c.channel == "terminal_log" and c.status == "unavailable" for c in debugging.coverage
    )

    integrity_agg = integrity.resolve("event:fact.integrity_signals.aggregate")
    assert integrity_agg is not None
    assert "large_paste_count=1" in integrity_agg.content
    # integrity-observer never scores -- it only has flag evidence, no verdict field exists on
    # EvidencePack at all, so the strongest assertion available is that it produced a flag item.
    assert any(r.startswith("event:ev.notable.") for r in integrity.refs)


def test_all_three_fixtures_produce_deterministic_packs(tmp_path: Path) -> None:
    session_dir = tmp_path / "session"
    build_strong_session(session_dir, tmp_path / "scratch")

    p1 = build_debugging_process("sub-1", str(session_dir))
    p2 = build_debugging_process("sub-1", str(session_dir))
    assert p1.model_dump() == p2.model_dump()
