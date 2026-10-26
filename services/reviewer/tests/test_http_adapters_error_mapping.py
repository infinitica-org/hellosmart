"""Real-adapter error mapping: every HTTP-based adapter must turn provider
responses into the same two error types the fake adapter uses, so the
router's fallback/circuit-breaker logic works identically with a live
provider as it does in tests.
"""

import httpx
import pytest
import respx

from app.gateway.adapters.gemini import GeminiAdapter
from app.gateway.adapters.openrouter import OpenRouterAdapter
from app.gateway.errors import ProviderAuthError, ProviderUnavailableError
from app.gateway.interface import ModelCompletionOptions


@pytest.fixture(autouse=True)
def _grader_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HS_GRADER_KEY_OPENROUTER", "test-key")
    monkeypatch.setenv("HS_GRADER_KEY_GEMINI", "test-key")
    from app.gateway import secrets

    secrets._cache.clear()


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_401_raises_auth_error() -> None:
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(401, json={"error": "invalid key"})
    )
    adapter = OpenRouterAdapter()
    with pytest.raises(ProviderAuthError):
        await adapter.complete(ModelCompletionOptions(model="claude-sonnet-5-5", prompt="x"))


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_500_raises_unavailable() -> None:
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=httpx.Response(500)
    )
    adapter = OpenRouterAdapter()
    with pytest.raises(ProviderUnavailableError):
        await adapter.complete(ModelCompletionOptions(model="claude-sonnet-5-5", prompt="x"))


@respx.mock
@pytest.mark.asyncio
async def test_openrouter_timeout_raises_unavailable() -> None:
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        side_effect=httpx.TimeoutException("boom")
    )
    adapter = OpenRouterAdapter()
    with pytest.raises(ProviderUnavailableError):
        await adapter.complete(ModelCompletionOptions(model="claude-sonnet-5-5", prompt="x"))


@respx.mock
@pytest.mark.asyncio
async def test_gemini_403_raises_auth_error() -> None:
    respx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateContent"
    ).mock(return_value=httpx.Response(403))
    adapter = GeminiAdapter()
    with pytest.raises(ProviderAuthError):
        await adapter.complete(ModelCompletionOptions(model="gemini-2.5", prompt="x"))


@respx.mock
@pytest.mark.asyncio
async def test_gemini_503_raises_unavailable() -> None:
    respx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateContent"
    ).mock(return_value=httpx.Response(503))
    adapter = GeminiAdapter()
    with pytest.raises(ProviderUnavailableError):
        await adapter.complete(ModelCompletionOptions(model="gemini-2.5", prompt="x"))
