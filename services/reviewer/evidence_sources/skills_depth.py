"""Evidence builder for the skills-depth agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/skills_depth/evidence.py: declared (every
requirements*.txt plus pyproject.toml's PEP 621 *and* Poetry dependency tables) vs genuinely-used
dependencies, carrying over the one security-relevant fix from that port's history
(docs/memory/pitfalls.md #26): a Python file whose entire body is import statements and nothing
else does not count as "using" what it imports -- that exact shape is the gaming vector a dummy
file importing every declared package would otherwise exploit. Also ported: the
distribution-name-to-import-name alias table (_PACKAGE_TO_MODULE_ALIASES, e.g. `scikit-learn`
declared but `sklearn` imported must still count as used -- without this, pure string matching
on the canonicalized name wrongly reports it unused), stub-function detection (pass-only /
NotImplementedError bodies), and technology-domain breadth classification (_TECH_DOMAINS) --
the fact this agent's own rubric cites directly ("breadth across domains", not just "many used
dependencies").
"""

from __future__ import annotations

import ast
import os
import re
import tomllib

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .repo_io import RepoReader, safe_parse_python

_REQ_LINE = re.compile(r"^\s*([A-Za-z0-9_.\-]+)")
_TEST_DIR_PARTS = frozenset({"tests", "test", "__tests__"})

# Distribution-package name -> the module name(s) actually imported for it. Checked both
# forward (declared as the distribution name) and reverse (declared as the import name).
_PACKAGE_TO_MODULE_ALIASES: dict[str, tuple[str, ...]] = {
    "scikit_learn": ("sklearn",),
    "pyyaml": ("yaml",),
    "beautifulsoup4": ("bs4",),
    "pillow": ("pil",),
    "psycopg2_binary": ("psycopg2",),
    "python_dotenv": ("dotenv",),
    "python_dateutil": ("dateutil",),
    "opencv_python": ("cv2",),
}

# Standard library modules (argparse, unittest) are excluded from domain counts.
_TECH_DOMAINS: dict[str, set[str]] = {
    "web": {
        "fastapi", "flask", "django", "starlette", "tornado", "aiohttp", "bottle", "falcon",
        "sanic",
    },
    "database": {
        "sqlalchemy", "psycopg2", "asyncpg", "aiomysql", "pymongo", "motor", "redis",
        "tortoise", "peewee", "alembic", "prisma",
    },
    "testing": {
        "pytest", "mock", "pytest_mock", "hypothesis", "nose", "tox", "coverage",
    },
    "data_ml": {
        "pandas", "numpy", "scipy", "sklearn", "torch", "tensorflow", "keras", "polars",
        "pyarrow", "matplotlib", "seaborn", "xgboost", "lightgbm",
    },
    "cli_system": {
        "click", "typer", "rich", "prompt_toolkit", "colorama", "paramiko", "fabric", "fire",
    },
    "api_network": {
        "requests", "httpx", "aiohttp", "urllib3",
    },
    "serialization": {
        "pydantic", "marshmallow", "attrs", "jsonschema", "msgpack", "protobuf",
    },
}


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _canonical(name: str) -> str:
    return name.strip().lower().replace("-", "_").replace(".", "_")


def _is_test_path(rel_path: str) -> bool:
    norm = rel_path.replace("\\", "/")
    parts = norm.split("/")
    if any(p.lower() in _TEST_DIR_PARTS for p in parts):
        return True
    base = os.path.basename(norm).lower()
    return base.startswith(("test-", "test_")) or base.endswith(("-dev.txt", "_dev.txt"))


def _declared_dependencies(reader: RepoReader) -> set[str]:
    declared: set[str] = set()
    all_files = reader.iter_files("any")

    for rel in all_files:
        if _is_test_path(rel):
            continue
        base = os.path.basename(rel)
        if base.startswith("requirements") and base.endswith(".txt"):
            text = reader.read_text(rel)
            if not text:
                continue
            for line in text.splitlines():
                line = line.split("#", 1)[0].strip()
                if not line or line.startswith("-"):
                    continue
                m = _REQ_LINE.match(line)
                if m:
                    declared.add(_canonical(m.group(1)))

    for rel in all_files:
        if _is_test_path(rel) or os.path.basename(rel) != "pyproject.toml":
            continue
        pyproject = reader.read_text(rel)
        if not pyproject:
            continue
        try:
            data = tomllib.loads(pyproject)
        except tomllib.TOMLDecodeError:
            data = {}

        deps = data.get("project", {}).get("dependencies", [])
        for dep in deps:
            m = _REQ_LINE.match(dep)
            if m and m.group(1).lower() != "python":
                declared.add(_canonical(m.group(1)))

        poetry_deps = data.get("tool", {}).get("poetry", {}).get("dependencies", {})
        if isinstance(poetry_deps, dict):
            for raw_pkg, spec in poetry_deps.items():
                if str(raw_pkg).lower() == "python":
                    continue
                if isinstance(spec, dict) and spec.get("optional") is True:
                    continue
                declared.add(_canonical(str(raw_pkg)))

    return declared


def _is_import_only_module(tree: ast.Module) -> bool:
    """True if the file's top-level body is nothing but import statements (and/or a bare
    module docstring) -- the shape of a dummy file created only to game import-presence usage
    detection. A file with any other statement -- even one that never names the import -- is
    real code and keeps its imports; only an imports-and-nothing-else file is excluded."""
    for node in tree.body:
        if isinstance(node, ast.Import | ast.ImportFrom):
            continue
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            continue
        return False
    return True


def _imported_modules(reader: RepoReader) -> dict[str, int]:
    imported: dict[str, int] = {}
    for rel in reader.iter_files("source", suffixes={".py"}):
        text = reader.read_text(rel)
        if not text:
            continue
        tree, _reason = safe_parse_python(text, rel)
        if tree is None or _is_import_only_module(tree):  # type: ignore[arg-type]
            continue
        names: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    names.add(_canonical(alias.name.split(".")[0]))
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.add(_canonical(node.module.split(".")[0]))
        for name in names:
            imported[name] = imported.get(name, 0) + 1
    return imported


def _stub_count(reader: RepoReader) -> int:
    count = 0
    for rel in reader.iter_files("source", suffixes={".py"}):
        text = reader.read_text(rel)
        if not text:
            continue
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                body = [n for n in node.body if not isinstance(n, ast.Expr) or not isinstance(
                    getattr(n, "value", None), ast.Constant
                )]
                if len(body) == 1 and isinstance(body[0], ast.Pass):
                    count += 1
                elif len(body) == 1 and isinstance(body[0], ast.Raise):
                    exc = body[0].exc
                    if isinstance(exc, ast.Call) and isinstance(exc.func, ast.Name):
                        if exc.func.id == "NotImplementedError":
                            count += 1
    return count


def _is_package_used(pkg_name: str, imported_modules: dict[str, int]) -> bool:
    """True if `pkg_name` (or a known import-name alias of it, in either direction) appears
    among the modules actually imported."""
    if pkg_name in imported_modules:
        return True
    for alias in _PACKAGE_TO_MODULE_ALIASES.get(pkg_name, ()):
        if _canonical(alias) in imported_modules:
            return True
    for dist_pkg, aliases in _PACKAGE_TO_MODULE_ALIASES.items():
        if pkg_name in {_canonical(a) for a in aliases} and dist_pkg in imported_modules:
            return True
    return False


def _classify_domains(used: list[str]) -> dict[str, list[str]]:
    by_domain: dict[str, list[str]] = {}
    for domain, modules in _TECH_DOMAINS.items():
        hits = sorted(u for u in used if u in modules)
        if hits:
            by_domain[domain] = hits
    return by_domain


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="skills-depth", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    declared = _declared_dependencies(reader)
    imported = _imported_modules(reader)
    used = sorted(d for d in declared if _is_package_used(d, imported))
    unused = sorted(d for d in declared if not _is_package_used(d, imported))

    ref = "repo:fact.skills.summary"
    content = (
        f"declared_count={len(declared)}; used_count={len(used)}; "
        f"used={used}; unused={unused}"
    )
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact", content=_sanitize(pack, ref, content),
            untrusted=True, sanitized=True,
        )
    )

    domains = _classify_domains(used)
    domain_ref = "repo:fact.skills.domain_breadth"
    domain_content = (
        f"domain_count={len(domains)}; domains={sorted(domains)}"
    )
    pack.items.append(
        EvidenceItem(
            ref=domain_ref, source="artifact", content=domain_content,
            untrusted=False, sanitized=False,
        )
    )
    for domain, modules in sorted(domains.items()):
        ref = f"repo:ev.skill_domain.{domain}"
        content = f"domain={domain}; modules={modules}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )

    stubs = _stub_count(reader)
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.stub_count", source="artifact", content=str(stubs),
            untrusted=False, sanitized=False,
        )
    )

    pack.coverage.append(EvidenceCoverage(channel="artifact", status="available"))
    pack.truncations.extend(reader.truncations)
    if not declared:
        pack.missing_required.append("declared_dependencies")
    return pack
