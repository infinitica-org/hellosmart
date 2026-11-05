"""Agent definition loader (AD-014b, filling AD-014's "define agents
(prompt/config, model, version, enabled flag)" acceptance criterion).

One `agents/<id>.yaml` per agent, the shape `debugging-process.yaml`
establishes as the reference ("Copy this shape for every library agent").
Each ProjAgentScan-derived agent here condenses what was originally several
independent low/medium/high criteria (e.g. code_quality judged readability,
naming, idioms and docs separately) into one anchored 1-5 scale with
`signals`/`red_flags` standing in for what those criteria checked -- matching
this repo's one-agent-one-rubric-item convention rather than introducing a
competing multi-criterion output shape. `AgentScore.evidence` is still a
list, so a single score can (and should) cite multiple supporting quotes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator

from ..evidence import EvidenceSource

AGENTS_DIR = Path(__file__).resolve().parent.parent.parent / "agents"


class AgentScale(BaseModel):
    min: int
    max: int

    @field_validator("max")
    @classmethod
    def _max_above_min(cls, v: int, info: Any) -> int:
        min_ = info.data.get("min")
        if min_ is not None and v <= min_:
            raise ValueError("scale.max must be greater than scale.min")
        return v


class AgentSpec(BaseModel):
    """One agent's full definition: enough to prompt it, call it, and
    validate what comes back -- the "prompt/config, model, version, enabled
    flag" AD-014 asks for."""

    id: str
    version: str
    model: str
    enabled: bool = True
    evidence_channels: list[EvidenceSource]
    scale: AgentScale
    anchors: dict[int, str]
    signals: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    output_schema: str = "AgentScore"
    max_attempts: int = 3
    description: str = ""
    disallowed_inferences: list[str] = Field(default_factory=list)

    @field_validator("anchors")
    @classmethod
    def _anchors_within_scale(cls, v: dict[int, str], info: Any) -> dict[int, str]:
        scale = info.data.get("scale")
        if scale is not None:
            bad = [k for k in v if not (scale.min <= k <= scale.max)]
            if bad:
                raise ValueError(f"anchors {bad} fall outside scale {scale.min}-{scale.max}")
        return v


def load_agent_spec(agent_id: str) -> AgentSpec:
    """Load and validate `agents/<agent_id>.yaml`. Raises if the file is
    missing or doesn't match AgentSpec -- a malformed agent definition must
    fail at load time, not mid-run against a candidate's evidence."""
    path = AGENTS_DIR / f"{agent_id}.yaml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return AgentSpec.model_validate(raw)


def list_enabled_agent_ids() -> list[str]:
    """Every `agents/<id>.yaml` whose `enabled: true` (default), sorted for
    deterministic iteration order."""
    ids = []
    for p in sorted(AGENTS_DIR.glob("*.yaml")):
        spec = load_agent_spec(p.stem)
        if spec.enabled:
            ids.append(spec.id)
    return ids
