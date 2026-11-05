"""Import / dependency graph of the repository's Python modules.

Ported from ProjAgentScan's src/checks/maps/import_graph.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).
Feeds the full-depth architecture checks (cycles, coupling) and comprehension's entry-point work.

Static analysis: files are parsed with ``ast``, never imported or run. Module ids are path-based
dotted names: ``src/pkg/mod.py`` -> ``src.pkg.mod``, ``src/pkg/__init__.py`` -> ``src.pkg``. An
absolute import is matched to a module by exact id, or by unique dotted suffix (so
``import pkg.mod`` finds ``src.pkg.mod`` in a ``src/`` layout). A suffix matching several modules
is ambiguous: counted in ``stats.unresolved_imports``, never guessed.
"""

from __future__ import annotations

import ast
import sys
from collections.abc import Iterator
from pathlib import PurePosixPath
from typing import TypedDict

_FUNC_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)
_STDLIB = frozenset(getattr(sys, "stdlib_module_names", ()))
_SCOPE_ORDER = {"module": 0, "function": 1, "type_checking": 2}


class ModuleInfo(TypedDict):
    id: str
    file: str
    is_package: bool


Edge = TypedDict("Edge", {"from": str, "to": str, "line": int, "scope": str})


class ExternalPackage(TypedDict):
    name: str
    importing_modules: int


class ImportGraphStats(TypedDict):
    module_count: int
    internal_edge_count: int
    external_package_count: int
    unresolved_imports: int


class ImportGraph(TypedDict):
    modules: list[ModuleInfo]
    edges: list[Edge]
    external_packages: list[ExternalPackage]
    stdlib_packages: list[str]
    stats: ImportGraphStats


def module_id_for(path: str) -> tuple[str, bool]:
    """Return (dotted id, is_package) for a repo-relative ``.py`` path."""
    parts = list(PurePosixPath(path).with_suffix("").parts)
    if parts and parts[-1] == "__init__":
        return ".".join(parts[:-1]) or "__init__", True
    return ".".join(parts), False


def _is_type_checking(test: ast.expr) -> bool:
    if isinstance(test, ast.Name):
        return test.id == "TYPE_CHECKING"
    return isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING"


def iter_imports(tree: ast.AST) -> Iterator[tuple[ast.Import | ast.ImportFrom, str]]:
    """Yield (node, scope) for every import statement, tracking where it appears."""

    def walk(node: ast.AST, scope: str) -> Iterator[tuple[ast.Import | ast.ImportFrom, str]]:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.Import | ast.ImportFrom):
                yield child, scope
                continue
            child_scope = scope
            if isinstance(child, _FUNC_TYPES) and scope == "module":
                child_scope = "function"
            elif isinstance(child, ast.If) and _is_type_checking(child.test):
                for stmt in child.body:
                    if isinstance(stmt, ast.Import | ast.ImportFrom):
                        yield stmt, "type_checking"
                    else:
                        yield from walk(stmt, "type_checking" if scope == "module" else scope)
                for stmt in child.orelse:
                    if isinstance(stmt, ast.Import | ast.ImportFrom):
                        yield stmt, scope
                    else:
                        yield from walk(stmt, scope)
                continue
            yield from walk(child, child_scope)

    yield from walk(tree, "module")


class _Resolver:
    def __init__(self, module_ids: set[str]) -> None:
        self.ids = module_ids
        self._suffix_cache: dict[str, tuple[str | None, str]] = {}

    def absolute(self, name: str) -> tuple[str | None, str]:
        """-> (module id | None, "ok" | "ambiguous" | "none")."""
        if name in self.ids:
            return name, "ok"
        if name not in self._suffix_cache:
            matches = sorted(i for i in self.ids if i.endswith("." + name))
            if len(matches) == 1:
                self._suffix_cache[name] = (matches[0], "ok")
            elif matches:
                self._suffix_cache[name] = (None, "ambiguous")
            else:
                self._suffix_cache[name] = (None, "none")
        return self._suffix_cache[name]

    def exact(self, name: str) -> str | None:
        return name if name in self.ids else None


def _relative_base(module_id: str, is_package: bool, level: int) -> list[str] | None:
    pkg = module_id.split(".") if is_package else module_id.split(".")[:-1]
    drop = level - 1
    if drop > len(pkg):
        return None
    return pkg[: len(pkg) - drop] if drop else pkg


def analyze(modules: dict[str, tuple[str, bool, ast.AST]]) -> ImportGraph:
    """modules: {module id: (file, is_package, tree)} -> graph data."""
    resolver = _Resolver(set(modules))
    edges: dict[tuple[str, str, str], int] = {}
    external: dict[str, set[str]] = {}
    stdlib: set[str] = set()
    unresolved = 0

    def add_edge(src: str, dst: str, line: int, scope: str) -> None:
        if src == dst:
            return
        key = (src, dst, scope)
        edges[key] = min(line, edges.get(key, line))

    def classify_unresolved(src: str, name: str) -> None:
        top = name.split(".")[0]
        if top in _STDLIB:
            stdlib.add(top)
        else:
            external.setdefault(top, set()).add(src)

    for mid in sorted(modules):
        _file, is_pkg, tree = modules[mid]
        for node, scope in iter_imports(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    parts = alias.name.split(".")
                    hit = None
                    state = "none"
                    for n in range(len(parts), 0, -1):
                        hit, state = resolver.absolute(".".join(parts[:n]))
                        if hit or state == "ambiguous":
                            break
                    if hit:
                        add_edge(mid, hit, node.lineno, scope)
                    elif state == "ambiguous":
                        unresolved += 1
                    else:
                        classify_unresolved(mid, alias.name)
                continue

            if node.level:
                base = _relative_base(mid, is_pkg, node.level)
                if base is None:
                    unresolved += 1
                    continue
                prefix = ".".join(base + (node.module.split(".") if node.module else []))
                for alias in node.names:
                    sub = resolver.exact(f"{prefix}.{alias.name}" if prefix else alias.name)
                    target = sub or resolver.exact(prefix)
                    if target:
                        add_edge(mid, target, node.lineno, scope)
                    else:
                        unresolved += 1
                continue

            name = node.module or ""
            base_hit, base_state = resolver.absolute(name)
            if base_hit is None and base_state == "none":
                classify_unresolved(mid, name)
                continue
            for alias in node.names:
                sub_hit, _ = resolver.absolute(f"{name}.{alias.name}")
                target = sub_hit or base_hit
                if target:
                    add_edge(mid, target, node.lineno, scope)
                else:
                    unresolved += 1

    edge_list: list[Edge] = [
        {"from": s, "to": d, "line": line, "scope": sc}
        for (s, d, sc), line in sorted(
            edges.items(), key=lambda kv: (kv[0][0], kv[0][1], _SCOPE_ORDER[kv[0][2]])
        )
    ]
    return {
        "modules": [
            {"id": m, "file": modules[m][0], "is_package": modules[m][1]} for m in sorted(modules)
        ],
        "edges": edge_list,
        "external_packages": [
            {"name": n, "importing_modules": len(mods)} for n, mods in sorted(external.items())
        ],
        "stdlib_packages": sorted(stdlib),
        "stats": {
            "module_count": len(modules),
            "internal_edge_count": len(edge_list),
            "external_package_count": len(external),
            "unresolved_imports": unresolved,
        },
    }


def build_import_graph(modules: dict[str, tuple[str, bool, ast.AST]]) -> ImportGraph | None:
    """Entry point for evidence builders: None if there are no Python modules to analyze."""
    if not modules:
        return None
    return analyze(modules)
