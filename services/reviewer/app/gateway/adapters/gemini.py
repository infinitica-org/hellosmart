"""Gemini direct adapter: same-model fallback for a gemini-2.5-pinned agent
when OpenRouter can't reach it, and the cross-model substitute when an
Anthropic-pinned agent's request has nowhere else to go.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import httpx

from ..errors import ProviderAuthError, ProviderUnavailableError
from ..interface import ModelCompletionOptions, ModelCompletionResult, ProviderHealthResult
from ..secrets import resolve_grader_key

_NATIVE_MODELS = frozenset({"gemini-2.5"})
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


@dataclass
class GeminiAdapter:
    provider: str = "gemini"
    default_substitute_model: str = "gemini-2.5"

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
        async with httpx.AsyncClient(timeout=options.timeout_s) as client:
            try:
                resp = await client.post(
                    f"{_BASE_URL}/models/{options.model}:generateContent",
                    params={"key": key},
                    json={
                        "contents": [{"role": "user", "parts": [{"text": options.prompt}]}],
                        "systemInstruction": (
                            {"parts": [{"text": options.system}]} if options.system else None
                        ),
                        "generationConfig": {
                            "temperature": options.temperature,
                            "maxOutputTokens": options.max_tokens,
                        },
                    },
                )
            except httpx.TimeoutException as exc:
                raise ProviderUnavailableError(self.provider, "timeout") from exc
            except httpx.HTTPError as exc:
                raise ProviderUnavailableError(self.provider, "connection error") from exc

        if resp.status_code in (401, 403):
            raise ProviderAuthError(self.provider)
        if resp.status_code >= 500:
            raise ProviderUnavailableError(self.provider, f"http {resp.status_code}")

        body = resp.json()
        latency = (time.monotonic() - start) * 1000
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        usage = body.get("usageMetadata", {})
        return ModelCompletionResult(
            output_text=text,
            provider=self.provider,
            model=options.model,
            prompt_tokens=usage.get("promptTokenCount", 0),
            completion_tokens=usage.get("candidatesTokenCount", 0),
            latency_ms=latency,
        )
