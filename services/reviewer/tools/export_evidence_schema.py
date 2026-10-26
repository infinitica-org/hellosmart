#!/usr/bin/env python3
"""Regenerate services/reviewer/schemas/evidence.v1.schema.json from the
Pydantic model. Run this after any change to app/evidence.py — CI should
fail if the checked-in file drifts from what this script produces
(see tests/test_evidence_schema.py for that assertion).

    uv run python tools/export_evidence_schema.py
"""

from __future__ import annotations

import json
from pathlib import Path

from app.evidence import EvidencePack

_OUT = Path(__file__).resolve().parent.parent / "schemas" / "evidence.v1.schema.json"


def main() -> None:
    schema = EvidencePack.model_json_schema()
    _OUT.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n")
    print(f"wrote {_OUT}")


if __name__ == "__main__":
    main()
