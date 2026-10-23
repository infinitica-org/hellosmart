"""AC1: service starts safely, zero network egress in fake mode.

FastAPI's TestClient drives the ASGI app in-process (no real socket is
opened for the HTTP round-trip itself), so the egress guarantee this test
actually needs to prove is narrower and more direct: in LLM_PROVIDER=fake
mode, the wired router contains only FakeAdapter instances — anthropic's
and httpx's client classes, which are what would open a real connection,
are never constructed.
"""

from fastapi.testclient import TestClient

from app.gateway.adapters.fake import FakeAdapter
from app.main import _router, app


def test_healthz_returns_ok() -> None:
    client = TestClient(app)
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["providers"][0]["reachable"] is True


def test_fake_mode_wires_only_fake_adapters() -> None:
    assert all(isinstance(a, FakeAdapter) for a in _router.adapters)
