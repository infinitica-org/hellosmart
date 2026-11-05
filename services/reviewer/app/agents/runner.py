"""Ask-and-validate loop for one agent run (AD-014b).

ask -> parse JSON from raw text -> validate (ref/quote resolve) -> on
failure, ask again with the validator's precise reasons appended, up to
`spec.max_attempts` -> on success, apply the gateway's model-substitution
confidence cap if the router had to substitute a model (BR-20).

Mirrors ProjAgentScan's harness v2 `ask_model` loop; the one real
difference is JSON extraction from plain text (this gateway has no
structured-output/tool-calling support, see prompt.py's docstring), so a
reply that *contains* valid JSON but isn't *only* JSON (a stray code fence,
a trailing sentence) is still accepted rather than rejected on principle --
the validator is what actually proves correctness, not the raw shape of
the reply text.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from ..evidence import EvidencePack
from ..gateway import GatewayError, ModelCompletionOptions, ModelRouter
from ..prompt import render_messages
from ..schemas import AgentScore
from ..validator import validate_score
from .spec import AgentSpec

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


class AgentRunError(Exception):
    """The agent could not produce a validated score at all -- every
    attempt failed, or the gateway itself failed (no adapter reachable)."""


@dataclass
class AgentRunResult:
    outcome: str  # "ok" | "invalid" | "gateway_error"
    score: AgentScore | None = None
    attempts: int = 0
    substituted: bool = False
    error: str = ""
    problems: list[str] = field(default_factory=list)


def _extract_json(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:]
    try:
        return dict(json.loads(stripped))
    except (ValueError, TypeError):
        pass
    match = _JSON_OBJECT.search(text)
    if match is None:
        return None
    try:
        return dict(json.loads(match.group(0)))
    except (ValueError, TypeError):
        return None


async def run_agent(spec: AgentSpec, pack: EvidencePack, router: ModelRouter) -> AgentRunResult:
    correction: str | None = None
    problems: list[str] = []

    for attempt in range(1, spec.max_attempts + 1):
        system, user = render_messages(spec, pack, correction=correction)
        options = ModelCompletionOptions(model=spec.model, prompt=user, system=system)

        try:
            routed = await router.complete(spec.model, options)
        except GatewayError as exc:
            return AgentRunResult(outcome="gateway_error", attempts=attempt, error=str(exc))

        parsed = _extract_json(routed.result.output_text)
        if parsed is None:
            problems = ["reply did not contain a parseable JSON object"]
            correction = "\n".join(f"- {p}" for p in problems)
            continue

        parsed.setdefault("rubric_item_id", spec.id)
        try:
            score = AgentScore.model_validate(parsed)
        except Exception as exc:  # pydantic ValidationError, kept generic for the retry text
            problems = [f"schema: {exc}"]
            correction = "\n".join(f"- {p}" for p in problems)
            continue

        validation = validate_score(score, pack)
        if not validation.passed:
            problems = validation.problems
            correction = validation.correction_text()
            continue

        if routed.substituted and routed.confidence_cap is not None:
            score = score.model_copy(
                update={
                    "confidence": min(score.confidence, routed.confidence_cap),
                    "flags": [*score.flags, "model_substituted"],
                }
            )

        return AgentRunResult(
            outcome="ok", score=score, attempts=attempt, substituted=routed.substituted
        )

    return AgentRunResult(
        outcome="invalid", attempts=spec.max_attempts, problems=problems
    )
