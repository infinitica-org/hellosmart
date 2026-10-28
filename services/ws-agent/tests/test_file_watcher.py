from __future__ import annotations

import time
from pathlib import Path

from ws_agent.file_watcher import FileWatcher


def test_a_real_file_change_is_reported(tmp_path: Path) -> None:
    events: list[dict[str, object]] = []
    watcher = FileWatcher(tmp_path, sink=events.append)
    watcher.start()
    try:
        time.sleep(0.3)  # let the observer thread actually start watching
        (tmp_path / "app.py").write_text("x = 1\n", encoding="utf-8")
        deadline = time.monotonic() + 3
        while not events and time.monotonic() < deadline:
            time.sleep(0.1)
    finally:
        watcher.stop()

    assert events
    assert events[0]["kind"] == "file_change"
    assert "app.py" in str(events[0]["detail"])  # type: ignore[index]


def test_changes_inside_dot_git_are_excluded(tmp_path: Path) -> None:
    events: list[dict[str, object]] = []
    watcher = FileWatcher(tmp_path, sink=events.append)
    watcher.start()
    try:
        time.sleep(0.3)
        git_dir = tmp_path / ".git"
        git_dir.mkdir()
        (git_dir / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
        time.sleep(0.5)
    finally:
        watcher.stop()

    assert events == []
