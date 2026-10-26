"""Per-class and per-module structural facts: used by inheritance_depth.py (name/line/bases) and
by architecture_design.py's code_map aggregate (method_count/kinds/top-level function count) --
the counts ProjAgentScan's code_map.py reports as `aggregate.class_count` etc.

Narrower port of ProjAgentScan's src/checks/maps/code_map.py: that check also records per-class
metaclass/decorators and full per-method detail (name/line/params/kind); none of that is
consumed by any agent ported so far, so only the kinds/counts the aggregate actually needs are
carried over here. If a future agent needs the fuller code_map shape, extend this rather than
re-porting.
"""

from __future__ import annotations

import ast
from typing import TypedDict

_FUNC = (ast.FunctionDef, ast.AsyncFunctionDef)
_ENUM_BASES = frozenset({"Enum", "IntEnum", "StrEnum", "Flag", "IntFlag"})


class ClassEntry(TypedDict):
    name: str
    line: int
    bases: list[str]
    method_count: int
    longest_method_lines: int
    kinds: list[str]


class FunctionEntry(TypedDict):
    name: str
    lines: int


class ModuleClasses(TypedDict):
    file: str
    classes: list[ClassEntry]
    functions: list[FunctionEntry]


def _unparse(node: ast.expr) -> str:
    try:
        return ast.unparse(node)
    except Exception:  # pragma: no cover - ast.unparse covers all valid expr nodes
        return ""


def _base_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _lines(node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
    return (node.end_lineno or node.lineno) - node.lineno + 1


def _class_kinds(node: ast.ClassDef, base_names: set[str], decorators: set[str]) -> list[str]:
    kinds = []
    if "ABC" in base_names or any(
        _base_name(d) == "abstractmethod"
        for m in node.body if isinstance(m, _FUNC)
        for d in m.decorator_list
    ):
        kinds.append("abstract")
    if "Protocol" in base_names:
        kinds.append("protocol")
    if "dataclass" in decorators:
        kinds.append("dataclass")
    if base_names & _ENUM_BASES:
        kinds.append("enum")
    if any(b.endswith(("Exception", "Error")) for b in base_names):
        kinds.append("exception")
    return kinds


def extract_classes(rel: str, tree: ast.AST) -> ModuleClasses:
    """Top-level and nested classes (with base expressions, method count/kinds) and top-level
    functions in one module."""
    classes: list[ClassEntry] = []
    functions: list[FunctionEntry] = []

    def visit(body: list[ast.stmt], prefix: str, in_class: bool) -> None:
        for node in body:
            if isinstance(node, ast.ClassDef):
                qualname = f"{prefix}{node.name}"
                base_names = {_base_name(b) for b in node.bases}
                decorators = {_base_name(d) for d in node.decorator_list}
                methods = [m for m in node.body if isinstance(m, _FUNC)]
                classes.append(
                    {
                        "name": qualname,
                        "line": node.lineno,
                        "bases": [_unparse(b) for b in node.bases],
                        "method_count": len(methods),
                        "longest_method_lines": max((_lines(m) for m in methods), default=0),
                        "kinds": _class_kinds(node, base_names, decorators),
                    }
                )
                visit(node.body, f"{qualname}.", in_class=True)
            elif isinstance(node, _FUNC):
                if not in_class:
                    functions.append({"name": node.name, "lines": _lines(node)})
                visit(node.body, prefix, in_class)

    visit(tree.body, "", in_class=False)  # type: ignore[attr-defined]
    return {"file": rel, "classes": classes, "functions": functions}


class CodeMapAggregate(TypedDict):
    module_count: int
    class_count: int
    function_count: int
    method_count: int
    abstract_classes: int
    protocols: int
    dataclasses: int
    enums: int
    exceptions: int
    largest_class_methods: int
    longest_function_lines: int


def compute_code_map_aggregate(modules: list[ModuleClasses]) -> CodeMapAggregate:
    class_count = function_count = method_count = 0
    abstract_classes = protocols = dataclasses_ = enums = exceptions = 0
    largest_class_methods = longest_function_lines = 0

    for module in modules:
        for cls in module["classes"]:
            class_count += 1
            method_count += cls["method_count"]
            largest_class_methods = max(largest_class_methods, cls["method_count"])
            longest_function_lines = max(longest_function_lines, cls["longest_method_lines"])
            abstract_classes += "abstract" in cls["kinds"]
            protocols += "protocol" in cls["kinds"]
            dataclasses_ += "dataclass" in cls["kinds"]
            enums += "enum" in cls["kinds"]
            exceptions += "exception" in cls["kinds"]
        function_count += len(module["functions"])
        for fn in module["functions"]:
            longest_function_lines = max(longest_function_lines, fn["lines"])

    return {
        "module_count": len(modules), "class_count": class_count,
        "function_count": function_count, "method_count": method_count,
        "abstract_classes": abstract_classes, "protocols": protocols,
        "dataclasses": dataclasses_, "enums": enums, "exceptions": exceptions,
        "largest_class_methods": largest_class_methods,
        "longest_function_lines": longest_function_lines,
    }
