"""Reads a recorded candidate session (produced by services/ws-agent) the way RepoReader reads
a plain clone: one place that knows the artifact layout, caps sizes, and never raises on a bad
file. See docs discussion (live-session evidence plan): evidence builders must go through this,
never call S3/local storage directly, for the same reason they go through RepoReader for a repo.

Expected layout under `session_dir` (mirrors the S3 prefix `ws-agent` writes to):
  git_bundles/NNNNNN.bundle   -- incremental git bundles, applied in filename order
  terminal_log/*.jsonl        -- sealed command-log segments (see ws_agent.spool.rotate_jsonl)
  events/*.jsonl              -- sealed file-activity-event segments
  terminal_raw/*              -- raw replay bytes (not parsed here; see §7 of the plan, a
                                  future replay-UI feature, not consumed by any agent yet)

`materialize()` applies the git bundles into a fresh bare repo and checks out the final
snapshot into a scratch working directory -- the result is a plain path, handed to RepoReader
exactly like any other clone, so the 8 already-shipped evidence builders need no change at all
to run against a session's final state instead of an arbitrary GitHub clone.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import TypedDict

MAX_JSONL_BYTES = 20 * 1024 * 1024  # per segment file; mirrors RepoReader's own size-cap spirit


class CommandRecord(TypedDict):
    command: str
    cwd: str | None
    exit_code: int | None
    duration_ms: int


class SessionEvent(TypedDict):
    ts: float
    kind: str
    detail: dict[str, object]


class SnapshotInfo(TypedDict):
    seq: int
    commit_sha: str
    ts: float
    lines_changed: int


def _git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(  # noqa: S603 -- fixed argv, cwd is a caller-owned scratch dir
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True  # noqa: S607
    )
    return result.stdout.strip()


class SessionReader:
    def __init__(self, session_dir: Path | str) -> None:
        self.session_dir = Path(session_dir)
        self.skipped: list[str] = []

    # -- git timeline -----------------------------------------------------------------

    def bundle_files(self) -> list[Path]:
        """Every git bundle, in application order (filename-sorted, matching the sequence
        numbers ws-agent names them with)."""
        bundles_dir = self.session_dir / "git_bundles"
        if not bundles_dir.exists():
            return []
        return sorted(bundles_dir.glob("*.bundle"))

    def _build_bare_repo(self, upto_seq: int | None = None) -> tuple[Path, Path] | None:
        """Applies bundles (optionally only up to `upto_seq`, inclusive) into a fresh bare
        repo. Returns (scratch_dir, bare_repo_dir), or None if there are no bundles at all."""
        bundles = self.bundle_files()
        if upto_seq is not None:
            bundles = [b for b in bundles if _seq_of(b) <= upto_seq]
        if not bundles:
            return None

        scratch = Path(tempfile.mkdtemp(prefix="hs-session-"))
        bare = scratch / "bare.git"
        bare.mkdir()
        _git(["init", "-q", "--bare"], bare)
        for bundle in bundles:
            try:
                # `git bundle unbundle` only unpacks objects -- it does not update refs in the
                # target repo. `fetch` does, which is what makes the snapshot ref resolvable
                # afterward.
                _git(
                    ["fetch", "-q", str(bundle), "refs/hs-snapshots/main:refs/hs-snapshots/main"],
                    bare,
                )
            except subprocess.CalledProcessError:
                self.skipped.append(f"{bundle.name}: failed to apply")
                continue
        return scratch, bare

    def materialize(self, upto_seq: int | None = None) -> Path | None:
        """Checks out the final (or `upto_seq`) snapshot into a scratch working directory and
        returns its path. Returns None if there are no bundles at all (nothing to materialize)
        -- the caller should treat that as "no session code available", the same way
        RepoReader treats a missing clone."""
        built = self._build_bare_repo(upto_seq)
        if built is None:
            return None
        scratch, bare = built

        head = _git(["rev-parse", "refs/hs-snapshots/main"], bare)
        worktree = scratch / "worktree"
        _git(["clone", "-q", str(bare), str(worktree)], scratch)
        _git(["checkout", "-q", head], worktree)
        return worktree

    def snapshot_timeline(self) -> list[SnapshotInfo]:
        """One entry per snapshot commit, oldest first, with its timestamp and total lines
        changed (`--numstat` summed across all files in that commit) -- the raw sequence
        `checks/session_timeline.py` turns into facts like session count and "wrote it all at
        once" detection. Returns [] if there are no bundles at all."""
        built = self._build_bare_repo()
        if built is None:
            return []
        _scratch, bare = built

        log_output = _git(
            ["log", "--format=%H|%ct", "--numstat", "--reverse", "refs/hs-snapshots/main"], bare
        )
        snapshots: list[SnapshotInfo] = []
        current_sha: str | None = None
        current_ts = 0.0
        current_lines = 0
        seq = 0

        def _flush() -> None:
            nonlocal seq
            if current_sha is not None:
                snapshots.append(
                    {
                        "seq": seq, "commit_sha": current_sha, "ts": current_ts,
                        "lines_changed": current_lines,
                    }
                )
                seq += 1

        for line in log_output.splitlines():
            if "|" in line and line.count("|") == 1 and "\t" not in line:
                _flush()
                sha, ts_raw = line.split("|", 1)
                current_sha, current_ts, current_lines = sha, float(ts_raw), 0
            elif line.strip():
                parts = line.split("\t")
                if len(parts) == 3:
                    added, removed, _path = parts
                    current_lines += (int(added) if added.isdigit() else 0) + (
                        int(removed) if removed.isdigit() else 0
                    )
        _flush()
        return snapshots

    # -- terminal / events (sealed JSONL segments) -------------------------------------

    def _read_segments(self, stream: str) -> list[dict[str, object]]:
        stream_dir = self.session_dir / stream
        if not stream_dir.exists():
            return []
        rows: list[dict[str, object]] = []
        for segment in sorted(stream_dir.glob("*.jsonl")):
            try:
                size = segment.stat().st_size
            except OSError:
                self.skipped.append(f"{stream}/{segment.name}: unreadable")
                continue
            if size > MAX_JSONL_BYTES:
                self.skipped.append(f"{stream}/{segment.name}: oversized")
                continue
            try:
                text = segment.read_text(encoding="utf-8", errors="replace")
            except OSError:
                self.skipped.append(f"{stream}/{segment.name}: unreadable")
                continue
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    self.skipped.append(f"{stream}/{segment.name}: malformed line")
        return rows

    def terminal_log(self) -> list[CommandRecord]:
        records: list[CommandRecord] = []
        for r in self._read_segments("terminal_log"):
            cwd = r.get("cwd")
            exit_code = r.get("exit_code")
            duration_ms = r.get("duration_ms")
            records.append(
                {
                    "command": str(r.get("command", "")),
                    "cwd": cwd if isinstance(cwd, str) else None,
                    "exit_code": exit_code if isinstance(exit_code, int) else None,
                    "duration_ms": duration_ms if isinstance(duration_ms, int) else 0,
                }
            )
        return records

    def events(self) -> list[SessionEvent]:
        parsed: list[SessionEvent] = []
        for r in self._read_segments("events"):
            ts = r.get("ts")
            detail = r.get("detail")
            parsed.append(
                {
                    "ts": float(ts) if isinstance(ts, int | float) else 0.0,
                    "kind": str(r.get("kind", "")),
                    "detail": detail if isinstance(detail, dict) else {},
                }
            )
        return parsed


def _seq_of(bundle_path: Path) -> int:
    try:
        return int(bundle_path.stem)
    except ValueError:
        return -1
