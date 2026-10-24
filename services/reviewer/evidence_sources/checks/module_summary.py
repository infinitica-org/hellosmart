"""Per-module structural summary: classes, functions, and which other repo modules it imports.

Simplified from ProjAgentScan's src/agents/architecture_design's import-graph/code-map facts
(cycle/coupling detection not carried over -- a follow-up, not this ticket's scope). Gives
architecture-design and comprehension a shared, deterministic "what does this module contain and
depend on" fact.
"""

from __future__ import annotations

import ast
from pathlib import PurePosixPath


def _module_id(rel: str) -> str:
    return rel[: -len(".py")].replace("/", ".") if rel.endswith(".py") else rel


def summarize_module(rel: str, tree: ast.AST) -> dict[str, object]:
    classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
    func_types = (ast.FunctionDef, ast.AsyncFunctionDef)
    top_level_funcs = [
        n.name for n in tree.body if isinstance(n, func_types)  # type: ignore[attr-defined]
    ]

    local_imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.level and node.level > 0:
            if node.module:
                local_imports.add(node.module.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            local_imports.add(node.module.split(".")[0])
        elif isinstance(node, ast.Import):
            for alias in node.names:
                local_imports.add(alias.name.split(".")[0])

    return {
        "module": _module_id(rel),
        "file": rel,
        "classes": sorted(classes),
        "functions": sorted(top_level_funcs),
        "lines": len(ast.dump(tree)) and _line_count(tree),
        "imports": sorted(local_imports),
    }


def _line_count(tree: ast.AST) -> int:
    lines = [getattr(n, "lineno", 0) for n in ast.walk(tree) if hasattr(n, "lineno")]
    return max(lines) if lines else 0


def same_project_imports(all_module_ids: set[str], imports: list[str]) -> list[str]:
    """Of a module's top-level import names, which ones match another module/package in this
    repo (as opposed to a third-party library) -- a crude but deterministic proxy for "imports a
    sibling module" used by architecture-design's dependency-structure signal."""
    tops = {PurePosixPath(m).parts[0] for m in all_module_ids}
    return sorted(i for i in imports if i in tops)
