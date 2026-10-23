"""Per-provider circuit breaker (pattern ported from HireKiwi's circuit-breaker.ts).

One breaker per provider so one provider tripping never blocks trying the
next one in the fallback chain. Deterministic, in-process, no I/O — the
reviewer service runs as independent worker processes, each with its own
breaker state; that's acceptable here because a breaker's job is to stop
*this process* from hammering a dead provider, not to coordinate cluster-wide.
"""

from __future__ import annotations

import time

from .interface import CircuitState

_FAILURE_THRESHOLD = 3
_OPEN_COOLDOWN_S = 30.0


class CircuitBreaker:
    def __init__(self, provider: str) -> None:
        self.provider = provider
        self._state: CircuitState = "CLOSED"
        self._failure_count = 0
        self._opened_at: float | None = None

    @property
    def state(self) -> CircuitState:
        if self._state == "OPEN" and self._opened_at is not None:
            if time.monotonic() - self._opened_at >= _OPEN_COOLDOWN_S:
                self._state = "HALF_OPEN"
        return self._state

    def allow_request(self) -> bool:
        return self.state != "OPEN"

    def record_success(self) -> None:
        self._state = "CLOSED"
        self._failure_count = 0
        self._opened_at = None

    def record_failure(self) -> None:
        self._failure_count += 1
        if self._failure_count >= _FAILURE_THRESHOLD:
            self._state = "OPEN"
            self._opened_at = time.monotonic()

    def record_auth_failure(self) -> None:
        """Auth failures never open the circuit (AD-014a AC4): a bad key
        looks nothing like an outage, and opening the breaker here would
        misreport "provider down" when the real fix is "rotate the key."
        """
        return
