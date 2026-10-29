"""A durable local queue between capture and upload.

Capturers (terminal, git snapshotter, file watcher) only ever write here; a separate uploader
drains it with retry/backoff. This is what keeps a network blip or an expired presigned URL
from losing data -- capture never blocks on network state. Entries are files on disk, named so
they drain in the order they were written; each capture stream gets its own subdirectory so one
slow stream never head-of-line-blocks another.
"""

from __future__ import annotations

import itertools
import threading
from pathlib import Path


class Spool:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._counters: dict[str, itertools.count[int]] = {}
        self._lock = threading.Lock()

    def _next_name(self, stream: str, suffix: str) -> str:
        with self._lock:
            counter = self._counters.setdefault(stream, itertools.count())
            n = next(counter)
        return f"{n:010d}{suffix}"

    def write_bytes(self, stream: str, data: bytes, suffix: str = ".bin") -> Path:
        stream_dir = self.root / stream
        stream_dir.mkdir(parents=True, exist_ok=True)
        path = stream_dir / self._next_name(stream, suffix)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_bytes(data)
        tmp_path.rename(path)  # atomic on the same fs -- the uploader never sees a partial file
        return path

    def write_line(self, stream: str, line: str) -> None:
        """Appends one JSONL line to the stream's current segment file, rotating to a new
        segment past `max_lines_per_segment` so no single upload is unbounded."""
        stream_dir = self.root / stream
        stream_dir.mkdir(parents=True, exist_ok=True)
        current = stream_dir / "current.jsonl"
        with current.open("a", encoding="utf-8") as fh:
            fh.write(line.rstrip("\n") + "\n")

    def pending(self, stream: str) -> list[Path]:
        stream_dir = self.root / stream
        if not stream_dir.exists():
            return []
        return sorted(p for p in stream_dir.iterdir() if p.is_file() and p.suffix != ".tmp")

    def rotate_jsonl(self, stream: str) -> Path | None:
        """Moves the stream's current.jsonl segment out of the way so the uploader can ship it
        while new lines keep appending to a fresh one. Returns None if there was nothing to
        rotate."""
        stream_dir = self.root / stream
        current = stream_dir / "current.jsonl"
        if not current.exists() or current.stat().st_size == 0:
            return None
        sealed = stream_dir / self._next_name(stream, ".jsonl")
        current.rename(sealed)
        return sealed

    def remove(self, path: Path) -> None:
        path.unlink(missing_ok=True)

    def total_bytes(self) -> int:
        return sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())
