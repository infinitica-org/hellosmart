"""Reviewer-internal AI gateway (AD-014a).

Scope: routes a reviewer agent's declared model request to a provider, with a
same-model-before-cross-model fallback chain. This module is internal to
`services/reviewer` only — it is not the candidate-facing `services/ai-proxy`
(BR-13), which is a different actor with its own keys and caps.
"""

from .errors import (
    CircuitOpenError,
    GatewayError,
    ModelSubstitutedWarning,
    ProviderAuthError,
    ProviderUnavailableError,
)
from .interface import (
    AIProviderAdapter,
    ModelCompletionOptions,
    ModelCompletionResult,
    ProviderHealthResult,
)
from .router import ModelRouter

__all__ = [
    "AIProviderAdapter",
    "CircuitOpenError",
    "GatewayError",
    "ModelCompletionOptions",
    "ModelCompletionResult",
    "ModelRouter",
    "ModelSubstitutedWarning",
    "ProviderAuthError",
    "ProviderHealthResult",
    "ProviderUnavailableError",
]
