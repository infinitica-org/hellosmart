"""Static production-readiness signals: Dockerfile quality, CI-configured steps, structured
logging/error-handling usage, health/observability endpoints, and database migrations.

Ported from ProjAgentScan's src/agents/production_readiness/evidence.py (logic unchanged; the
inline-filesystem-walk style of the original was adapted to take an already-parsed AST dict and
already-read file texts, consistent with this package's RepoReader-only file access rule).
"""

from __future__ import annotations

import ast
import re
from typing import TypedDict

_CI_TEST_RE = re.compile(
    r"\b(pytest|npm\s+(run\s+)?test|yarn\s+test|pnpm\s+test|go\s+test|cargo\s+test|"
    r"python\s+-m\s+unittest|manage\.py\s+test)\b",
    re.IGNORECASE,
)
_CI_LINT_RE = re.compile(
    r"\b(ruff|flake8|eslint|mypy|black|prettier|golangci-lint|clippy)\b", re.IGNORECASE
)
_FROM_RE = re.compile(r"^FROM\s+(\S+)", re.IGNORECASE)
_ACTION_RE = re.compile(r"^(COPY|ADD|RUN|CMD|ENTRYPOINT|EXPOSE|WORKDIR)\s+", re.IGNORECASE)
_HEALTH_ROUTE_RE = re.compile(
    r"""['"]/(health|healthz|ready|readiness|live|liveness|ping|status)['"]""", re.IGNORECASE
)
_OBSERVABILITY_TOOLS = ("prometheus", "opentelemetry", "sentry", "datadog")
_MIGRATION_DIR_FRAMEWORKS = (
    ("prisma/migrations", "prisma"),
    ("alembic/versions", "alembic"),
    ("migrations/versions", "alembic"),
    ("db/migrations", "sql"),
    ("src/migrations", "generic"),
)
_JS_LOGGING_LIBS = ("winston", "pino", "morgan")


class DockerfileQuality(TypedDict):
    is_empty_or_placeholder: bool
    has_pinned_base_image: bool
    is_multistage: bool


class CiWorkflows(TypedDict):
    provider: str
    runs_tests_configured: bool
    runs_linter_configured: bool
    workflow_count: int


class ConfigHygiene(TypedDict):
    uses_env_vars: bool
    typed_settings: bool


class LoggingAndErrors(TypedDict):
    uses_logging_library: bool
    has_error_handling: bool
    custom_exceptions_count: int


class HealthAndObservability(TypedDict):
    endpoint_paths: list[str]
    observability_tools: list[str]


class MigrationInfo(TypedDict):
    has_migrations: bool
    migration_framework: str


def classify_iac_type(
    has_compose: bool, has_k8s_or_helm: bool, has_terraform: bool
) -> str:
    if has_k8s_or_helm:
        return "kubernetes"
    if has_terraform:
        return "terraform"
    if has_compose:
        return "docker_compose"
    return "none"


def analyze_config_hygiene(file_texts: dict[str, str]) -> ConfigHygiene:
    uses_env_vars = False
    typed_settings = False
    for rel, text in file_texts.items():
        if rel.endswith(".py"):
            if "os.environ" in text or "os.getenv" in text or "dotenv" in text:
                uses_env_vars = True
            if "BaseSettings" in text or "pydantic_settings" in text:
                typed_settings = True
        elif rel.endswith((".js", ".ts", ".jsx", ".tsx")):
            if "process.env" in text or "dotenv" in text:
                uses_env_vars = True
            if "z.object" in text and "env" in rel.lower():
                typed_settings = True
    return {"uses_env_vars": uses_env_vars, "typed_settings": typed_settings}


def analyze_dockerfile(text: str) -> DockerfileQuality:
    lines = [
        ln.strip() for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")
    ]
    from_lines = [ln for ln in lines if _FROM_RE.match(ln)]
    if not lines or not from_lines:
        return {
            "is_empty_or_placeholder": True, "has_pinned_base_image": False, "is_multistage": False
        }

    has_pinned = False
    for fl in from_lines:
        m = _FROM_RE.match(fl)
        if m:
            img = m.group(1).lower()
            if "@sha256:" in img or (":" in img and not img.endswith(":latest")):
                has_pinned = True
                break

    action_instructions = [ln for ln in lines if _ACTION_RE.match(ln)]
    return {
        "is_empty_or_placeholder": len(action_instructions) == 0,
        "has_pinned_base_image": has_pinned,
        "is_multistage": len(from_lines) > 1,
    }


def analyze_ci_workflows(provider: str, workflow_texts: list[str]) -> CiWorkflows:
    runs_tests = any(_CI_TEST_RE.search(t) for t in workflow_texts)
    runs_lint = any(_CI_LINT_RE.search(t) for t in workflow_texts)
    return {
        "provider": provider, "runs_tests_configured": runs_tests,
        "runs_linter_configured": runs_lint, "workflow_count": len(workflow_texts),
    }


def analyze_logging_and_errors(
    file_trees: dict[str, ast.AST], file_texts: dict[str, str]
) -> LoggingAndErrors:
    uses_logging = False
    has_error_handling = False
    custom_exceptions = 0
    for rel, text in file_texts.items():
        if "import logging" in text or "from logging import" in text or "loguru" in text:
            uses_logging = True
        elif rel.endswith((".js", ".ts", ".jsx", ".tsx")) and any(
            lib in text for lib in _JS_LOGGING_LIBS
        ):
            uses_logging = True
        if "try:" in text and "except" in text:
            has_error_handling = True
        tree = file_trees.get(rel)
        if tree is None:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                for base in node.bases:
                    base_name = getattr(base, "id", "") or getattr(base, "attr", "")
                    if "Exception" in base_name or "Error" in base_name:
                        custom_exceptions += 1
    return {
        "uses_logging_library": uses_logging, "has_error_handling": has_error_handling,
        "custom_exceptions_count": custom_exceptions,
    }


def analyze_health_and_observability(file_texts: dict[str, str]) -> HealthAndObservability:
    endpoints: set[str] = set()
    tools: set[str] = set()
    for text in file_texts.values():
        for m in _HEALTH_ROUTE_RE.finditer(text):
            endpoints.add(f"/{m.group(1).lower()}")
        for tool in _OBSERVABILITY_TOOLS:
            if tool in text:
                tools.add(tool)
    return {"endpoint_paths": sorted(endpoints), "observability_tools": sorted(tools)}


def analyze_migrations(dirs_with_files: set[str]) -> MigrationInfo:
    for rel_dir, framework in _MIGRATION_DIR_FRAMEWORKS:
        if rel_dir in dirs_with_files:
            return {"has_migrations": True, "migration_framework": framework}
    return {"has_migrations": False, "migration_framework": "none"}
