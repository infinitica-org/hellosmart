from __future__ import annotations

from pathlib import Path

from ws_agent.spool import Spool
from ws_agent.uploader import LocalFsUploader, SpoolUploader


class FlakyUploader:
    """Fails the first `fail_times` calls, then succeeds -- exercises retry/backoff."""

    def __init__(self, fail_times: int) -> None:
        self.fail_times = fail_times
        self.calls = 0
        self.succeeded: list[tuple[str, str]] = []

    def put(self, stream: str, local_path: Path) -> None:
        self.calls += 1
        if self.calls <= self.fail_times:
            raise OSError("simulated network failure")
        self.succeeded.append((stream, local_path.name))


class AlwaysFailsUploader:
    def put(self, stream: str, local_path: Path) -> None:
        raise OSError("simulated permanent failure")


def test_successful_upload_removes_from_spool(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("git_bundles", b"bundle-data")
    dest = LocalFsUploader(tmp_path / "s3")
    uploader = SpoolUploader(spool, dest)

    count = uploader.drain_once(["git_bundles"])

    assert count == 1
    assert spool.pending("git_bundles") == []
    uploaded = next(iter((tmp_path / "s3" / "git_bundles").iterdir()))
    assert uploaded.read_bytes() == b"bundle-data"


def test_retry_eventually_succeeds(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_log", b'{"a": 1}')
    flaky = FlakyUploader(fail_times=2)
    uploader = SpoolUploader(spool, flaky)

    count = uploader.drain_once(["terminal_log"], max_retries=3)

    assert count == 1
    assert spool.pending("terminal_log") == []


def test_exhausted_retries_leaves_file_in_spool(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_log", b"x")
    uploader = SpoolUploader(spool, AlwaysFailsUploader())

    count = uploader.drain_once(["terminal_log"], max_retries=2)

    assert count == 0
    assert len(spool.pending("terminal_log")) == 1


def test_git_bundles_are_never_dropped_even_over_the_cap(tmp_path: Path) -> None:
    """Losing a git bundle breaks replay of every snapshot after it -- the cap-enforcement
    must never touch that stream, only terminal_raw."""
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("git_bundles", b"x" * 1000)
    spool.write_bytes("terminal_raw", b"y" * 1000)
    uploader = SpoolUploader(spool, AlwaysFailsUploader(), max_spool_bytes=500)

    uploader.drain_once(["git_bundles", "terminal_raw"], max_retries=1)

    assert len(spool.pending("git_bundles")) == 1
    assert spool.pending("terminal_raw") == []


def test_under_the_cap_nothing_is_dropped(tmp_path: Path) -> None:
    spool = Spool(tmp_path / "spool")
    spool.write_bytes("terminal_raw", b"x" * 10)
    uploader = SpoolUploader(spool, LocalFsUploader(tmp_path / "s3"), max_spool_bytes=1_000_000)

    uploader.drain_once(["terminal_raw"])

    assert spool.pending("terminal_raw") == []  # uploaded, not dropped
