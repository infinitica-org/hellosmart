"""Agent output contract (BR-18, BR-20). A score without resolvable evidence is invalid."""

from typing import Annotated

from pydantic import BaseModel, Field, field_validator

# `repo` added (AD-014b): a candidate's final repo/workspace tree, read from the S3 snapshot
# `ws-agent` exports at session end (confirmed with @hellosmart/candidate-workspace — see
# tasks/AD-014b-reviewer-agent-library.md). `file:` already fits a single named path, but a repo
# evidence item is frequently a *derived* chunk with no single-file identity of its own (a README
# section split at a heading boundary, an aggregated metric across every source file, a named
# excerpt of one function body) -- `repo:` keeps that provenance unambiguous rather than overloading
# `file:` for both "this candidate deliverable file" and "this derived chunk of the repo".
EvidenceRef = Annotated[
    str, Field(pattern=r"^(term|diff|ai|file|event|test|repo):[\w./#:\-]{1,200}$")
]


class Evidence(BaseModel):
    ref: EvidenceRef
    quote: str = Field(max_length=500)


class AgentScore(BaseModel):
    rubric_item_id: str
    score: float | None = Field(description="None only for flag-only agents (integrity observer)")
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(max_length=4000)
    evidence: list[Evidence]
    flags: list[str] = []

    @field_validator("evidence")
    @classmethod
    def evidence_required(cls, v: list[Evidence]) -> list[Evidence]:
        if not v:
            raise ValueError("every score must cite at least one evidence ref")
        return v
