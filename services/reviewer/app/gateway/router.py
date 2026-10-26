"""Model router (AD-014a AC3/AC4/AC5).

Routing is model-agnostic: an agent declares a model (e.g. `claude-sonnet-5-5`
or `gemini-2.5`, per its `agent.yaml`-equivalent config, AD-014); this router
does not pick a model, it picks a *path* to the one it was asked for:

  1. OpenRouter, requesting that exact model            (primary transport)
  2. the native adapter for that model family, direct    (same-model fallback)
  3. any other configured adapter                        (cross-model substitution —
                                                            never silent, see below)

Same-model paths are always exhausted before a cross-model substitution is
even considered (confirmed design decision, AD-014a): a transport hiccup on
OpenRouter alone must not swap the grading model. Only when every adapter
that natively serves the requested model is down does the router substitute
a different model — and when it does, the result is marked
`flags: ["model_substituted"]` with a hard confidence cap, because a
substituted model was never validated against that agent's golden set
(BR-20: an unvalidated score is not equivalent to a calibrated one).

Provider-selection failures (unreachable/circuit-open) and key/auth failures
are raised as distinct types by every adapter (see errors.py) and handled
differently here: auth failures invalidate the cached key and move on
immediately (retrying the same bad key is pointless and must never open
that provider's circuit breaker); unavailable failures retry once on the
same provider, then move on and do open the circuit breaker.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import secrets
from .circuit_breaker import CircuitBreaker
from .errors import (
    CircuitOpenError,
    GatewayError,
    ModelSubstitutedWarning,
    ProviderAuthError,
    ProviderUnavailableError,
)
from .interface import AIProviderAdapter, ModelCompletionOptions, ModelCompletionResult

_MAX_SAME_PROVIDER_ATTEMPTS = 2  # initial + 1 retry (architecture doc §4.3 agent-run retry rule)
# Confidence cap applied whenever the router had to substitute a different
# model than the one requested (config/scoring_policy-equivalent default;
# lower than any single-provider confidence cap, since the model itself —
# not just the evidence — is now unvalidated for this agent).
MODEL_SUBSTITUTION_CONFIDENCE_CAP = 0.3


@dataclass
class RoutedCompletion:
    result: ModelCompletionResult
    substituted: bool
    requested_model: str
    confidence_cap: float | None = None


@dataclass
class ModelRouter:
    adapters: list[AIProviderAdapter]
    openrouter_provider: str = "openrouter"
    _breakers: dict[str, CircuitBreaker] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for adapter in self.adapters:
            self._breakers.setdefault(adapter.provider, CircuitBreaker(adapter.provider))

    def _breaker(self, provider: str) -> CircuitBreaker:
        return self._breakers[provider]

    def _ordered_chain(self, model: str) -> list[AIProviderAdapter]:
        openrouter = next(
            (a for a in self.adapters if a.provider == self.openrouter_provider), None
        )
        same_model_direct = [
            a
            for a in self.adapters
            if a.provider != self.openrouter_provider and a.supports_model(model)
        ]
        cross_model = [
            a
            for a in self.adapters
            if a.provider != self.openrouter_provider and not a.supports_model(model)
        ]
        chain: list[AIProviderAdapter] = []
        if openrouter is not None and openrouter.supports_model(model):
            chain.append(openrouter)
        chain.extend(same_model_direct)
        chain.extend(cross_model)  # only reached if nothing same-model worked
        return chain

    async def _attempt(
        self, adapter: AIProviderAdapter, options: ModelCompletionOptions
    ) -> ModelCompletionResult:
        breaker = self._breaker(adapter.provider)
        if not breaker.allow_request():
            raise CircuitOpenError(adapter.provider)

        last_error: ProviderUnavailableError | None = None
        for _ in range(_MAX_SAME_PROVIDER_ATTEMPTS):
            try:
                result = await adapter.complete(options)
            except ProviderAuthError:
                secrets.invalidate(adapter.provider)
                breaker.record_auth_failure()  # never opens the circuit (AC4)
                raise
            except ProviderUnavailableError as exc:
                breaker.record_failure()
                last_error = exc
                continue
            else:
                breaker.record_success()
                return result
        if last_error is None:  # pragma: no cover - loop always sets it before falling through
            raise GatewayError(f"{adapter.provider}: exhausted retries with no recorded error")
        raise last_error

    async def complete(
        self, requested_model: str, options: ModelCompletionOptions
    ) -> RoutedCompletion:
        chain = self._ordered_chain(requested_model)
        if not chain:
            raise GatewayError(f"no adapter configured for model '{requested_model}'")

        errors: list[GatewayError] = []
        for adapter in chain:
            same_model = adapter.supports_model(requested_model)
            call_options = options if same_model else _with_model(options, adapter)
            try:
                result = await self._attempt(adapter, call_options)
            except (ProviderAuthError, ProviderUnavailableError) as exc:
                errors.append(exc)
                continue

            if same_model:
                return RoutedCompletion(
                    result=result, substituted=False, requested_model=requested_model
                )
            # Cross-model substitution happened. ModelSubstitutedWarning is not
            # raised as control flow here (the call already succeeded) — it
            # exists so callers that want the structured "what got
            # substituted for what" detail can construct it from this result
            # rather than re-deriving it from strings.
            _ = ModelSubstitutedWarning(
                requested_model=requested_model,
                actual_model=call_options.model,
                actual_provider=adapter.provider,
            )
            return RoutedCompletion(
                result=result,
                substituted=True,
                requested_model=requested_model,
                confidence_cap=MODEL_SUBSTITUTION_CONFIDENCE_CAP,
            )

        raise GatewayError(
            f"all providers exhausted for model '{requested_model}': "
            + "; ".join(str(e) for e in errors)
        )


def _with_model(
    options: ModelCompletionOptions, adapter: AIProviderAdapter
) -> ModelCompletionOptions:
    """Cross-model substitution: ask the substitute adapter for *its*
    default model, never the originally-requested model string (that
    model id likely doesn't exist on this provider at all).
    """
    from dataclasses import replace

    substitute_model = getattr(adapter, "default_substitute_model", None)
    if substitute_model is None:
        raise GatewayError(
            f"{adapter.provider}: no default_substitute_model configured for cross-model use"
        )
    return replace(options, model=substitute_model)
