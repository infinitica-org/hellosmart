"""Cognitive complexity per function (SonarSource-style), Python only.

Ported from ProjAgentScan's src/checks/quality/cognitive_complexity.py, scoring logic
unchanged (see that file's history for the rule-by-rule rationale); only the
`@register_check`/`CheckContext` fact-store wrapper was dropped (see package docstring).

Static analysis: the candidate's files are parsed with ``ast``, never imported or run.

Scoring rules (per function; nested functions and lambdas count toward the enclosing function):
  +1 plus the current nesting depth for: if, for, while, except handler, match, ternary
  +1 (no nesting penalty) for: elif, else, a for/while ``else`` clause, each sequence of
     like boolean operators (``a and b and c`` is one; ``a and b or c`` is two), and each
     direct recursive call
"""

from __future__ import annotations

import ast
import math

_FUNC_TYPES = (ast.FunctionDef, ast.AsyncFunctionDef)
_TRY_TYPES = tuple(t for t in (getattr(ast, "Try", None), getattr(ast, "TryStar", None)) if t)
_LOOP_TYPES = (ast.For, ast.AsyncFor, ast.While)


class _Scorer:
    """Walks one function body and accumulates its cognitive complexity."""

    def __init__(self, name: str) -> None:
        self.name = name.rsplit(".", 1)[-1]
        self.total = 0

    def block(self, nodes: list[ast.stmt], nesting: int) -> None:
        for node in nodes:
            self.visit(node, nesting)

    def visit(self, node: ast.AST, nesting: int) -> None:
        if isinstance(node, ast.If):
            self._if_chain(node, nesting)
        elif isinstance(node, _LOOP_TYPES):
            self.total += 1 + nesting
            self.visit(node.iter if hasattr(node, "iter") else node.test, nesting)
            self.block(node.body, nesting + 1)
            if node.orelse:
                self.total += 1
                self.block(node.orelse, nesting + 1)
        elif _TRY_TYPES and isinstance(node, _TRY_TYPES):
            self.block(node.body, nesting)
            for handler in node.handlers:
                self.total += 1 + nesting
                if handler.type is not None:
                    self.visit(handler.type, nesting)
                self.block(handler.body, nesting + 1)
            self.block(node.orelse, nesting)
            self.block(node.finalbody, nesting)
        elif isinstance(node, ast.Match):
            self.total += 1 + nesting
            self.visit(node.subject, nesting)
            for case in node.cases:
                if case.guard is not None:
                    self.visit(case.guard, nesting + 1)
                self.block(case.body, nesting + 1)
        elif isinstance(node, ast.IfExp):
            self.total += 1 + nesting
            self.visit(node.test, nesting)
            self.visit(node.body, nesting + 1)
            self.visit(node.orelse, nesting + 1)
        elif isinstance(node, ast.BoolOp):
            self._bool_op(node, None, nesting)
        elif isinstance(node, _FUNC_TYPES):
            self.block(node.body, nesting + 1)
        elif isinstance(node, ast.Lambda):
            self.visit(node.body, nesting + 1)
        elif isinstance(node, ast.Call):
            if self._is_recursive(node):
                self.total += 1
            self._children(node, nesting)
        else:
            self._children(node, nesting)

    def _children(self, node: ast.AST, nesting: int) -> None:
        for child in ast.iter_child_nodes(node):
            self.visit(child, nesting)

    def _if_chain(self, node: ast.If, nesting: int) -> None:
        self.total += 1 + nesting
        self.visit(node.test, nesting)
        self.block(node.body, nesting + 1)
        orelse: list[ast.stmt] = node.orelse
        while orelse:
            if len(orelse) == 1 and isinstance(orelse[0], ast.If):
                elif_node = orelse[0]
                self.total += 1
                self.visit(elif_node.test, nesting)
                self.block(elif_node.body, nesting + 1)
                orelse = elif_node.orelse
            else:
                self.total += 1
                self.block(orelse, nesting + 1)
                break

    def _bool_op(self, node: ast.BoolOp, parent_op: type | None, nesting: int) -> None:
        if type(node.op) is not parent_op:
            self.total += 1
        for value in node.values:
            if isinstance(value, ast.BoolOp):
                self._bool_op(value, type(node.op), nesting)
            else:
                self.visit(value, nesting)

    def _is_recursive(self, call: ast.Call) -> bool:
        func = call.func
        if isinstance(func, ast.Name):
            return func.id == self.name
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
            return func.value.id in ("self", "cls") and func.attr == self.name
        return False


def _collect_functions(nodes: list[ast.stmt], prefix: str = "") -> list[tuple[str, ast.AST]]:
    """Top-level functions and methods (not functions nested inside functions)."""
    found: list[tuple[str, ast.AST]] = []
    for node in nodes:
        if isinstance(node, _FUNC_TYPES):
            found.append((prefix + node.name, node))
        elif isinstance(node, ast.ClassDef):
            found.extend(_collect_functions(node.body, f"{prefix}{node.name}."))
        else:
            for field in ("body", "orelse", "finalbody"):
                children = getattr(node, field, None)
                if isinstance(children, list) and children and isinstance(children[0], ast.stmt):
                    found.extend(_collect_functions(children, prefix))
            for handler in getattr(node, "handlers", []) or []:
                found.extend(_collect_functions(handler.body, prefix))
    return found


def score_tree(tree: ast.AST) -> list[dict[str, object]]:
    """Score every top-level function/method of a parsed module. May raise RecursionError."""
    results: list[dict[str, object]] = []
    for name, node in _collect_functions(tree.body):  # type: ignore[attr-defined]
        scorer = _Scorer(name)
        scorer.block(node.body, 0)  # type: ignore[attr-defined]
        results.append({"name": name, "line": node.lineno, "cognitive": scorer.total})  # type: ignore[attr-defined]
    results.sort(key=lambda f: (f["line"], f["name"]))
    return results


def percentile(sorted_values: list[int], pct: float) -> int:
    rank = max(1, math.ceil(pct / 100 * len(sorted_values)))
    return sorted_values[rank - 1]
