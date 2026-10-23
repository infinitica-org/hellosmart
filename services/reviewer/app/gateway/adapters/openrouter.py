"""OpenRouter adapter. Primary transport: the router tries this first for
whatever model an agent declares, since OpenRouter can reach many upstream
model families through one key/endpoint.

Scaffold note: `complete()` is wired for real use but this ticket's AC1/AC9
only exercise `FakeAdapter`; nothing here is called by default
(LLM_PROVIDER=fake). Key resolution goes through `resolve_grader_key`
(Secrets Manager, in-memory cache, never logged) — see services/ai-proxy's
existing pattern, reused rather than reinvented.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx

from ..errors import ProviderAuthError, ProviderUnavailableError
from ..interface import ModelCompletionOptions, ModelCompletionResult, ProviderHealthResult
from ..secrets import resolve_grader_key

_BASE_URL = "https://openrouter.ai/api/v1"
_ALLOWED_MODELS = frozenset({"claude-sonnet-5-5", "gemini-2.5"})


@dataclass
class OpenRouterAdapter:
    provider: str = "openrouter"
    _client: httpx.AsyncClient = field(default_factory=lambda: httpx.AsyncClient(timeout=20.0))

    @property
    def is_configured(self) -> bool:
        return resolve_grader_key(self.provider) is not None

    def supports_model(self, model: str) -> bool:
        # OpenRouter can route to many models; this is "known to be wired
        # for this deployment," not "every model OpenRouter offers."
        return model in _ALLOWED_MODELS

    async def check_health(self) -> ProviderHealthResult:
        if not self.is_configured:
            return ProviderHealthResult(
                provider=self.provider,
                reachable=False,
                circuit_state="CLOSED",
                latency_ms=None,
                message="no key configured",
            )
        start = time.monotonic()
        try:
            resp = await self._client.get(f"{_BASE_URL}/models", timeout=5.0)
            latency = (time.monotonic() - start) * 1000
            return ProviderHealthResult(
                provider=self.provider,
                reachable=resp.status_code < 500,
                circuit_state="CLOSED",
                latency_ms=latency,
            )
        except httpx.HTTPError as exc:
            return ProviderHealthResult(
                provider=self.provider,
                reachable=False,
                circuit_state="CLOSED",
                latency_ms=None,
                message=str(exc),
            )

    async def complete(self, options: ModelCompletionOptions) -> ModelCompletionResult:
        key = resolve_grader_key(self.provider)
        if key is None:
            raise ProviderAuthError(self.provider)
        start = time.monotonic()
        try:
            resp = await self._client.post(
                f"{_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": options.model,
                    "messages": (
                        [{"role": "system", "content": options.system}] if options.system else []
                    )
                    + [{"role": "user", "content": options.prompt}],
                    "temperature": options.temperature,
                    "max_tokens": options.max_tokens,
                },
                timeout=options.timeout_s,
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
        choice = body["choices"][0]["message"]["content"]
        usage = body.get("usage", {})
        return ModelCompletionResult(
            output_text=choice,
            provider=self.provider,
            model=options.model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            latency_ms=latency,
        )
