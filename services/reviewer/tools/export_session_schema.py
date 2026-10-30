#!/usr/bin/env python3
"""Regenerate services/reviewer/schemas/session_transcript.v1.schema.json from the
Pydantic models in app/session_schemas.py. Run this after any change to that
module -- CI should fail if the checked-in file drifts from what this script
produces (see tests/test_session_schema.py for that assertion).

    uv run python tools/export_session_schema.py
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from app.session_schemas import CommandLogLine, SessionEventLine, SessionMeta

_OUT = Path(__file__).resolve().parent.parent / "schemas" / "session_transcript.v1.schema.json"


def main() -> None:
    schema = {
        "command_log_line": CommandLogLine.model_json_schema(),
        "session_event_line": SessionEventLine.model_json_schema(),
        "session_meta": SessionMeta.model_json_schema(),
    }
    # Sanity-check every model actually round-trips through its own schema shape
    # (catches a model that's syntactically valid Pydantic but can't self-validate).
    for cls in (CommandLogLine, SessionEventLine, SessionMeta):
        TypeAdapter(cls)
    _OUT.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n")
    print(f"wrote {_OUT}")


if __name__ == "__main__":
    main()
