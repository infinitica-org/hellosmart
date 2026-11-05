"""Circular dependencies between repository modules, from the import_graph fact.

Ported from ProjAgentScan's src/checks/architecture/dependency_cycles.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

Cycles are strongly connected components (size >= 2) of the module import graph. Type-only
imports (``if TYPE_CHECKING``) are never edges here: not a runtime dependency. Function-level
imports are often a deliberate way to break a cycle, so they are separated:

  cycles           cycles among module-level imports (these fail or complicate import time)
  deferred_cycles  extra cycles that exist only when function-level imports are counted
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import TypedDict

from .import_graph import Edge, ImportGraph


class CycleEdge(TypedDict):
    from_: str
    to: str
    line: int


class Cycle(TypedDict):
    modules: list[str]
    size: int
    edges: list[CycleEdge]


class DependencyCyclesAggregate(TypedDict):
    cycle_count: int
    deferred_cycle_count: int
    modules_in_cycles: int
    largest_cycle_size: int
    module_count: int


class DependencyCyclesResult(TypedDict):
    cycles: list[Cycle]
    deferred_cycles: list[Cycle]
    aggregate: DependencyCyclesAggregate


def strongly_connected_components(nodes: list[str], adj: dict[str, set[str]]) -> list[list[str]]:
    """Iterative Tarjan. Returns components of size >= 2 (no recursion, safe on deep graphs)."""
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    on_stack: set[str] = set()
    stack: list[str] = []
    result: list[list[str]] = []
    counter = 0

    for root in nodes:
        if root in index:
            continue
        work: list[tuple[str, Iterator[str]]] = [(root, iter(sorted(adj.get(root, ()))))]
        index[root] = low[root] = counter
        counter += 1
        stack.append(root)
        on_stack.add(root)
        while work:
            node, children = work[-1]
            advanced = False
            for child in children:
                if child not in index:
                    index[child] = low[child] = counter
                    counter += 1
                    stack.append(child)
                    on_stack.add(child)
                    work.append((child, iter(sorted(adj.get(child, ())))))
                    advanced = True
                    break
                if child in on_stack:
                    low[node] = min(low[node], index[child])
            if advanced:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index[node]:
                component = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    component.append(member)
                    if member == node:
                        break
                if len(component) > 1:
                    result.append(sorted(component))
    return sorted(result)


def _adjacency(edges: list[Edge], scopes: set[str]) -> dict[str, set[str]]:
    adj: dict[str, set[str]] = {}
    for e in edges:
        if e["scope"] in scopes:
            adj.setdefault(e["from"], set()).add(e["to"])
    return adj


def _describe(component: list[str], edges: list[Edge], scopes: set[str]) -> Cycle:
    members = set(component)
    inside: list[CycleEdge] = sorted(
        (
            {"from_": e["from"], "to": e["to"], "line": e["line"]}
            for e in edges
            if e["scope"] in scopes and e["from"] in members and e["to"] in members
        ),
        key=lambda e: (e["from_"], e["to"], e["line"]),
    )
    return {"modules": component, "size": len(component), "edges": inside}


def find_dependency_cycles(graph: ImportGraph) -> DependencyCyclesResult:
    nodes = sorted(m["id"] for m in graph["modules"])
    edges = graph["edges"]
    runtime = _adjacency(edges, {"module"})
    with_deferred = _adjacency(edges, {"module", "function"})

    runtime_sccs = strongly_connected_components(nodes, runtime)
    runtime_members = {m for c in runtime_sccs for m in c}
    deferred_sccs = [
        c for c in strongly_connected_components(nodes, with_deferred)
        if not set(c) <= runtime_members
    ]

    cycles = [_describe(c, edges, {"module"}) for c in runtime_sccs]
    deferred = [_describe(c, edges, {"module", "function"}) for c in deferred_sccs]
    return {
        "cycles": cycles,
        "deferred_cycles": deferred,
        "aggregate": {
            "cycle_count": len(cycles),
            "deferred_cycle_count": len(deferred),
            "modules_in_cycles": len(runtime_members),
            "largest_cycle_size": max((c["size"] for c in cycles), default=0),
            "module_count": len(nodes),
        },
    }
