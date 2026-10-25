"""AC6: the checked-in JSON Schema must match what the Pydantic model
actually produces. Run tools/export_evidence_schema.py and commit the
result whenever app/evidence.py changes — this test is what catches
forgetting to.
"""

import json
from pathlib import Path

from app.evidence import EvidenceItem, EvidencePack

_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent / "schemas" / "evidence.v1.schema.json"
)


def test_exported_schema_matches_model() -> None:
    checked_in = json.loads(_SCHEMA_PATH.read_text())
    current = EvidencePack.model_json_schema()
    assert checked_in == current, (
        "schemas/evidence.v1.schema.json is stale — run "
        "`uv run python tools/export_evidence_schema.py` and commit the result"
    )


def test_pack_resolves_its_own_refs() -> None:
    pack = EvidencePack(
        agent_id="code_quality",
        submission_id="sub_0002",
        items=[
            EvidenceItem(
                ref="file:src/app.py#L1-10",
                source="artifact",
                content="def f(): pass",
                untrusted=True,
                sanitized=True,
            )
        ],
    )
    assert pack.resolve("file:src/app.py#L1-10") is not None
    assert pack.resolve("file:does-not-exist") is None
    assert "file:src/app.py#L1-10" in pack.refs


def test_ref_must_match_existing_vocabulary() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        EvidenceItem(
            ref="not-a-valid-prefix:whatever",
            source="artifact",
            content="x",
            untrusted=False,
        )
