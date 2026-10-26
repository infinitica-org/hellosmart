from __future__ import annotations

from pathlib import Path

from ws_agent.spool import Spool


def test_write_bytes_is_atomic_no_tmp_files_visible_as_pending(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_raw", b"hello")
    pending = spool.pending("terminal_raw")
    assert len(pending) == 1
    assert pending[0].suffix != ".tmp"
    assert pending[0].read_bytes() == b"hello"


def test_files_drain_in_write_order(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    for i in range(5):
        spool.write_bytes("terminal_raw", str(i).encode())
    pending = spool.pending("terminal_raw")
    assert [p.read_bytes() for p in pending] == [str(i).encode() for i in range(5)]


def test_streams_are_independent(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_raw", b"a")
    spool.write_bytes("git_bundles", b"b")
    assert len(spool.pending("terminal_raw")) == 1
    assert len(spool.pending("git_bundles")) == 1


def test_write_line_appends_to_current_segment(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_line("terminal_log", '{"a": 1}')
    spool.write_line("terminal_log", '{"a": 2}')
    current = (tmp_path / "spool" / "terminal_log" / "current.jsonl").read_text(encoding="utf-8")
    assert current.splitlines() == ['{"a": 1}', '{"a": 2}']


def test_rotate_jsonl_seals_the_segment_and_starts_fresh(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_line("terminal_log", '{"a": 1}')
    sealed = spool.rotate_jsonl("terminal_log")
    assert sealed is not None
    assert sealed.read_text(encoding="utf-8").strip() == '{"a": 1}'

    spool.write_line("terminal_log", '{"a": 2}')
    current = (tmp_path / "spool" / "terminal_log" / "current.jsonl").read_text(encoding="utf-8")
    assert current.strip() == '{"a": 2}'


def test_rotate_jsonl_with_nothing_pending_returns_none(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    assert spool.rotate_jsonl("terminal_log") is None


def test_remove_is_idempotent(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    path = spool.write_bytes("terminal_raw", b"x")
    spool.remove(path)
    spool.remove(path)  # must not raise
    assert spool.pending("terminal_raw") == []


def test_total_bytes_sums_across_streams(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_raw", b"12345")
    spool.write_bytes("git_bundles", b"1234567890")
    assert spool.total_bytes() == 15
