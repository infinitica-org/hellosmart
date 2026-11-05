from __future__ import annotations

from evidence_sources.checks.session_timeline import analyze_session_timeline
from evidence_sources.session_reader import SnapshotInfo


def _snap(seq: int, ts: float, lines_changed: int) -> SnapshotInfo:
    return {"seq": seq, "commit_sha": f"sha{seq}", "ts": ts, "lines_changed": lines_changed}


def test_no_snapshots_returns_none() -> None:
    assert analyze_session_timeline([]) is None


def test_steady_small_edits_count_as_one_session() -> None:
    snapshots = [_snap(0, 0, 5), _snap(1, 60, 5), _snap(2, 120, 5)]
    result = analyze_session_timeline(snapshots)
    assert result is not None
    assert result["session_count"] == 1
    assert result["snapshot_count"] == 3
    assert result["total_lines_changed"] == 15


def test_a_long_gap_between_snapshots_starts_a_new_session() -> None:
    snapshots = [_snap(0, 0, 5), _snap(1, 60, 5), _snap(2, 60 + 30 * 60, 5)]
    result = analyze_session_timeline(snapshots)
    assert result is not None
    assert result["session_count"] == 2


def test_multiple_long_gaps_count_multiple_sessions() -> None:
    snapshots = [_snap(0, 0, 5), _snap(1, 2000, 5), _snap(2, 4000, 5)]
    result = analyze_session_timeline(snapshots)
    assert result is not None
    assert result["session_count"] == 3


def test_a_single_huge_snapshot_dominates_the_share() -> None:
    """The "wrote it all at once" red flag debugging-process.yaml's own anchors name --
    one snapshot that accounts for nearly all the session's total change."""
    snapshots = [_snap(0, 0, 5), _snap(1, 60, 500), _snap(2, 120, 5)]
    result = analyze_session_timeline(snapshots)
    assert result is not None
    assert result["largest_single_snapshot_lines"] == 500
    assert result["largest_snapshot_share"] > 0.9


def test_a_single_snapshot_session_has_zero_dominance_issue() -> None:
    result = analyze_session_timeline([_snap(0, 0, 10)])
    assert result is not None
    assert result["session_count"] == 1
    assert result["largest_snapshot_share"] == 1.0
