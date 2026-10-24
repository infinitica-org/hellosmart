"""AD-014b: production-readiness evidence builder."""

from __future__ import annotations

from pathlib import Path

from evidence_sources.production_readiness import build_evidence


def test_well_configured_repo_shows_positive_signals(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / ".github" / "workflows").mkdir(parents=True)
    root.joinpath("Dockerfile").write_text("FROM python:3.12\n", encoding="utf-8")
    root.joinpath(".github", "workflows", "ci.yml").write_text("on: push\n", encoding="utf-8")
    root.joinpath("uv.lock").write_text("", encoding="utf-8")
    root.joinpath(".env.example").write_text("API_KEY=\n", encoding="utf-8")
    root.joinpath("app.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n\n@app.get('/healthz')\n"
        "def healthz():\n    return 'ok'\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))

    facts = {i.ref: i.content for i in pack.items}
    assert "docker_or_compose_present=True" in facts["repo:fact.deployment_and_infrastructure"]
    assert "ci_pipeline_present=True" in facts["repo:fact.cicd"]
    assert "lockfile_present=True" in facts["repo:fact.dependency_readiness"]
    assert "health_endpoint_present=True" in facts["repo:fact.health_and_observability"]
    assert "committed_dot_env=False" in facts["repo:fact.config_and_secrets"]


def test_bare_repo_shows_negative_signals(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text("x = 1\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    facts = {i.ref: i.content for i in pack.items}
    assert "docker_or_compose_present=False" in facts["repo:fact.deployment_and_infrastructure"]
    assert "ci_pipeline_present=False" in facts["repo:fact.cicd"]


def test_pack_is_deterministic(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("Dockerfile").write_text("FROM python:3.12\n", encoding="utf-8")
    pack1 = build_evidence("sub-1", str(root))
    pack2 = build_evidence("sub-1", str(root))
    assert pack1.model_dump() == pack2.model_dump()
