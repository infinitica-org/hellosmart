"""Evidence builder for the comprehension agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/comprehension/evidence.py: module summaries, the
HTTP/CLI surface (api_surface.py), package layout and entry points (project_structure.py), the
import graph (shared with architecture-design, for README technology-claim verification), and
README claims verified against that code (readme_claims.py) -- the facts this agent's own rubric
cites ("does the README match the code"), not the narrower module-summary-only first pass this
builder started as.
"""

from __future__ import annotations

import ast

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.api_surface import Route, analyze_api_surface
from .checks.import_graph import build_import_graph, module_id_for
from .checks.module_summary import summarize_module
from .checks.project_structure import analyze_project_structure
from .checks.readme_claims import analyze_readme_claims
from .repo_io import RepoReader, safe_id, safe_parse_python

MAX_MODULES = 25
MAX_ROUTES = 25
MAX_ENTRY_POINTS = 10
MAX_HANDLERS = 6
MAX_HANDLER_LINES = 40
README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_modules(pack: EvidencePack, parsed: dict[str, ast.AST]) -> int:
    summaries = [summarize_module(rel, tree) for rel, tree in parsed.items()]
    summaries.sort(key=lambda s: str(s["file"]))
    added = 0
    for s in summaries[:MAX_MODULES]:
        safe_rel, _ = safe_id(str(s["file"]))
        ref = f"repo:ev.module.{safe_rel}"
        body = f"file={s['file']}; classes={s['classes']}; functions={s['functions']}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, body),
                untrusted=True, sanitized=True,
            )
        )
        added += 1
    return added


def _add_api_surface(pack: EvidencePack, parsed: dict[str, ast.AST]) -> list[Route]:
    result = analyze_api_surface(parsed)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(channel="artifact", status="not_applicable", reason="no Python files")
        )
        return []
    agg = result["aggregate"]
    ref = "repo:fact.api_surface.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )
    for route in result["routes"][:MAX_ROUTES]:
        safe_rel, _ = safe_id(f"{route['file']}_{route['line']}")
        ref = f"repo:ev.route.{safe_rel}"
        content = (
            f"method={route['method']}; path={route['path']}; file={route['file']}; "
            f"handler={route['handler']}; framework={route['framework']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )
    return list(result["routes"])


def _add_handler_excerpts(
    pack: EvidencePack, routes: list[Route], file_texts: dict[str, str]
) -> int:
    """Up to MAX_HANDLERS route-handler source excerpts -- not just that a route exists, but
    what its handler actually does, one excerpt per (file, handler_line) even if the handler
    carries several route decorators."""
    seen: set[tuple[str, int | None]] = set()
    unique: list[Route] = []
    for route in sorted(
        (r for r in routes if r["handler_line"]), key=lambda r: (r["file"], r["line"])
    ):
        key = (route["file"], route["handler_line"])
        if key not in seen:
            seen.add(key)
            unique.append(route)

    added = 0
    for route in unique[:MAX_HANDLERS]:
        text = file_texts.get(route["file"])
        start, end = route["handler_line"], route["handler_end_line"]
        if text is None or start is None or end is None:
            continue
        lines = text.splitlines()
        body = lines[start - 1 : end]
        if len(body) > MAX_HANDLER_LINES:
            pack.truncations.append(
                f"handler {route['handler']}: {MAX_HANDLER_LINES} of {len(body)} lines shown"
            )
            body = body[:MAX_HANDLER_LINES]
        safe_rel, _ = safe_id(f"{route['file']}_{route['handler']}")
        ref = f"repo:ev.handler.{safe_rel}"
        content = f"file={route['file']}; lines {start}-{end}\n" + "\n".join(body)
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )
        added += 1
    return added


def _add_project_structure(pack: EvidencePack, parsed: dict[str, ast.AST]) -> None:
    result = analyze_project_structure(parsed)
    if result is None:
        return
    agg = result["aggregate"]
    ref = "repo:fact.project_structure.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )
    for ep in result["entry_points"][:MAX_ENTRY_POINTS]:
        safe_rel, _ = safe_id(f"{ep['file']}_{ep['kind']}_{ep['line']}")
        ref = f"repo:ev.entry_point.{safe_rel}"
        content = f"file={ep['file']}; kind={ep['kind']}; detail={ep['detail']}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_readme(pack: EvidencePack, reader: RepoReader) -> str | None:
    name = next((n for n in README_CANDIDATES if reader.exists(n)), None)
    text = reader.read_text(name, max_bytes=README_MAX_CHARS, truncate=True) if name else None
    if not text or not text.strip():
        pack.coverage.append(
            EvidenceCoverage(channel="artifact", status="unavailable", reason="no README found")
        )
        return None
    ref = "repo:ev.readme"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact", content=_sanitize(pack, ref, text),
            untrusted=True, sanitized=True,
        )
    )
    return text


def _add_readme_claims(
    pack: EvidencePack, readme_name: str, readme_text: str,
    routes: list[Route], imported_external_packages: set[str], files: set[str],
) -> None:
    result = analyze_readme_claims(
        readme_name, readme_text, routes, imported_external_packages, files
    )
    if result is None:
        return
    agg = result["aggregate"]
    ref = "repo:fact.readme_claims.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(
                f"{k}={v}" for k, v in agg.items() if k != "by_kind"
            ),
            untrusted=False, sanitized=False,
        )
    )
    for claim in result["claims"]:
        if claim["status"] == "not_found":
            safe_claim, _ = safe_id(f"{claim['kind']}_{claim['line']}_{claim['text']}")
            ref = f"repo:ev.readme_claim_unsupported.{safe_claim}"
            content = (
                f"kind={claim['kind']}; text={claim['text']}; line={claim['line']}; "
                f"evidence={claim['evidence']}"
            )
            pack.items.append(
                EvidenceItem(
                    ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                    untrusted=True, sanitized=True,
                )
            )


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="comprehension", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)
    py_files = reader.iter_files("source", suffixes={".py"})

    parsed_by_rel: dict[str, ast.AST] = {}
    parsed_by_id: dict[str, tuple[str, bool, ast.AST]] = {}
    file_texts: dict[str, str] = {}
    for rel in py_files:
        text = reader.read_text(rel)
        if text is None:
            continue
        file_texts[rel] = text
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        parsed_by_rel[rel] = tree
        mid, is_pkg = module_id_for(rel)
        if mid not in parsed_by_id:
            parsed_by_id[mid] = (rel, is_pkg, tree)

    added = _add_modules(pack, parsed_by_rel)
    routes = _add_api_surface(pack, parsed_by_rel)
    _add_handler_excerpts(pack, routes, file_texts)
    _add_project_structure(pack, parsed_by_rel)

    graph = build_import_graph(parsed_by_id)
    imported_packages = {p["name"] for p in graph["external_packages"]} if graph else set()

    readme_name = next((n for n in README_CANDIDATES if reader.exists(n)), None)
    readme_text = _add_readme(pack, reader)
    if readme_text is not None and readme_name is not None:
        _add_readme_claims(
            pack, readme_name, readme_text, routes, imported_packages, set(py_files)
        )

    pack.truncations.extend(reader.truncations)
    if added == 0:
        pack.missing_required.append("code_map")
    return pack
