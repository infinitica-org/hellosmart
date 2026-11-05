"""Evidence builder for the architecture-design agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/architecture_design/evidence.py: per-module
summaries, the real import graph (evidence_sources/checks/import_graph.py), dependency-cycle
detection (dependency_cycles.py, strongly-connected-components), coupling/fan-in-fan-out hubs
(coupling.py), inheritance depth (inheritance_depth.py via code_map.py), and README -- the same
facts the original agent's rubric cites, not the narrower module-summary-only first pass this
builder started as.
"""

from __future__ import annotations

import ast

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.code_map import ModuleClasses, compute_code_map_aggregate, extract_classes
from .checks.coupling import analyze_coupling
from .checks.dependency_cycles import find_dependency_cycles
from .checks.import_graph import ImportGraph, build_import_graph, module_id_for
from .checks.inheritance_depth import analyze_inheritance
from .checks.module_summary import ModuleSummary, same_project_imports, summarize_module
from .repo_io import RepoReader, safe_id, safe_parse_python

MAX_MODULES = 25
MAX_CYCLES = 10
README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_module_summaries(
    pack: EvidencePack, all_module_ids: set[str], summaries: list[ModuleSummary]
) -> int:
    ordered = sorted(summaries, key=lambda s: (-s["lines"], s["file"]))
    added = 0
    for s in ordered[:MAX_MODULES]:
        safe_rel, _ = safe_id(s["file"])
        ref = f"repo:ev.module.{safe_rel}"
        local = same_project_imports(all_module_ids, s["imports"])
        body = (
            f"file={s['file']}; classes={s['classes']}; functions={s['functions']}; "
            f"imports_in_repo={local}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, body),
                untrusted=True, sanitized=True,
            )
        )
        added += 1
    return added


def _add_cycles(pack: EvidencePack, graph: ImportGraph) -> None:
    result = find_dependency_cycles(graph)
    agg = result["aggregate"]
    ref = "repo:fact.dependency_cycles.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )
    for i, cycle in enumerate(result["cycles"][:MAX_CYCLES]):
        ref = f"repo:ev.dependency_cycle.{i}"
        content = f"modules={cycle['modules']}; size={cycle['size']}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_coupling(pack: EvidencePack, graph: ImportGraph) -> None:
    result = analyze_coupling(graph)
    agg = result["aggregate"]
    ref = "repo:fact.coupling.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )
    high_out = result["hubs"]["high_fan_out"]
    if high_out:
        ref = "repo:ev.coupling.high_fan_out"
        content = "; ".join(f"{h['id']}={h['fan_out']}" for h in high_out)
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )
    high_in = result["hubs"]["high_fan_in"]
    if high_in:
        ref = "repo:ev.coupling.high_fan_in"
        content = "; ".join(f"{h['id']}={h['fan_in']}" for h in high_in)
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_code_map_aggregate(pack: EvidencePack, modules: list[ModuleClasses]) -> None:
    agg = compute_code_map_aggregate(modules)
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.code_map.aggregate", source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )


def _add_inheritance(pack: EvidencePack, reader: RepoReader, py_files: list[str]) -> None:
    modules: list[ModuleClasses] = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is None:
            continue
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        modules.append(extract_classes(rel, tree))

    _add_code_map_aggregate(pack, modules)

    result = analyze_inheritance(modules)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(channel="artifact", status="not_applicable", reason="no classes found")
        )
        return

    agg = result["aggregate"]
    ref = "repo:fact.inheritance_depth.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in agg.items()),
            untrusted=False, sanitized=False,
        )
    )
    for entry in result["deepest"][:5]:
        safe_cls, _ = safe_id(entry["class_"])
        ref = f"repo:ev.inheritance.deepest.{safe_cls}"
        content = (
            f"class={entry['class_']}; file={entry['file']}; depth={entry['depth']}; "
            f"chain={entry['chain']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_readme(pack: EvidencePack, reader: RepoReader) -> bool:
    name = next((n for n in README_CANDIDATES if reader.exists(n)), None)
    text = reader.read_text(name, max_bytes=README_MAX_CHARS, truncate=True) if name else None
    if not text or not text.strip():
        pack.coverage.append(
            EvidenceCoverage(channel="artifact", status="unavailable", reason="no README found")
        )
        return False
    ref = "repo:ev.readme"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact", content=_sanitize(pack, ref, text),
            untrusted=True, sanitized=True,
        )
    )
    return True


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="architecture-design", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)
    py_files = reader.iter_files("source", suffixes={".py"})

    # Parse every Python file once; feed both the module-summary and import-graph facts from it.
    parsed: dict[str, tuple[str, bool, ast.AST]] = {}
    summaries: list[ModuleSummary] = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is None:
            continue
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        mid, is_pkg = module_id_for(rel)
        if mid in parsed:
            continue
        parsed[mid] = (rel, is_pkg, tree)
        summaries.append(summarize_module(rel, tree))

    all_module_ids = set(parsed)
    added = _add_module_summaries(pack, all_module_ids, summaries)

    graph = build_import_graph(parsed)
    if graph is not None:
        pack.items.append(
            EvidenceItem(
                ref="repo:fact.import_graph.stats", source="artifact",
                content="; ".join(f"{k}={v}" for k, v in graph["stats"].items()),
                untrusted=False, sanitized=False,
            )
        )
        _add_cycles(pack, graph)
        _add_coupling(pack, graph)

    _add_inheritance(pack, reader, py_files)
    _add_readme(pack, reader)

    pack.truncations.extend(reader.truncations)
    if added == 0:
        pack.missing_required.append("code_map")
    return pack
