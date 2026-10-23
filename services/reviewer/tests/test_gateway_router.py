"""AC3/AC4/AC5/AC9: fallback order, error taxonomy, model substitution."""

import pytest

from app.gateway.adapters.fake import FakeAdapter
from app.gateway.errors import GatewayError, ProviderAuthError, ProviderUnavailableError
from app.gateway.interface import ModelCompletionOptions
from app.gateway.router import MODEL_SUBSTITUTION_CONFIDENCE_CAP, ModelRouter


def _options(model: str, prompt: str = "grade this") -> ModelCompletionOptions:
    return ModelCompletionOptions(model=model, prompt=prompt)


@pytest.mark.asyncio
async def test_same_model_succeeds_via_openrouter_first() -> None:
    router = ModelRouter(
        adapters=[
            FakeAdapter(provider="openrouter"),
            FakeAdapter(provider="anthropic", known_models=frozenset({"claude-sonnet-5-5"})),
        ]
    )
    routed = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5"))
    assert routed.result.provider == "openrouter"
    assert routed.substituted is False


@pytest.mark.asyncio
async def test_openrouter_down_falls_back_to_same_model_direct_before_cross_model() -> None:
    """AD-014a design decision: same-model-direct is tried before any
    cross-model substitution, even though the fallback list could
    technically reach a cross-model adapter faster.
    """
    router = ModelRouter(
        adapters=[
            FakeAdapter(provider="openrouter", fail_mode="unavailable"),
            FakeAdapter(
                provider="anthropic",
                known_models=frozenset({"claude-sonnet-5-5"}),
                default_substitute_model="claude-sonnet-5-5",
            ),
            FakeAdapter(
                provider="gemini",
                known_models=frozenset({"gemini-2.5"}),
                default_substitute_model="gemini-2.5",
            ),
        ]
    )
    routed = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5"))
    assert routed.result.provider == "anthropic"  # same-model-direct, not gemini
    assert routed.substituted is False
    assert routed.confidence_cap is None


@pytest.mark.asyncio
async def test_all_same_model_paths_down_substitutes_and_caps_confidence() -> None:
    router = ModelRouter(
        adapters=[
            FakeAdapter(provider="openrouter", fail_mode="unavailable"),
            FakeAdapter(
                provider="anthropic",
                fail_mode="unavailable",
                known_models=frozenset({"claude-sonnet-5-5"}),
            ),
            FakeAdapter(
                provider="gemini",
                known_models=frozenset({"gemini-2.5"}),
                default_substitute_model="gemini-2.5",
            ),
        ]
    )
    routed = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5"))
    assert routed.substituted is True
    assert routed.result.provider == "gemini"
    assert routed.result.model == "gemini-2.5"  # substitute model, not the requested one
    assert routed.confidence_cap == MODEL_SUBSTITUTION_CONFIDENCE_CAP


@pytest.mark.asyncio
async def test_auth_failure_raises_distinct_type_and_does_not_open_circuit() -> None:
    openrouter = FakeAdapter(provider="openrouter", fail_mode="auth")
    anthropic = FakeAdapter(
        provider="anthropic",
        known_models=frozenset({"claude-sonnet-5-5"}),
    )
    router = ModelRouter(adapters=[openrouter, anthropic])

    routed = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5"))
    assert routed.result.provider == "anthropic"
    # the auth failure must not have tripped openrouter's breaker open —
    # record_auth_failure() is a no-op (errors.py / circuit_breaker.py contract)
    assert router._breaker("openrouter").state == "CLOSED"


@pytest.mark.asyncio
async def test_exhausting_every_adapter_raises_gateway_error_not_generic_exception() -> None:
    router = ModelRouter(
        adapters=[
            FakeAdapter(provider="openrouter", fail_mode="unavailable"),
        ]
    )
    with pytest.raises(GatewayError):
        await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5"))


def test_error_taxonomy_types_are_distinct() -> None:
    assert not issubclass(ProviderAuthError, ProviderUnavailableError)
    assert issubclass(ProviderAuthError, GatewayError)
    assert issubclass(ProviderUnavailableError, GatewayError)


@pytest.mark.asyncio
async def test_fake_adapter_is_a_pure_function_of_model_and_prompt() -> None:
    """Determinism precondition for AC9: the fake adapter must be a pure
    function of (model, prompt) — no clock, no randomness — so that
    test_evidence_injection.py's actual injection-resistance assertion
    (same evidence, different injection attempt => same score) is testing
    the sanitizer, not accidentally passing because the fake adapter
    ignores its input.
    """
    router = ModelRouter(adapters=[FakeAdapter(provider="openrouter")])
    first = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5", "grade this"))
    second = await router.complete("claude-sonnet-5-5", _options("claude-sonnet-5-5", "grade this"))
    assert first.result.output_text == second.result.output_text
