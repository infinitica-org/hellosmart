"""Evidence builder for the production-readiness agent (AD-014b).

Narrower first-pass port of ProjAgentScan's src/agents/production_readiness/evidence.py: file-
presence and lightweight-content signals for deployment/infra, CI, config hygiene and health
endpoints. ProjAgentScan's original check suite also does deeper static analysis (parsed
structured-logging usage, migration-tool detection); that depth is a follow-up, not carried over
here -- see tasks/AD-014b-reviewer-agent-library.md.
"""

from __future__ import annotations

import re

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .repo_io import RepoReader

_DOCKER_NAMES = ("Dockerfile", "docker-compose.yml", "docker-compose.yaml")
_IAC_SUFFIXES = {".tf"}
_CI_PATHS = (".github/workflows", ".gitlab-ci.yml", "Jenkinsfile", ".circleci/config.yml")
_LOCKFILE_NAMES = (
    "uv.lock", "poetry.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "Pipfile.lock", "requirements.txt",
)
_ENV_SECRET_RE = re.compile(r"^[A-Z0-9_]+\s*=\s*[^\s#]{6,}", re.MULTILINE)


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

    docker_present = any(reader.exists(n) for n in _DOCKER_NAMES)
    iac_present = any(f.endswith(tuple(_IAC_SUFFIXES)) for f in all_files)
    _add_fact(
        pack, "repo:fact.deployment_and_infrastructure",
        f"docker_or_compose_present={docker_present}; infrastructure_as_code_present={iac_present}",
    )

    ci_present = any(f.startswith(".github/workflows") or f in _CI_PATHS for f in all_files)
    _add_fact(pack, "repo:fact.cicd", f"ci_pipeline_present={ci_present}")

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
    _add_fact(pack, "repo:fact.dependency_readiness", f"lockfile_present={lockfile_present}")

    health_pattern = re.compile(r"(/health|/healthz|/ready|/readyz|/livez)")
    health_present = False
    for rel in reader.iter_files("source", suffixes={".py", ".js", ".ts", ".go"}):
        source_text = reader.read_text(rel)
        if source_text and health_pattern.search(source_text):
            health_present = True
            break
    _add_fact(
        pack, "repo:fact.health_and_observability", f"health_endpoint_present={health_present}"
    )

    pack.coverage.append(EvidenceCoverage(channel="artifact", status="available"))
    pack.truncations.extend(reader.truncations)
    return pack
