"""Coupling and modularization metrics, from the import_graph fact.

Ported from ProjAgentScan's src/checks/architecture/coupling.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

Counts internal runtime dependencies only (module-level and function-level imports; type-only
imports under ``if TYPE_CHECKING`` are ignored). A high number is a signal about structure, not
a verdict: a shared ``config`` module is expected to have a high fan_in.
"""

from __future__ import annotations

import math
from typing import TypedDict

from .import_graph import ImportGraph

_RUNTIME_SCOPES = {"module", "function"}
TOP_N = 5


class ModuleCoupling(TypedDict):
    id: str
    fan_in: int
    fan_out: int
    instability: float | None


class CouplingAggregate(TypedDict):
    module_count: int
    edge_count: int
    mean_fan_out: float
    max_fan_out: int
    p95_fan_out: int
    max_fan_in: int
    isolated_modules: int
    cross_package_edge_ratio: float


class HubEntryOut(TypedDict):
    id: str
    fan_out: int


class HubEntryIn(TypedDict):
    id: str
    fan_in: int


class Hubs(TypedDict):
    high_fan_out: list[HubEntryOut]
    high_fan_in: list[HubEntryIn]


class CouplingResult(TypedDict):
    modules: list[ModuleCoupling]
    aggregate: CouplingAggregate
    hubs: Hubs


def _parent(module_id: str) -> str:
    return module_id.rsplit(".", 1)[0] if "." in module_id else ""


def _p95(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[max(1, math.ceil(0.95 * len(ordered))) - 1]


def analyze_coupling(graph: ImportGraph) -> CouplingResult:
    ids = sorted(m["id"] for m in graph["modules"])
    pairs = {(e["from"], e["to"]) for e in graph["edges"] if e["scope"] in _RUNTIME_SCOPES}
    fan_out = dict.fromkeys(ids, 0)
    fan_in = dict.fromkeys(ids, 0)
    for src, dst in pairs:
        fan_out[src] += 1
        fan_in[dst] += 1

    modules: list[ModuleCoupling] = []
    for m in ids:
        total = fan_in[m] + fan_out[m]
        modules.append(
            {
                "id": m,
                "fan_in": fan_in[m],
                "fan_out": fan_out[m],
                "instability": round(fan_out[m] / total, 2) if total else None,
            }
        )

    outs = [fan_out[m] for m in ids]
    cross = sum(1 for s, d in pairs if _parent(s) != _parent(d))
    return {
        "modules": modules,
        "aggregate": {
            "module_count": len(ids),
            "edge_count": len(pairs),
            "mean_fan_out": round(sum(outs) / len(outs), 2),
            "max_fan_out": max(outs),
            "p95_fan_out": _p95(outs),
            "max_fan_in": max(fan_in.values()),
            "isolated_modules": sum(1 for m in modules if m["instability"] is None),
            "cross_package_edge_ratio": round(cross / len(pairs), 2) if pairs else 0,
        },
        "hubs": {
            "high_fan_out": [
                {"id": m, "fan_out": fan_out[m]}
                for m in sorted(ids, key=lambda m: (-fan_out[m], m))[:TOP_N]
                if fan_out[m]
            ],
            "high_fan_in": [
                {"id": m, "fan_in": fan_in[m]}
                for m in sorted(ids, key=lambda m: (-fan_in[m], m))[:TOP_N]
                if fan_in[m]
            ],
        },
    }
