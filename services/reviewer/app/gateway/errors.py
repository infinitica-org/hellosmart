"""Gateway error taxonomy (AD-014a).

Provider-selection failures (unreachable, circuit open, timeout) and key/auth
failures must raise *different* exception types. Collapsing them into one
generic error hides the difference between "the key is bad" and "the
provider is down" — which, with a Secrets Manager key cached for up to five
minutes, is exactly the window a rotated/revoked key gets silently retried
against fallback providers and misread as an availability incident.

None of these carry the raw provider error body: that can contain the
request payload (which may include sanitized-but-still-sensitive candidate
evidence) in some providers' error responses, and must never reach logs
unredacted. Callers log `str(exc)` only, which each class keeps safe.
"""

from __future__ import annotations


class GatewayError(Exception):
    """Base for every gateway failure. Never raised directly."""


class ProviderAuthError(GatewayError):
    """The provider rejected the key itself (401/403, invalid/revoked key).

    This is NOT an availability problem: retrying against this provider
    again, or tripping its circuit breaker as if it were down, is wrong.
    Surfacing this distinctly lets ops tell "key is bad, rotate it" apart
    from "provider is down, wait it out" without reading provider logs.
    """

    def __init__(self, provider: str) -> None:
        super().__init__(f"{provider}: key rejected by provider (auth failure)")
        self.provider = provider


class ProviderUnavailableError(GatewayError):
    """The provider could not be reached or did not respond in time.

    Covers timeouts, 5xx, connection resets. This is the only error class
    that should ever cause a circuit breaker to open.
    """

    def __init__(self, provider: str, reason: str) -> None:
        super().__init__(f"{provider}: unavailable ({reason})")
        self.provider = provider
        self.reason = reason


class CircuitOpenError(ProviderUnavailableError):
    """The breaker for this provider is already OPEN; the call was skipped."""

    def __init__(self, provider: str) -> None:
        super().__init__(provider, "circuit open")


class ModelDeprecatedError(ProviderUnavailableError):
    """The provider reports the requested model id no longer exists/serves.

    Distinct from a generic unavailable: an outage recovers on its own, a
    deprecated model id never will, so this should alert differently
    (someone needs to update the agent's pinned model) rather than just
    waiting for the breaker to close.
    """

    def __init__(self, provider: str, model: str) -> None:
        super().__init__(provider, f"model '{model}' deprecated or unknown")
        self.model = model


class ModelSubstitutedWarning(GatewayError):
    """Not a failure to raise — a marker the router attaches to a result.

    Raised internally only to short-circuit the fallback chain into "yes,
    we are about to answer with a different model than the one requested."
    Callers catch this to read `.actual_model` / `.requested_model` and set
    `flags: ["model_substituted"]` + a hard confidence cap on the resulting
    AgentScore (BR-20: a score produced by an uncalibrated model is not
    equivalent to the agent's golden-set-validated one).
    """

    def __init__(self, requested_model: str, actual_model: str, actual_provider: str) -> None:
        super().__init__(
            f"requested model '{requested_model}' unavailable on any same-model path; "
            f"substituted '{actual_model}' via {actual_provider}"
        )
        self.requested_model = requested_model
        self.actual_model = actual_model
        self.actual_provider = actual_provider
