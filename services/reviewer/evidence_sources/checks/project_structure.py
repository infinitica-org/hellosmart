"""Package layout and entry points of the repository's Python code.

Ported from ProjAgentScan's src/checks/maps/project_structure.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

``pyproject.toml`` is parsed with ``tomllib`` (data only); no build backend or script is invoked.
``app_objects`` names a call, it does not prove the object is a served application entry point.
Entry points that only exist in ``setup.py``, ``setup.cfg``, Docker or CI files are not detected.
"""

from __future__ import annotations

import ast
import tomllib
from pathlib import PurePosixPath
from typing import TypedDict

MAX_ENTRY_POINTS = 100
_FRAMEWORK_CALLS = frozenset(
    {"FastAPI", "Flask", "Quart", "Starlette", "Sanic", "Bottle", "Celery", "Typer", "Dash"}
)


class EntryPoint(TypedDict):
    file: str
    line: int | None
    kind: str
    detail: str


class AppObject(TypedDict):
    file: str
    line: int
    variable: str
    framework: str


class PackageEntry(TypedDict):
    path: str
    modules: int
    is_root: bool


class ProjectStructureAggregate(TypedDict):
    package_count: int
    root_package_count: int
    max_package_depth: int
    module_count: int
    top_level_scripts: int
    has_src_layout: bool


class ProjectStructureResult(TypedDict):
    packages: list[PackageEntry]
    aggregate: ProjectStructureAggregate
    entry_points: list[EntryPoint]
    app_objects: list[AppObject]


def _is_main_guard(node: ast.stmt) -> bool:
    if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
        return False
    t = node.test
    if len(t.ops) != 1 or not isinstance(t.ops[0], ast.Eq):
        return False
    sides = [t.left, t.comparators[0]]
    has_name = any(isinstance(s, ast.Name) and s.id == "__name__" for s in sides)
    has_main = any(isinstance(s, ast.Constant) and s.value == "__main__" for s in sides)
    return has_name and has_main


def _scan_module(tree: ast.Module) -> tuple[list[int], list[dict[str, object]]]:
    guards: list[int] = []
    apps: list[dict[str, object]] = []
    for node in tree.body:
        if _is_main_guard(node):
            guards.append(node.lineno)
        elif isinstance(node, ast.Assign | ast.AnnAssign):
            value = node.value
            if isinstance(value, ast.Call):
                fn = value.func
                name = (
                    fn.id if isinstance(fn, ast.Name)
                    else fn.attr if isinstance(fn, ast.Attribute) else ""
                )
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                var = next((t.id for t in targets if isinstance(t, ast.Name)), None)
                if name in _FRAMEWORK_CALLS and var:
                    apps.append({"line": node.lineno, "variable": var, "framework": name})
    return guards, apps


def _console_scripts(pyproject_text: str | None) -> list[EntryPoint]:
    if pyproject_text is None:
        return []
    try:
        scripts = tomllib.loads(pyproject_text).get("project", {}).get("scripts", {})
    except (ValueError, tomllib.TOMLDecodeError):
        return []
    if not isinstance(scripts, dict):
        return []
    return [
        {
            "file": "pyproject.toml", "line": None, "kind": "console_script",
            "detail": f"{name} = {target}",
        }
        for name, target in sorted(scripts.items())
        if isinstance(target, str)
    ]


def analyze_project_structure(
    file_trees: dict[str, ast.AST], pyproject_text: str | None = None
) -> ProjectStructureResult | None:
    """None when there is nothing to report (no files parsed at all)."""
    if not file_trees:
        return None

    entry_points: list[EntryPoint] = []
    app_objects: list[AppObject] = []
    parsed: list[str] = sorted(file_trees)
    for rel in parsed:
        tree = file_trees[rel]
        if not isinstance(tree, ast.Module):
            continue
        guards, apps = _scan_module(tree)
        for line in guards:
            entry_points.append(
                {
                    "file": rel, "line": line, "kind": "main_guard",
                    "detail": 'if __name__ == "__main__"',
                }
            )
        for app in apps:
            app_objects.append({"file": rel, **app})  # type: ignore[typeddict-item]
        if PurePosixPath(rel).name == "__main__.py":
            entry_points.append(
                {
                    "file": rel, "line": 1, "kind": "dunder_main_module",
                    "detail": "python -m <package>",
                }
            )

    entry_points += _console_scripts(pyproject_text)
    entry_points.sort(key=lambda e: (e["file"], e["line"] or 0, e["kind"]))

    pkg_dirs = {
        str(PurePosixPath(p).parent) for p in parsed if PurePosixPath(p).name == "__init__.py"
    }
    pkg_dirs.discard(".")
    modules_in: dict[str, int] = {}
    for p in parsed:
        parent = str(PurePosixPath(p).parent)
        if parent in pkg_dirs:
            modules_in[parent] = modules_in.get(parent, 0) + 1
    packages: list[PackageEntry] = [
        {
            "path": d, "modules": modules_in.get(d, 0),
            "is_root": str(PurePosixPath(d).parent) not in pkg_dirs,
        }
        for d in sorted(pkg_dirs)
    ]
    roots = [p for p in packages if p["is_root"]]
    return {
        "packages": packages,
        "aggregate": {
            "package_count": len(packages),
            "root_package_count": len(roots),
            "max_package_depth": max(
                (len(PurePosixPath(p["path"]).parts) for p in packages), default=0
            ),
            "module_count": len(parsed),
            "top_level_scripts": sum(1 for p in parsed if len(PurePosixPath(p).parts) == 1),
            "has_src_layout": bool(roots) and all(p["path"].startswith("src/") for p in roots),
        },
        "entry_points": entry_points[:MAX_ENTRY_POINTS],
        "app_objects": app_objects[:MAX_ENTRY_POINTS],
    }
