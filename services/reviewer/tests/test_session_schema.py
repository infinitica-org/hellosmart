"""The checked-in session transcript schema must match what the Pydantic models in
app/session_schemas.py actually produce. Run tools/export_session_schema.py and commit the
result whenever that module changes -- this test is what catches forgetting to."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from app.session_schemas import CommandLogLine, SessionEventLine, SessionMeta

_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent / "schemas" / "session_transcript.v1.schema.json"
)


def test_exported_schema_matches_models() -> None:
    checked_in = json.loads(_SCHEMA_PATH.read_text())
    current = {
        "command_log_line": CommandLogLine.model_json_schema(),
        "session_event_line": SessionEventLine.model_json_schema(),
        "session_meta": SessionMeta.model_json_schema(),
    }
    assert checked_in == current, (
        "schemas/session_transcript.v1.schema.json is stale -- run "
        "`uv run python tools/export_session_schema.py` and commit the result"
    )


def test_a_real_command_log_line_validates() -> None:
    CommandLogLine.model_validate(
        {"command": "pytest -q", "cwd": "/workspace", "exit_code": 0, "duration_ms": 842}
    )


def test_a_command_that_never_finished_has_no_exit_code() -> None:
    line = CommandLogLine.model_validate(
        {"command": "sleep 100", "cwd": None, "exit_code": None, "duration_ms": 0}
    )
    assert line.exit_code is None


def test_a_negative_duration_is_rejected() -> None:
    import pytest

    with pytest.raises(ValidationError):
        CommandLogLine.model_validate(
            {"command": "ls", "cwd": None, "exit_code": 0, "duration_ms": -1}
        )


def test_an_unknown_event_kind_is_rejected() -> None:
    import pytest

    with pytest.raises(ValidationError):
        SessionEventLine.model_validate({"ts": 1.0, "kind": "not_a_real_kind", "detail": {}})


def test_session_meta_requires_a_pseudonymized_candidate_id_field() -> None:
    meta = SessionMeta.model_validate(
        {
            "session_id": "sess_1", "candidate_id": "contributor_abcd", "template_id": "tmpl_1",
            "started_at": 100.0, "ended_at": 200.0, "final_snapshot_seq": 3,
        }
    )
    assert meta.candidate_id == "contributor_abcd"
