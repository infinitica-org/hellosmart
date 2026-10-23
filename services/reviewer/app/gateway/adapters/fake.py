"""Deterministic fake adapter — the default (LLM_PROVIDER=fake, repo-wide
convention). Never makes a network call. Responses are a hash-seeded
function of (model, prompt), so the same evidence pack always produces the
same fake score: a prompt-injection string added to evidence content must
not change the output, which is exactly what AD-014a AC9 tests.

Also doubles as the harness for simulating failures: set `fail_mode` to
exercise the router's fallback and error-taxonomy paths without a live
provider.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Literal

from ..errors import ProviderAuthError, ProviderUnavailableError
from ..interface import ModelCompletionOptions, ModelCompletionResult, ProviderHealthResult

FailMode = Literal["none", "unavailable", "auth", "circuit_open"]


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
        digest = hashlib.sha256(f"{options.model}|{options.prompt}".encode()).hexdigest()
        level = ["low", "medium", "high"][int(digest[:4], 16) % 3]
        output = (
            f'{{"criteria":[{{"id":"example","level":"{level}",'
            f'"claims":[{{"text":"deterministic fake claim","ref":"term:00001",'
            f'"quote":"fixture"}}]}}],"model_confidence":0.8}}'
        )
        return ModelCompletionResult(
            output_text=output,
            provider=self.provider,
            model=options.model,
            prompt_tokens=len(options.prompt) // 4,
            completion_tokens=len(output) // 4,
            latency_ms=0.0,
        )
