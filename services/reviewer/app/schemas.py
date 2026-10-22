"""Agent output contract (BR-18, BR-20). A score without resolvable evidence is invalid."""

from typing import Annotated

from pydantic import BaseModel, Field, field_validator

EvidenceRef = Annotated[str, Field(pattern=r"^(term|diff|ai|file|event|test):[\w./#:\-]{1,200}$")]


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
