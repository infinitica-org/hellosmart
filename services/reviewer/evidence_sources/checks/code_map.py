"""Per-class structural facts needed by inheritance_depth.py.

Narrower port of ProjAgentScan's src/checks/maps/code_map.py: that check also records per-class
metaclass/decorators/kinds (abstract/protocol/dataclass/enum/exception) and full per-method
detail; none of that is consumed by any agent ported so far, so only what inheritance_depth.py
actually needs is carried over here -- class name, line, and base-class expressions, grouped by
module. If a future agent needs the fuller code_map shape, extend this rather than re-porting.
"""

from __future__ import annotations

import ast
from typing import TypedDict


class ClassEntry(TypedDict):
    name: str
    line: int
    bases: list[str]


class ModuleClasses(TypedDict):
    file: str
    classes: list[ClassEntry]


def _unparse(node: ast.expr) -> str:
    try:
        return ast.unparse(node)
    except Exception:  # pragma: no cover - ast.unparse covers all valid expr nodes
        return ""


def extract_classes(rel: str, tree: ast.AST) -> ModuleClasses:
    """Top-level and nested classes in one module, with their base-class expressions."""
    classes: list[ClassEntry] = []

    def visit(body: list[ast.stmt], prefix: str) -> None:
        for node in body:
            if isinstance(node, ast.ClassDef):
                qualname = f"{prefix}{node.name}"
                classes.append(
                    {
                        "name": qualname,
                        "line": node.lineno,
                        "bases": [_unparse(b) for b in node.bases],
                    }
                )
                visit(node.body, f"{qualname}.")
            elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
                visit(node.body, prefix)

    visit(tree.body, "")  # type: ignore[attr-defined]
    return {"file": rel, "classes": classes}
