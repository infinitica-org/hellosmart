"""Drains the spool with retry/backoff against a pluggable backend.

In production the backend requests a short-lived presigned PUT URL from the orchestrator right
before each upload, so no AWS credentials ever live in the slot (services/ws-agent/CLAUDE.md's
existing non-negotiable). That backend isn't implementable or testable without a real
orchestrator, so it is deliberately a small `Uploader` protocol with one method: tests and local
dev run against `LocalFsUploader` (copies to another directory, standing in for "S3"), and the
one production backend (`PresignedUrlUploader`, not written yet -- needs the orchestrator's
token-issuing endpoint to exist first) implements the same protocol.

If the spool grows past `max_spool_bytes` (sustained network loss), oldest *raw terminal*
segments are dropped first -- they're the least load-bearing for scoring, since the structured
command log (small) is kept, and a git bundle is never dropped: losing one breaks replay of
every snapshot after it.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Protocol

from .spool import Spool

_DROP_FIRST_STREAM = "terminal_raw"


class Uploader(Protocol):
    def put(self, stream: str, local_path: Path) -> None:
        """Upload one spooled file. Raises on failure; the caller retries."""
        ...


class LocalFsUploader:
    """Stands in for S3 in tests and local dev: copies into `dest_root/<stream>/<name>`."""

    def __init__(self, dest_root: Path) -> None:
        self.dest_root = dest_root
        self.dest_root.mkdir(parents=True, exist_ok=True)

    def put(self, stream: str, local_path: Path) -> None:
        dest_dir = self.dest_root / stream
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / local_path.name).write_bytes(local_path.read_bytes())


class SpoolUploader:
    def __init__(
        self, spool: Spool, uploader: Uploader, max_spool_bytes: int = 500 * 1024 * 1024
    ) -> None:
        self.spool = spool
        self.uploader = uploader
        self.max_spool_bytes = max_spool_bytes

    def drain_once(self, streams: list[str], max_retries: int = 3) -> int:
        """One pass over every stream's pending files. Returns the count successfully
        uploaded. Enforces the spool size cap before uploading, so a long outage doesn't fill
        the slot's disk."""
        self._enforce_cap()
        uploaded = 0
        for stream in streams:
            for path in self.spool.pending(stream):
                if self._upload_with_retry(stream, path, max_retries):
                    self.spool.remove(path)
                    uploaded += 1
        return uploaded

    def _upload_with_retry(self, stream: str, path: Path, max_retries: int) -> bool:
        for attempt in range(max_retries):
            try:
                self.uploader.put(stream, path)
                return True
            except OSError:
                if attempt == max_retries - 1:
                    return False
                time.sleep(min(2**attempt, 10))
        return False

    def _enforce_cap(self) -> None:
        if self.spool.total_bytes() <= self.max_spool_bytes:
            return
        drop_dir = self.spool.root / _DROP_FIRST_STREAM
        if not drop_dir.exists():
            return
        for path in self.spool.pending(_DROP_FIRST_STREAM):
            if self.spool.total_bytes() <= self.max_spool_bytes:
                break
            self.spool.remove(path)
