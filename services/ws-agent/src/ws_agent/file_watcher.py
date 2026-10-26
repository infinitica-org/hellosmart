"""Workspace file-change events, batched into `events.jsonl`.

Built on `watchdog` rather than calling inotify directly: watchdog abstracts inotify (Linux,
the production target) behind the same API as the backends for other platforms, which also
means this module is testable in dev environments that aren't Linux -- the only platform
dependency is pushed into a library that already handles it correctly.

Deliberately narrow scope: file-change events and idle detection, not a second heavyweight
"editor state" capture surface. See docs discussion: the git-snapshot timeline plus these
events already cover what the planned agents need; richer editor telemetry is an explicit
future scope addition, not something to build speculatively now.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

EventSink = Callable[[dict[str, object]], None]


class _Handler(FileSystemEventHandler):
    def __init__(self, sink: EventSink, exclude_dirs: frozenset[str]) -> None:
        self._sink = sink
        self._exclude_dirs = exclude_dirs

    def _excluded(self, path: str) -> bool:
        parts = Path(path).parts
        return any(p in self._exclude_dirs for p in parts)

    def on_any_event(self, event: FileSystemEvent) -> None:
        if event.is_directory or self._excluded(str(event.src_path)):
            return
        self._sink(
            {
                "ts": time.time(),
                "kind": "file_change",
                "detail": {"path": str(event.src_path), "change": event.event_type},
            }
        )


class FileWatcher:
    """Exclude `.git` (the snapshotter's own churn, not candidate activity) and any configured
    secrets directory -- file *names* reaching the event log are workspace-relative paths, not
    file contents, so this doesn't need the same redaction as terminal output; it still excludes
    the secrets directory so its mere existence/rename pattern isn't logged either."""

    def __init__(
        self, workspace_dir: Path, sink: EventSink, exclude_dirs: frozenset[str] = frozenset()
    ) -> None:
        self.workspace_dir = workspace_dir
        self._observer = Observer()
        self._handler = _Handler(sink, exclude_dirs | {".git", "node_modules", ".venv"})

    def start(self) -> None:
        self._observer.schedule(self._handler, str(self.workspace_dir), recursive=True)
        self._observer.start()

    def stop(self) -> None:
        self._observer.stop()
        self._observer.join(timeout=5)
