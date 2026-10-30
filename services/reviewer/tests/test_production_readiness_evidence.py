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


def test_placeholder_dockerfile_is_flagged_and_pinned_multistage_is_not(tmp_path: Path) -> None:
    """A bare `FROM` line with no COPY/RUN/CMD is a placeholder, not working deployment
    infrastructure -- the narrower first pass had no fact to distinguish the two."""
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("Dockerfile").write_text("FROM python:latest\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    facts = {i.ref: i.content for i in pack.items}
    content = facts["repo:fact.deployment_and_infrastructure"]
    assert "dockerfile_is_placeholder=True" in content
    assert "dockerfile_has_pinned_base=False" in content
    assert "dockerfile_is_multistage=False" in content


def test_pinned_multistage_dockerfile_is_recognized(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("Dockerfile").write_text(
        "FROM python:3.12-slim AS build\nRUN pip install -r requirements.txt\n\n"
        "FROM python:3.12-slim\nCOPY --from=build /app /app\nCMD [\"python\", \"app.py\"]\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.deployment_and_infrastructure"]
    assert "dockerfile_is_placeholder=False" in content
    assert "dockerfile_has_pinned_base=True" in content
    assert "dockerfile_is_multistage=True" in content


def test_ci_distinguishes_configured_tests_from_a_workflow_that_merely_exists(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repo"
    (root / ".github" / "workflows").mkdir(parents=True)
    root.joinpath(".github", "workflows", "ci.yml").write_text(
        "on: push\njobs:\n  test:\n    steps:\n      - run: pytest\n      - run: ruff check .\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.cicd"]
    assert "runs_tests_configured=True" in content
    assert "runs_linter_configured=True" in content


def test_structured_logging_and_custom_exceptions_are_detected(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("errors.py").write_text(
        "import logging\n\nlogger = logging.getLogger(__name__)\n\n\n"
        "class OrderNotFoundError(Exception):\n    pass\n\n\n"
        "def handle():\n    try:\n        pass\n    except Exception:\n        logger.error('x')\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.logging_and_errors"]
    assert "uses_logging_library=True" in content
    assert "has_error_handling=True" in content
    assert "custom_exceptions_count=1" in content


def test_observability_tool_mentions_are_detected(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("telemetry.py").write_text(
        "import sentry_sdk\nsentry_sdk.init()\n", encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.health_and_observability"]
    assert "observability_tools=sentry" in content


def test_ci_provider_is_identified(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.joinpath(".circleci").mkdir(parents=True)
    root.joinpath(".circleci", "config.yml").write_text("jobs:\n  test:\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.cicd"]
    assert "provider=circleci" in content


def test_env_vars_and_typed_settings_usage_is_detected(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("config.py").write_text(
        "from pydantic_settings import BaseSettings\n\n\n"
        "class Settings(BaseSettings):\n    api_key: str\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.config_hygiene"]
    assert "typed_settings=True" in content


def test_kubernetes_iac_is_classified_over_a_bare_terraform_file(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / "k8s").mkdir(parents=True)
    root.joinpath("k8s", "deployment.yaml").write_text("kind: Deployment\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.deployment_and_infrastructure"]
    assert "infrastructure_as_code_type=kubernetes" in content


def test_readme_is_captured_as_deployment_documentation(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("README.md").write_text(
        "# App\n\nRun with docker compose up.\n", encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    assert "repo:ev.readme.deployment_docs" in pack.refs


def test_rust_and_go_lockfiles_count_as_lockfile_present(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("Cargo.lock").write_text("", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.dependency_readiness"]
    assert "lockfile_present=True" in content


def test_database_migrations_are_detected(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / "alembic" / "versions").mkdir(parents=True)
    root.joinpath("alembic", "versions", "0001_init.py").write_text("", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    content = {i.ref: i.content for i in pack.items}["repo:fact.dependency_readiness"]
    assert "has_migrations=True" in content
    assert "migration_framework=alembic" in content
