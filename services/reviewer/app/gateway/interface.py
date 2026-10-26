"""Provider adapter protocol (ported from HireKiwi's ai-gateway.interface.ts shape,
adapted: this gateway is internal to services/reviewer and model-agnostic — an
adapter serves whatever model string it's asked for, it does not pick one).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

CircuitState = Literal["CLOSED", "OPEN", "HALF_OPEN"]


@dataclass(frozen=True)
class ProviderHealthResult:
    provider: str
    reachable: bool
    circuit_state: CircuitState
    latency_ms: float | None
    message: str | None = None


@dataclass(frozen=True)
class ModelCompletionOptions:
    model: str
    prompt: str
    system: str | None = None
    temperature: float = 0.0
    max_tokens: int = 4096
    timeout_s: float = 20.0


@dataclass(frozen=True)
class ModelCompletionResult:
    output_text: str
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float


class AIProviderAdapter(Protocol):
    """One adapter per transport (openrouter, anthropic, gemini, fake).

    `complete()` must raise `ProviderAuthError` for key/auth failures and
    `ProviderUnavailableError` (or a subclass) for anything else that fails
    the call — never a bare Exception, so the router's fallback logic can
    tell the two apart without inspecting error strings.
    """

    provider: str

    @property
    def is_configured(self) -> bool: ...

    async def check_health(self) -> ProviderHealthResult: ...

    async def complete(self, options: ModelCompletionOptions) -> ModelCompletionResult: ...

    def supports_model(self, model: str) -> bool:
        """True if this adapter can serve `model` as a *native* (same-model)
        call. Used by the router to decide same-model-direct vs cross-model
        substitution — never guess this from a naming convention alone in
        production; adapters should check against a maintained model list.
        """
        ...
