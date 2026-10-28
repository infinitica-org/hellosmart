"""Drives the `Recorder` the way the real capture components would (minus an actual PTY, which
can't be exercised on a non-Linux dev machine -- see pty_session.py's module docstring), then
runs its upload tick and checks the result lands correctly in the (fake) S3 backend."""

from __future__ import annotations

import json
from pathlib import Path

from ws_agent.main import Recorder
from ws_agent.uploader import LocalFsUploader


def test_a_full_tick_cycle_produces_replayable_artifacts(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")

    fake_s3 = tmp_path / "s3"
    recorder = Recorder(workspace, tmp_path / "spool", LocalFsUploader(fake_s3))

    # Simulate what the PTY wrapper would have called:
    recorder.on_raw_terminal(b"$ pytest -q\n5 passed\n")
    recorder.on_command("pytest -q", cwd="/workspace", exit_code=0, duration_ms=842)
    recorder.on_file_event({"ts": 1.0, "kind": "file_change", "detail": {"path": "app.py"}})

    recorder.snapshot_tick()
    recorder.upload_tick()

    assert (fake_s3 / "terminal_raw").exists()
    assert list((fake_s3 / "terminal_raw").iterdir())

    log_files = list((fake_s3 / "terminal_log").iterdir())
    assert len(log_files) == 1
    logged = json.loads(log_files[0].read_text(encoding="utf-8").strip())
    assert logged["command"] == "pytest -q"
    assert logged["exit_code"] == 0

    assert list((fake_s3 / "git_bundles").iterdir())
    assert list((fake_s3 / "events").iterdir())


def test_a_secret_pasted_into_the_terminal_never_reaches_the_fake_s3(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    fake_s3 = tmp_path / "s3"
    recorder = Recorder(workspace, tmp_path / "spool", LocalFsUploader(fake_s3))

    recorder.on_raw_terminal(b"export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n")
    recorder.upload_tick()

    uploaded = next(iter((fake_s3 / "terminal_raw").iterdir())).read_bytes()
    assert b"AKIAIOSFODNN7EXAMPLE" not in uploaded


def test_second_tick_with_no_workspace_changes_skips_the_snapshot(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "app.py").write_text("x = 1\n", encoding="utf-8")
    fake_s3 = tmp_path / "s3"
    recorder = Recorder(workspace, tmp_path / "spool", LocalFsUploader(fake_s3))

    recorder.snapshot_tick()
    recorder.upload_tick()
    first_count = len(list((fake_s3 / "git_bundles").iterdir()))

    recorder.snapshot_tick()  # nothing changed in the workspace
    recorder.upload_tick()
    second_count = len(list((fake_s3 / "git_bundles").iterdir()))

    assert first_count == 1
    assert second_count == 1
