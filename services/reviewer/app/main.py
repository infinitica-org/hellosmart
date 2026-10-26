"""services/reviewer entrypoint (AD-014a AC1).

Starts safely with zero network egress when LLM_PROVIDER=fake (repo-wide
convention — see .env.example). Real provider wiring (Secrets Manager keys,
live OpenRouter/Anthropic/Gemini calls) is out of scope for this scaffold;
`build_default_router()` below is the seam a later ticket wires up.
"""

from __future__ import annotations

import os

from fastapi import FastAPI

from app.gateway import ModelRouter
from app.gateway.adapters.fake import FakeAdapter
from app.logging import configure_logging, get_logger

configure_logging()
log = get_logger(__name__)

app = FastAPI(title="hs-reviewer", docs_url=None, redoc_url=None, openapi_url=None)


def build_default_router() -> ModelRouter:
    provider_mode = os.environ.get("LLM_PROVIDER", "fake")
    if provider_mode == "fake":
        # Zero network egress: a single fake adapter answers for every
        # requested model (AC1). Real adapters are wired here once
        # LLM_PROVIDER != "fake" — not in this ticket's scope.
        return ModelRouter(adapters=[FakeAdapter(provider="openrouter")])

    raise NotImplementedError(
        f"LLM_PROVIDER={provider_mode!r}: real provider wiring is out of scope for AD-014a"
    )


_router = build_default_router()


@app.get("/healthz")
async def healthz() -> dict[str, object]:
    checks = []
    for adapter in _router.adapters:
        health = await adapter.check_health()
        checks.append(
            {
                "provider": health.provider,
                "reachable": health.reachable,
                "circuit_state": health.circuit_state,
            }
        )
    log.info("healthz", provider_mode=os.environ.get("LLM_PROVIDER", "fake"))
    return {"status": "ok", "providers": checks}
