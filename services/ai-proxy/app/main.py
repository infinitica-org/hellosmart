"""AI proxy: the only path from workspaces to LLM providers (BR-13, NF-005).

Request pipeline (AGENTS.md §10.2):
  1. verify workspace token  2. policy (on/off, model allowlist)  3. RPM + caps (atomic, Redis)
  4. resolve key from Secrets Manager (cached in memory, never logged)  5. forward + stream
  6. persist usage + transcript ref  7. degrade cleanly on provider failure (EX-03)
"""

from fastapi import FastAPI

from app.auth import WorkspaceClaims, verify_workspace_token  # noqa: F401  (wired in S1)

app = FastAPI(title="hs-ai-proxy", docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
