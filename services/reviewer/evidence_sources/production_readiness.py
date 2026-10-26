"""Evidence builder for the production-readiness agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/production_readiness/evidence.py: Dockerfile
quality (placeholder/pinned-base/multistage), CI-configured test/lint steps (not just "a
workflow file exists") with provider identification, structured-logging and custom-exception
usage, environment-variable/typed-settings usage, health/observability tool detection, IaC
classification (docker-compose/kubernetes/terraform, not just a boolean), and database-migration
detection -- the checks the narrower first pass deliberately left out even though this agent's
own rubric cites "configured, not proven" CI and real logging/error-handling usage directly.
"""

from __future__ import annotations

import re
from pathlib import PurePosixPath

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.production_signals import (
    analyze_ci_workflows,
    analyze_config_hygiene,
    analyze_dockerfile,
    analyze_health_and_observability,
    analyze_logging_and_errors,
    analyze_migrations,
    classify_iac_type,
)
from .repo_io import RepoReader, safe_parse_python

README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")
_DOCKER_NAMES = ("Dockerfile", "docker-compose.yml", "docker-compose.yaml")
_COMPOSE_SUFFIXES = ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")
_TERRAFORM_SUFFIXES = {".tf"}
_CI_PATHS = (".gitlab-ci.yml", "Jenkinsfile", ".circleci/config.yml")
_LOCKFILE_NAMES = (
    "uv.lock", "poetry.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "Pipfile.lock", "requirements.txt", "Cargo.lock", "go.sum",
)
_ENV_SECRET_RE = re.compile(r"^[A-Z0-9_]+\s*=\s*[^\s#]{6,}", re.MULTILINE)
_SOURCE_SUFFIXES = {".py", ".js", ".ts", ".go"}


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_fact(pack: EvidencePack, ref: str, content: str) -> None:
    pack.items.append(
        EvidenceItem(ref=ref, source="artifact", content=content, untrusted=False, sanitized=False)
    )


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="production-readiness", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)
    all_files = reader.iter_files("any")

    dockerfile_name = next((n for n in ("Dockerfile", "dockerfile") if reader.exists(n)), None)
    has_compose = any(f.endswith(_COMPOSE_SUFFIXES) for f in all_files)
    docker_present = dockerfile_name is not None or any(
        reader.exists(n) for n in _DOCKER_NAMES[1:]
    )
    has_terraform = any(f.endswith(tuple(_TERRAFORM_SUFFIXES)) for f in all_files)
    has_k8s_or_helm = any(
        f.startswith("k8s/") and f.endswith((".yml", ".yaml"))
        or f.startswith("helm/") and f.endswith((".yml", ".yaml"))
        for f in all_files
    )
    iac_type = classify_iac_type(has_compose, has_k8s_or_helm, has_terraform)
    quality = (
        analyze_dockerfile(reader.read_text(dockerfile_name) or "")
        if dockerfile_name
        else {
            "is_empty_or_placeholder": True, "has_pinned_base_image": False,
            "is_multistage": False,
        }
    )
    _add_fact(
        pack, "repo:fact.deployment_and_infrastructure",
        f"docker_or_compose_present={docker_present}; infrastructure_as_code_type={iac_type}; "
        f"dockerfile_is_placeholder={quality['is_empty_or_placeholder']}; "
        f"dockerfile_has_pinned_base={quality['has_pinned_base_image']}; "
        f"dockerfile_is_multistage={quality['is_multistage']}",
    )

    gh_workflows = [
        f for f in all_files
        if f.startswith(".github/workflows/") and f.endswith((".yml", ".yaml"))
    ]
    other_ci = [f for f in all_files if f in _CI_PATHS]
    workflow_files = gh_workflows + other_ci
    ci_present = bool(workflow_files)
    provider = (
        "github_actions" if gh_workflows
        else "gitlab_ci" if ".gitlab-ci.yml" in other_ci
        else "circleci" if ".circleci/config.yml" in other_ci
        else "jenkins" if "Jenkinsfile" in other_ci
        else "none"
    )
    workflow_texts: list[str] = []
    for f in workflow_files:
        text = reader.read_text(f)
        if text is not None:
            workflow_texts.append(text)
    ci_depth = analyze_ci_workflows(provider, workflow_texts)
    _add_fact(
        pack, "repo:fact.cicd",
        f"ci_pipeline_present={ci_present}; provider={ci_depth['provider']}; "
        f"runs_tests_configured={ci_depth['runs_tests_configured']}; "
        f"runs_linter_configured={ci_depth['runs_linter_configured']}; "
        f"workflow_count={ci_depth['workflow_count']}",
    )

    env_example = reader.read_text(".env.example") or reader.read_text(".env.sample")
    committed_env = reader.exists(".env")
    env_looks_secret_filled = False
    if committed_env:
        text = reader.read_text(".env") or ""
        env_looks_secret_filled = bool(_ENV_SECRET_RE.search(text))
    ref = "repo:fact.config_and_secrets"
    content: str = _sanitize(
        pack, ref,
        f"has_env_example={bool(env_example)}; committed_dot_env={committed_env}; "
        f"committed_dot_env_looks_populated={env_looks_secret_filled}",
    )
    pack.items.append(
        EvidenceItem(ref=ref, source="artifact", content=content, untrusted=True, sanitized=True)
    )

    lockfile_present = any(reader.exists(n) for n in _LOCKFILE_NAMES)
    migration_dirs = {
        str(PurePosixPath(f).parent) for f in all_files if not PurePosixPath(f).name.startswith(".")
    }
    migrations = analyze_migrations(migration_dirs)
    _add_fact(
        pack, "repo:fact.dependency_readiness",
        f"lockfile_present={lockfile_present}; has_migrations={migrations['has_migrations']}; "
        f"migration_framework={migrations['migration_framework']}",
    )

    source_files = reader.iter_files("source", suffixes=_SOURCE_SUFFIXES)
    file_texts: dict[str, str] = {}
    for rel in source_files:
        text = reader.read_text(rel)
        if text is not None:
            file_texts[rel] = text
    py_trees = {}
    for rel, text in file_texts.items():
        if rel.endswith(".py"):
            tree, _reason = safe_parse_python(text, rel)
            if tree is not None:
                py_trees[rel] = tree

    logging_info = analyze_logging_and_errors(py_trees, file_texts)
    _add_fact(
        pack, "repo:fact.logging_and_errors",
        f"uses_logging_library={logging_info['uses_logging_library']}; "
        f"has_error_handling={logging_info['has_error_handling']}; "
        f"custom_exceptions_count={logging_info['custom_exceptions_count']}",
    )

    health_info = analyze_health_and_observability(file_texts)
    health_present = bool(health_info["endpoint_paths"])
    _add_fact(
        pack, "repo:fact.health_and_observability",
        f"health_endpoint_present={health_present}; "
        f"endpoint_paths={', '.join(health_info['endpoint_paths']) or 'none'}; "
        f"observability_tools={', '.join(health_info['observability_tools']) or 'none'}",
    )

    config_hygiene = analyze_config_hygiene(file_texts)
    _add_fact(
        pack, "repo:fact.config_hygiene",
        f"uses_env_vars={config_hygiene['uses_env_vars']}; "
        f"typed_settings={config_hygiene['typed_settings']}",
    )

    readme_name = next((n for n in README_CANDIDATES if reader.exists(n)), None)
    readme_text = (
        reader.read_text(readme_name, max_bytes=README_MAX_CHARS, truncate=True)
        if readme_name else None
    )
    if readme_text and readme_text.strip():
        ref = "repo:ev.readme.deployment_docs"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, readme_text),
                untrusted=True, sanitized=True,
            )
        )
    else:
        pack.coverage.append(
            EvidenceCoverage(
                channel="artifact", status="unavailable",
                reason="no README found for deployment documentation",
            )
        )

    pack.coverage.append(EvidenceCoverage(channel="artifact", status="available"))
    pack.truncations.extend(reader.truncations)
    return pack
