"""Docstring and type-annotation coverage of public Python functions and classes.

Ported from ProjAgentScan's src/checks/quality/docstring_type_coverage.py (logic unchanged,
fact-store wrapper dropped -- see evidence_sources/checks/__init__.py).

"Public" means the name does not start with an underscore, and for methods the enclosing class
is public too. Functions marked ``@overload`` are skipped. An empty or whitespace-only docstring
does not count as documented. This measures presence only: whether a docstring says anything
useful is judged by the agent, never by this function.
"""

from __future__ import annotations

import ast

MIN_FUNCTIONS_FOR_RANKING = 3
TOP_FILES = 5
_FUNC_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)
COUNT_KEYS = (
    "functions", "documented", "classes", "documented_classes",
    "params", "params_annotated", "returns", "fully", "module_doc",
)


def _ratio(num: int, den: int) -> float | None:
    return round(num / den, 3) if den else None


def _is_overload(node: ast.AST) -> bool:
    for dec in getattr(node, "decorator_list", []):
        name = dec.attr if isinstance(dec, ast.Attribute) else getattr(dec, "id", "")
        if name == "overload":
            return True
    return False


def _has_doc(node: ast.AST) -> bool:
    doc = ast.get_docstring(node)  # type: ignore[arg-type]
    return bool(doc and doc.strip())


def _params(fn: ast.FunctionDef | ast.AsyncFunctionDef, in_class: bool) -> list[ast.arg]:
    a = fn.args
    params = list(a.posonlyargs) + list(a.args) + list(a.kwonlyargs)
    if a.vararg:
        params.append(a.vararg)
    if a.kwarg:
        params.append(a.kwarg)
    if in_class and params and params[0].arg in ("self", "cls"):
        params = params[1:]
    return params


def analyze_tree(tree: ast.AST) -> dict[str, int]:
    """Counts for one parsed module. May raise RecursionError on hostile depth."""
    c: dict[str, int] = dict.fromkeys(COUNT_KEYS, 0)

    def visit(body: list[ast.stmt], in_class: bool) -> None:
        for node in body:
            if isinstance(node, _FUNC_TYPES):
                if node.name.startswith("_") or _is_overload(node):
                    continue
                c["functions"] += 1
                c["documented"] += int(_has_doc(node))
                params = _params(node, in_class)
                annotated = sum(1 for p in params if p.annotation is not None)
                c["params"] += len(params)
                c["params_annotated"] += annotated
                has_return = node.returns is not None
                c["returns"] += int(has_return)
                c["fully"] += int(has_return and annotated == len(params))
            elif isinstance(node, ast.ClassDef):
                if node.name.startswith("_"):
                    continue
                c["classes"] += 1
                c["documented_classes"] += int(_has_doc(node))
                visit(node.body, True)
            else:
                for attr in ("body", "orelse", "finalbody"):
                    inner = getattr(node, attr, None)
                    if isinstance(inner, list) and inner and isinstance(inner[0], ast.stmt):
                        visit(inner, in_class)

    visit(tree.body, False)  # type: ignore[attr-defined]
    c["module_doc"] += int(_has_doc(tree))
    return c
