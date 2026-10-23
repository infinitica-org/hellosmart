"""Anthropic direct adapter: same-model fallback when OpenRouter can't reach
an Anthropic-family model (e.g. claude-sonnet-5-5), and the cross-model
substitute when a Gemini-pinned agent's request has nowhere else to go.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from ..errors import ProviderAuthError, ProviderUnavailableError
from ..interface import ModelCompletionOptions, ModelCompletionResult, ProviderHealthResult
from ..secrets import resolve_grader_key

_NATIVE_MODELS = frozenset({"claude-sonnet-5-5"})


@dataclass
class AnthropicAdapter:
    provider: str = "anthropic"
    # Used only when this adapter is asked to substitute for a model it
    # doesn't natively serve; never silent — the router attaches
    # ModelSubstitutedWarning and the caller caps confidence (AC5).
    default_substitute_model: str = "claude-sonnet-5-5"

    @property
    def is_configured(self) -> bool:
        return resolve_grader_key(self.provider) is not None

    def supports_model(self, model: str) -> bool:
        return model in _NATIVE_MODELS

    async def check_health(self) -> ProviderHealthResult:
        if not self.is_configured:
            return ProviderHealthResult(
                provider=self.provider,
                reachable=False,
                circuit_state="CLOSED",
                latency_ms=None,
                message="no key configured",
            )
        return ProviderHealthResult(
            provider=self.provider, reachable=True, circuit_state="CLOSED", latency_ms=None
        )

    async def complete(self, options: ModelCompletionOptions) -> ModelCompletionResult:
        key = resolve_grader_key(self.provider)
        if key is None:
            raise ProviderAuthError(self.provider)

        start = time.monotonic()
        try:
            import anthropic  # lazy: keep this out of the import path for fake-mode tests

            client = anthropic.AsyncAnthropic(api_key=key)
            response = await client.messages.create(
                model=options.model,
                system=options.system or "",
                max_tokens=options.max_tokens,
                temperature=options.temperature,
                messages=[{"role": "user", "content": options.prompt}],
                timeout=options.timeout_s,
            )
        except anthropic.AuthenticationError as exc:
            raise ProviderAuthError(self.provider) from exc
        except anthropic.APIStatusError as exc:
            if exc.status_code in (401, 403):
                raise ProviderAuthError(self.provider) from exc
            raise ProviderUnavailableError(self.provider, f"http {exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderUnavailableError(self.provider, "connection error") from exc
        except anthropic.APITimeoutError as exc:
            raise ProviderUnavailableError(self.provider, "timeout") from exc

        latency = (time.monotonic() - start) * 1000
        text = "".join(block.text for block in response.content if block.type == "text")
        return ModelCompletionResult(
            output_text=text,
            provider=self.provider,
            model=options.model,
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
            latency_ms=latency,
        )
