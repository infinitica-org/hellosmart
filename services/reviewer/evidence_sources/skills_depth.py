"""Evidence builder for the skills-depth agent (AD-014b).

Narrower first-pass port of ProjAgentScan's src/agents/skills_depth/evidence.py: declared
(requirements.txt/pyproject.toml) vs genuinely-used dependencies, carrying over the one
security-relevant fix from that port's history (docs/memory/pitfalls.md #26): a Python file
whose entire body is import statements and nothing else does not count as "using" what it
imports -- that exact shape is the gaming vector a dummy file importing every declared package
would otherwise exploit. Stub-function detection (pass-only / NotImplementedError bodies) is
also ported; technology-domain breadth classification is a follow-up, not carried over here.
"""

from __future__ import annotations

import ast
import re
import tomllib

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .repo_io import RepoReader, safe_parse_python

_REQ_LINE = re.compile(r"^\s*([A-Za-z0-9_.\-]+)")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _canonical(name: str) -> str:
    return name.strip().lower().replace("-", "_").replace(".", "_")


def _declared_dependencies(reader: RepoReader) -> set[str]:
    declared: set[str] = set()
    req = reader.read_text("requirements.txt")
    if req:
        for line in req.splitlines():
            line = line.split("#", 1)[0].strip()
            m = _REQ_LINE.match(line)
            if m:
                declared.add(_canonical(m.group(1)))

    pyproject = reader.read_text("pyproject.toml")
    if pyproject:
        try:
            data = tomllib.loads(pyproject)
        except tomllib.TOMLDecodeError:
            data = {}
        deps = data.get("project", {}).get("dependencies", [])
        for dep in deps:
            m = _REQ_LINE.match(dep)
            if m:
                declared.add(_canonical(m.group(1)))
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


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="skills-depth", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    declared = _declared_dependencies(reader)
    imported = _imported_modules(reader)
    used = sorted(d for d in declared if d in imported)
    unused = sorted(d for d in declared if d not in imported)

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
