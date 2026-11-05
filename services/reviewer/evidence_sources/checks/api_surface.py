"""HTTP routes and command-line commands declared in the repository's Python code.

Ported from ProjAgentScan's src/checks/maps/api_surface.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

What counts: a decorator call such as ``@app.get("/items")`` or
``@bp.route("/x", methods=["POST"])`` whose first argument is a string literal (a route),
``@click.command()`` / ``@cli.command()`` /
``@click.group()`` (a CLI command), ``subparsers.add_parser("name")`` (an argparse sub-command),
and ``path("x/", view)`` calls in a file named ``urls.py`` (a Django URL). Text in comments and
string literals never counts. The owner of a route decorator is resolved to ``FastAPI(...)``,
``APIRouter(...)``, ``Flask(...)`` or ``Blueprint(...)`` assigned at module level in the same
file; a router defined elsewhere or mounted via ``include_router``/``register_blueprint`` is not
resolved (``prefix_resolved`` false).

Routes registered dynamically or built at runtime are not detected, so an empty list means "none
found by this check", not "none exist".
"""

from __future__ import annotations

import ast
from pathlib import PurePosixPath
from typing import TypedDict

MAX_ROUTES = 500
MAX_CLI = 100
_HTTP = {"get", "post", "put", "patch", "delete", "head", "options"}
_ROUTE_ATTRS = {"route", "api_route"}
_OWNER_CALLS = {
    "FastAPI": "FastAPI", "APIRouter": "APIRouter", "Flask": "Flask", "Blueprint": "Blueprint",
    "Starlette": "Starlette", "Quart": "Quart",
}
_PREFIX_KW = ("prefix", "url_prefix")
_FUNC = (ast.FunctionDef, ast.AsyncFunctionDef)


class Route(TypedDict):
    file: str
    line: int
    method: str
    path: str
    handler: str
    handler_line: int | None
    handler_end_line: int | None
    framework: str | None
    prefix_resolved: bool


class CliCommand(TypedDict):
    file: str
    line: int
    name: str
    kind: str


class ApiSurfaceAggregate(TypedDict):
    route_count: int
    cli_command_count: int
    files_with_routes: int
    methods: dict[str, int]
    frameworks: list[str]
    unresolved_routes: int


class ApiSurfaceResult(TypedDict):
    routes: list[Route]
    cli_commands: list[CliCommand]
    aggregate: ApiSurfaceAggregate


def _str_const(node: ast.AST | None) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _first_string_arg(call: ast.Call) -> str | None:
    if call.args:
        return _str_const(call.args[0])
    for kw in call.keywords:
        if kw.arg in ("path", "rule", "name"):
            return _str_const(kw.value)
    return None


def _methods_kw(call: ast.Call) -> list[str]:
    for kw in call.keywords:
        if kw.arg == "methods" and isinstance(kw.value, ast.List | ast.Tuple | ast.Set):
            return sorted({s.upper() for s in (_str_const(e) for e in kw.value.elts) if s})
    return []


def _owners(tree: ast.Module) -> dict[str, tuple[str, str]]:
    """module-level `name = FastAPI(...)`-style assignments -> {name: (framework, prefix)}."""
    owners: dict[str, tuple[str, str]] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign | ast.AnnAssign) or not isinstance(node.value, ast.Call):
            continue
        fn = node.value.func
        callee = (
            fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else ""
        )
        if callee not in _OWNER_CALLS:
            continue
        prefix = ""
        for kw in node.value.keywords:
            if kw.arg in _PREFIX_KW:
                prefix = _str_const(kw.value) or ""
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        for t in targets:
            if isinstance(t, ast.Name):
                owners[t.id] = (_OWNER_CALLS[callee], prefix)
    return owners


def _join(prefix: str, path: str) -> str:
    if not prefix:
        return path
    return prefix.rstrip("/") + ("/" + path.lstrip("/") if path else "")


def scan_tree(tree: ast.AST, rel: str) -> tuple[list[Route], list[CliCommand]]:
    """(routes, cli_commands) declared in one parsed module."""
    owners = _owners(tree) if isinstance(tree, ast.Module) else {}
    is_urls = PurePosixPath(rel).name == "urls.py"
    routes: list[Route] = []
    cli: list[CliCommand] = []
    for node in ast.walk(tree):
        if isinstance(node, _FUNC):
            end = getattr(node, "end_lineno", None) or node.lineno
            for dec in node.decorator_list:
                is_call = isinstance(dec, ast.Call)
                fn = dec.func if is_call and isinstance(dec, ast.Call) else dec
                attr = (
                    fn.attr if isinstance(fn, ast.Attribute)
                    else fn.id if isinstance(fn, ast.Name) else ""
                )
                owner = (
                    fn.value.id
                    if isinstance(fn, ast.Attribute) and isinstance(fn.value, ast.Name)
                    else None
                )
                if is_call and isinstance(dec, ast.Call) and isinstance(fn, ast.Attribute) and (
                    attr in _HTTP or attr in _ROUTE_ATTRS
                ):
                    path = _first_string_arg(dec)
                    if path is None:
                        continue
                    framework, prefix = owners.get(owner or "", (None, ""))
                    methods = [attr.upper()] if attr in _HTTP else (_methods_kw(dec) or ["ANY"])
                    for method in methods:
                        routes.append(
                            {
                                "file": rel, "line": dec.lineno, "method": method,
                                "path": _join(prefix, path), "handler": node.name,
                                "handler_line": node.lineno, "handler_end_line": end,
                                "framework": framework, "prefix_resolved": owner in owners,
                            }
                        )
                elif attr in ("command", "group"):
                    explicit = (
                        _first_string_arg(dec) if is_call and isinstance(dec, ast.Call) else None
                    )
                    kw_name = next(
                        (
                            _str_const(k.value)
                            for k in (dec.keywords if is_call and isinstance(dec, ast.Call) else [])
                            if k.arg == "name" and _str_const(k.value)
                        ),
                        None,
                    )
                    cmd_name: str = explicit or kw_name or node.name
                    is_click = owner == "click" or isinstance(fn, ast.Name)
                    kind = "click" if is_click else "typer_or_click"
                    cli.append({"file": rel, "line": dec.lineno, "name": cmd_name, "kind": kind})
        elif isinstance(node, ast.Call):
            fn = node.func
            if isinstance(fn, ast.Attribute) and fn.attr == "add_parser":
                parser_name = _first_string_arg(node)
                if parser_name:
                    cli.append(
                        {
                            "file": rel, "line": node.lineno, "name": parser_name,
                            "kind": "argparse_subcommand",
                        }
                    )
            elif is_urls and isinstance(fn, ast.Name) and fn.id in ("path", "re_path"):
                path = _first_string_arg(node)
                if path is not None:
                    view = node.args[1] if len(node.args) > 1 else None
                    handler = (
                        view.id if isinstance(view, ast.Name)
                        else view.attr if isinstance(view, ast.Attribute) else ""
                    )
                    routes.append(
                        {
                            "file": rel, "line": node.lineno, "method": "ANY",
                            "path": "/" + path.lstrip("/"), "handler": handler,
                            "handler_line": None, "handler_end_line": None,
                            "framework": "Django", "prefix_resolved": False,
                        }
                    )
    routes.sort(key=lambda r: (r["line"], r["method"], r["path"]))
    cli.sort(key=lambda c: (c["line"], c["name"]))
    return routes, cli


def analyze_api_surface(file_trees: dict[str, ast.AST]) -> ApiSurfaceResult | None:
    """None when there is nothing to report (no files parsed at all)."""
    if not file_trees:
        return None

    all_routes: list[Route] = []
    all_cli: list[CliCommand] = []
    for rel in sorted(file_trees):
        try:
            found_routes, found_cli = scan_tree(file_trees[rel], rel)
        except RecursionError:
            continue
        all_routes += found_routes
        all_cli += found_cli

    all_routes = sorted(all_routes, key=lambda r: (r["file"], r["line"], r["method"], r["path"]))
    all_routes = all_routes[:MAX_ROUTES]
    all_cli = sorted(all_cli, key=lambda c: (c["file"], c["line"], c["name"]))[:MAX_CLI]
    methods: dict[str, int] = {}
    for r in all_routes:
        methods[r["method"]] = methods.get(r["method"], 0) + 1
    return {
        "routes": all_routes,
        "cli_commands": all_cli,
        "aggregate": {
            "route_count": len(all_routes),
            "cli_command_count": len(all_cli),
            "files_with_routes": len({r["file"] for r in all_routes}),
            "methods": dict(sorted(methods.items())),
            "frameworks": sorted({r["framework"] for r in all_routes if r["framework"]}),
            "unresolved_routes": sum(1 for r in all_routes if not r["prefix_resolved"]),
        },
    }
