"""Inheritance depth and hierarchy shape, from per-module class facts (code_map.py).

Ported from ProjAgentScan's src/checks/architecture/inheritance_depth.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

Only inheritance between classes defined in the repository counts. A base class is resolved by
its simple name: if exactly one repo class has that name it is the parent; if several do, a
class in the same file wins; otherwise the base is ambiguous and is counted, never guessed.
Bases from outside the repository (``ABC``, ``Exception``, framework classes) are not followed.
"""

from __future__ import annotations

from collections import defaultdict
from typing import TypedDict

from .code_map import ClassEntry, ModuleClasses

TOP_N = 5


class DeepestEntry(TypedDict):
    class_: str
    file: str
    line: int
    depth: int
    chain: list[str]


class WidestEntry(TypedDict):
    class_: str
    file: str
    line: int
    direct_subclasses: int


class InheritanceAggregate(TypedDict):
    class_count: int
    classes_with_repo_parent: int
    max_depth: int
    mean_depth: float
    multiple_inheritance_classes: int
    ambiguous_bases: int
    external_base_references: int


class InheritanceDepthResult(TypedDict):
    aggregate: InheritanceAggregate
    deepest: list[DeepestEntry]
    widest: list[WidestEntry]


def compute_depths(keys: list[str], parents: dict[str, list[str]]) -> dict[str, int]:
    """Depth of every class = longest chain of repo ancestors (0 = no repo parent).

    Iterative (explicit stack): a chain of thousands of classes must never overflow the
    interpreter's recursion limit. An inheritance cycle (invalid Python, but a hostile repo can
    contain one) is cut at the edge that closes it, so every class still gets a depth.
    """
    memo: dict[str, int] = {}
    for start in keys:
        if start in memo:
            continue
        best: dict[str, int] = {start: 0}
        on_path = {start}
        stack: list[tuple[str, list[str]]] = [(start, list(parents.get(start, ())))]
        iters: list[int] = [0]
        while stack:
            node, plist = stack[-1]
            i = iters[-1]
            descended = False
            while i < len(plist):
                parent = plist[i]
                i += 1
                if parent in memo:
                    best[node] = max(best[node], 1 + memo[parent])
                elif parent in on_path:
                    continue  # cycle: ignore the closing edge
                else:
                    on_path.add(parent)
                    best[parent] = 0
                    iters[-1] = i
                    stack.append((parent, list(parents.get(parent, ()))))
                    iters.append(0)
                    descended = True
                    break
            if descended:
                continue
            stack.pop()
            iters.pop()
            on_path.discard(node)
            memo[node] = best.pop(node)
            if stack:
                above = stack[-1][0]
                best[above] = max(best[above], 1 + memo[node])
    return memo


def _simple(expr: str) -> str:
    """'pkg.mod.Base[T]' -> 'Base'."""
    return expr.split("[", 1)[0].rsplit(".", 1)[-1].strip()


def analyze_inheritance(modules: list[ModuleClasses]) -> InheritanceDepthResult | None:
    classes: list[tuple[str, str, ClassEntry]] = []  # (key, file, entry)
    by_simple: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for module in modules:
        for c in module["classes"]:
            key = f"{module['file']}::{c['name']}"
            classes.append((key, module["file"], c))
            by_simple[c["name"].rsplit(".", 1)[-1]].append((key, module["file"]))
    if not classes:
        return None

    parents: dict[str, list[str]] = {}
    ambiguous = external = 0
    for key, file, c in classes:
        resolved = []
        for base in c["bases"]:
            candidates = by_simple.get(_simple(base), [])
            if len(candidates) == 1 and candidates[0][0] != key:
                resolved.append(candidates[0][0])
            elif len(candidates) > 1:
                same_file = [k for k, f in candidates if f == file and k != key]
                if len(same_file) == 1:
                    resolved.append(same_file[0])
                else:
                    ambiguous += 1
            elif not candidates:
                external += 1
        parents[key] = resolved

    info = {key: (file, c) for key, file, c in classes}
    depths = compute_depths([key for key, _f, _c in classes], parents)

    def chain(key: str) -> list[str]:
        out, seen = [key], {key}
        while True:
            nxt = [p for p in parents.get(out[-1], []) if p not in seen]
            if not nxt:
                return out
            best = max(nxt, key=lambda p: (depths[p], p))
            out.append(best)
            seen.add(best)

    children: dict[str, int] = defaultdict(int)
    for kids in parents.values():
        for p in set(kids):
            children[p] += 1

    def label(key: str) -> str:
        return info[key][1]["name"]

    deepest = sorted((k for k in depths if depths[k] > 0), key=lambda k: (-depths[k], k))[:TOP_N]
    widest = sorted(children, key=lambda k: (-children[k], k))[:TOP_N]
    return {
        "aggregate": {
            "class_count": len(classes),
            "classes_with_repo_parent": sum(1 for k in parents if parents[k]),
            "max_depth": max(depths.values()),
            "mean_depth": round(sum(depths.values()) / len(depths), 2),
            "multiple_inheritance_classes": sum(1 for _k, _f, c in classes if len(c["bases"]) > 1),
            "ambiguous_bases": ambiguous,
            "external_base_references": external,
        },
        "deepest": [
            {
                "class_": label(k), "file": info[k][0], "line": info[k][1]["line"],
                "depth": depths[k], "chain": [label(x) for x in chain(k)],
            }
            for k in deepest
        ],
        "widest": [
            {
                "class_": label(k), "file": info[k][0], "line": info[k][1]["line"],
                "direct_subclasses": children[k],
            }
            for k in widest
        ],
    }
