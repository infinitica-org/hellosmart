"""Grader key resolution (services/reviewer/CLAUDE.md: "Grader model keys
are platform keys from Secrets Manager, separate from company keys").

Reuses services/ai-proxy's existing convention rather than inventing a new
one: resolve at call time, cache in memory only, never log the value.
Cache TTL matches ai-proxy's (5 min) — see the key-rotation edge case in
AD-014a's task notes: a revoked key can still be served from this cache for
up to that window, which is exactly why ProviderAuthError must come from
the provider's live 401/403, not from a local "key looks wrong" check.
"""

from __future__ import annotations

import time

_CACHE_TTL_S = 300.0
_cache: dict[str, tuple[str, float]] = {}


def resolve_grader_key(provider: str) -> str | None:
    """Returns the cached key for `provider`, or fetches + caches it.

    Scaffold note: `_fetch_from_secrets_manager` is a placeholder — wiring
    the real `boto3` Secrets Manager call is explicitly out of scope for
    AD-014a (see task file "Out of scope"); this keeps the call shape real
    so adapters don't need to change when it's wired.
    """
    cached = _cache.get(provider)
    if cached is not None and time.monotonic() - cached[1] < _CACHE_TTL_S:
        return cached[0]

    value = _fetch_from_secrets_manager(provider)
    if value is not None:
        _cache[provider] = (value, time.monotonic())
    return value


def _fetch_from_secrets_manager(provider: str) -> str | None:
    import os

    # Local/dev/test placeholder only; production wiring goes through
    # boto3 Secrets Manager, not environment variables (CLAUDE.md non-negotiable).
    return os.environ.get(f"HS_GRADER_KEY_{provider.upper()}")


def invalidate(provider: str) -> None:
    """Drop a cached key immediately — called when a provider returns
    ProviderAuthError, so a rotated-but-not-yet-expired-from-cache key
    doesn't get retried against the same provider on the next request.
    """
    _cache.pop(provider, None)
