"""Deterministic fake adapter — the default (LLM_PROVIDER=fake, repo-wide
convention). Never makes a network call. Responses are a hash-seeded
function of (model, prompt), so the same evidence pack always produces the
same fake score: a prompt-injection string added to evidence content must
not change the output, which is exactly what AD-014a AC9 tests.

Also doubles as the harness for simulating failures: set `fail_mode` to
exercise the router's fallback and error-taxonomy paths without a live
provider.

AD-014b: the canned reply is AgentScore-shaped (app/schemas.py), not the
pre-AgentScore criteria-array placeholder this adapter originally returned
-- nothing in AD-014a's own tests asserted that shape (only output_text
*equality* across repeated calls, and generic "it ran" checks), so this is
a compatible update, not a breaking one. `rubric_item_id` and one real
evidence citation are extracted from the rendered prompt/system text
(app/prompt.py's own format: `"rubric_item_id": "..."` in the system
message, `### <ref>  source=...` headers in the user message) so the reply
actually validates against whatever real EvidencePack produced that
prompt, for any agent -- not hardcoded to one agent's evidence shape.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Literal

from ..errors import ProviderAuthError, ProviderUnavailableError
from ..interface import ModelCompletionOptions, ModelCompletionResult, ProviderHealthResult

FailMode = Literal["none", "unavailable", "auth", "circuit_open"]

_RUBRIC_ID_RE = re.compile(r'"rubric_item_id":\s*"([^"]+)"')
_ITEM_RE = re.compile(r"^### (\S+)  source=\S+\n(.*)$", re.MULTILINE)


def _fake_agent_reply(options: ModelCompletionOptions) -> str:
    rubric_match = _RUBRIC_ID_RE.search(options.system or "")
    rubric_item_id = rubric_match.group(1) if rubric_match else "fake-rubric-item"

    item_match = _ITEM_RE.search(options.prompt)
    evidence: list[dict[str, str]] = []
    if item_match:
        ref, first_line = item_match.group(1), item_match.group(2).strip()
        if first_line:
            evidence = [{"ref": ref, "quote": first_line[:60]}]

    digest = hashlib.sha256(f"{options.model}|{options.prompt}".encode()).hexdigest()
    scale_min, scale_max = 1, 5  # matches every agents/<id>.yaml's `scale` today
    score = scale_min + (int(digest[:4], 16) % (scale_max - scale_min + 1))
    return json.dumps(
        {
            "rubric_item_id": rubric_item_id,
            "score": score,
            "confidence": 0.8,
            "rationale": "deterministic fake rationale (LLM_PROVIDER=fake)",
            "evidence": evidence,
            "flags": [],
        }
    )


@dataclass
class FakeAdapter:
    provider: str = "fake"
    fail_mode: FailMode = "none"
    known_models: frozenset[str] = frozenset({"claude-sonnet-5-5", "gemini-2.5"})
    default_substitute_model: str | None = None

    @property
    def is_configured(self) -> bool:
        return True

    def supports_model(self, model: str) -> bool:
        return model in self.known_models

    async def check_health(self) -> ProviderHealthResult:
        return ProviderHealthResult(
            provider=self.provider, reachable=True, circuit_state="CLOSED", latency_ms=0.0
        )

    async def complete(self, options: ModelCompletionOptions) -> ModelCompletionResult:
        if self.fail_mode == "auth":
            raise ProviderAuthError(self.provider)
        if self.fail_mode in ("unavailable", "circuit_open"):
            raise ProviderUnavailableError(self.provider, self.fail_mode)

        # Deterministic "score": a stable digest of (model, prompt), never a
        # clock or random source, so retries and repeated test runs agree.
        output = _fake_agent_reply(options)
        return ModelCompletionResult(
            output_text=output,
            provider=self.provider,
            model=options.model,
            prompt_tokens=len(options.prompt) // 4,
            completion_tokens=len(output) // 4,
            latency_ms=0.0,
        )
