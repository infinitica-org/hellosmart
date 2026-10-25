"""Evidence bundle schema, v1 (AD-014a AC6).

This is the *input* side of the reviewer pipeline — docs/00-architecture-and-
delivery-plan.md §4.3 step 1: "Evidence builder: turns raw artifacts into a
bounded evidence bundle; every chunk gets a stable ref." The *output* side
(`AgentScore`/`Evidence` in schemas.py) already matches §4.1's documented
shape and is unchanged by this ticket.

The `ref` vocabulary here is the existing one from schemas.py
(`term|diff|ai|file|event|test`), not a new one — EvidenceItem.ref reuses
that exact pattern so a ref minted here is guaranteed resolvable by the
existing AgentScore.evidence[].ref validator downstream.

Confirmed with Vedika (packages/fixtures, AD-013-adjacent seed-data work)
before `status: active` on any dependent fixture:
  - No `org_id` on EvidenceItem/EvidencePack/AgentScore. Org is derived
    purely via submission_id -> candidate -> org, never carried on the
    evidence/score records themselves.
  - No separate `evidence_type` or generic `metadata` field. `source`
    (the channel) + `content` (free text, inline-annotated where needed,
    e.g. "file=...; function=...; line ...") is sufficient for her seed
    fixtures. Schema v1 is locked on this basis.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .schemas import EvidenceRef

EvidenceSchemaVersion = Literal["v1"]

EvidenceSource = Literal[
    "terminal_log",
    "git_timeline",
    "ai_transcript",
    "artifact",
    "chat_deliverable",
    "activity_event",
]


class EvidenceItem(BaseModel):
    """One bounded, individually-citable chunk of the evidence bundle.

    `untrusted=True` for anything sourced from candidate-authored content
    (artifact text, AI transcript turns the candidate wrote, filenames) —
    it must have already passed through `sanitizer.wrap_untrusted()` before
    `content` is populated here; this schema does not sanitize, it records
    that sanitization already happened (`sanitized: bool`) so a reviewer of
    the bundle can tell at a glance whether that step was skipped.
    """

    ref: EvidenceRef
    source: EvidenceSource
    content: str = Field(max_length=8000)
    untrusted: bool
    sanitized: bool = False
    truncated: bool = False

    @model_validator(mode="after")
    def _untrusted_requires_sanitized(self) -> EvidenceItem:
        if self.untrusted and not self.sanitized:
            raise ValueError(
                f"{self.ref}: untrusted evidence item must be sanitized before it is packed"
            )
        return self


class EvidenceCoverage(BaseModel):
    """Which evidence channels were and weren't available, and why —
    mirrors the check-status convention (`available | unavailable |
    not_applicable | low_confidence`) so an agent can say "channel
    unavailable" instead of inventing content for it.
    """

    channel: EvidenceSource
    status: Literal["available", "unavailable", "not_applicable", "low_confidence"]
    reason: str | None = None


class EvidencePack(BaseModel):
    schema_version: EvidenceSchemaVersion = "v1"
    agent_id: str
    submission_id: str
    items: list[EvidenceItem] = Field(default_factory=list)
    coverage: list[EvidenceCoverage] = Field(default_factory=list)
    truncations: list[str] = Field(default_factory=list)
    missing_required: list[str] = Field(default_factory=list)
    injection_flags: list[str] = Field(default_factory=list)

    @property
    def refs(self) -> frozenset[str]:
        return frozenset(item.ref for item in self.items)

    def resolve(self, ref: str) -> EvidenceItem | None:
        return next((item for item in self.items if item.ref == ref), None)
