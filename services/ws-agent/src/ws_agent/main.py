"""Wires the capture components to the spool and the uploader to the spool. This is the
process entrypoint for the real slot; it is not exercised by tests (which test each component
directly) -- there is nothing in here beyond construction and a run loop.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

from .git_snapshot import GitSnapshotter, NoChangesError, Snapshot
from .redact import redact
from .spool import Spool
from .uploader import SpoolUploader, Uploader

SNAPSHOT_INTERVAL_SECONDS = 15
UPLOAD_INTERVAL_SECONDS = 5
STREAMS = ("terminal_raw", "terminal_log", "git_bundles", "events", "heartbeat")


class Recorder:
    def __init__(self, workspace_dir: Path, spool_root: Path, uploader: Uploader) -> None:
        self.workspace_dir = workspace_dir
        self.spool = Spool(spool_root)
        self.spool_uploader = SpoolUploader(self.spool, uploader)
        self.snapshotter = GitSnapshotter(workspace_dir, spool_root / "_shadow_index")
        self._previous_snapshot: Snapshot | None = None
        self._stop = threading.Event()

    def on_raw_terminal(self, chunk: bytes) -> None:
        cleaned = redact(chunk.decode("utf-8", errors="replace")).encode()
        self.spool.write_bytes("terminal_raw", cleaned)

    def on_command(
        self, command: str, cwd: str | None, exit_code: int | None, duration_ms: int
    ) -> None:
        line = json.dumps(
            {
                "command": redact(command), "cwd": cwd, "exit_code": exit_code,
                "duration_ms": duration_ms,
            }
        )
        self.spool.write_line("terminal_log", line)

    def on_file_event(self, event: dict[str, object]) -> None:
        self.spool.write_line("events", json.dumps(event))

    def snapshot_tick(self) -> None:
        try:
            snap = self.snapshotter.snapshot()
        except NoChangesError:
            return
        bundle_path = self.spool.root / "git_bundles" / f"{snap.seq:06d}.bundle"
        bundle_path.parent.mkdir(parents=True, exist_ok=True)
        self.snapshotter.bundle_for(snap, self._previous_snapshot, bundle_path)
        self._previous_snapshot = snap

    def upload_tick(self) -> None:
        self.spool.rotate_jsonl("terminal_log")
        self.spool.rotate_jsonl("events")
        self.spool_uploader.drain_once(list(STREAMS))

    def run_forever(self) -> None:
        next_snapshot = time.monotonic()
        next_upload = time.monotonic()
        while not self._stop.is_set():
            now = time.monotonic()
            if now >= next_snapshot:
                self.snapshot_tick()
                next_snapshot = now + SNAPSHOT_INTERVAL_SECONDS
            if now >= next_upload:
                self.upload_tick()
                next_upload = now + UPLOAD_INTERVAL_SECONDS
            time.sleep(0.5)

    def stop(self) -> None:
        self._stop.set()
