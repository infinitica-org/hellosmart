"""Claims the README makes that can be checked against the code, and whether the code supports
them.

Ported from ProjAgentScan's src/checks/maps/readme_claims.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring; consumes
api_surface.py's routes and import_graph.py's external_packages directly instead of reading them
back out of a fact store).

Claims are extracted with fixed patterns and verified against *structure* (routes, imports, file
list), never against more text -- a README sentence is not evidence of anything; this only
reports whether the claim it makes has a counterpart in the code.

Claim kinds: endpoint (``GET /items/{id}``-style, verified against api_surface routes after
normalizing path parameters), technology (a well-known library named in prose, verified against
imported external packages), path (an inline-code relative path, verified against the file list).

Claim status: supported (counterpart found), not_found (no counterpart), not_verifiable (an
endpoint claim when no routes were detected at all -- the framework may be one not read here).
"""

from __future__ import annotations

import re
from typing import TypedDict

from .api_surface import Route

README_MAX_BYTES = 200_000
MAX_CLAIMS = 200
_ENDPOINT = re.compile(
    r"(?<![A-Za-z0-9_/])(GET|POST|PUT|PATCH|DELETE)\s+`?(/[A-Za-z0-9_\-./{}:<>]*)"
)
_PATH_TOKEN = re.compile(
    r"`([A-Za-z0-9_][A-Za-z0-9_\-./]*(?:\.(?:py|ya?ml|json|toml|md|txt|cfg|ini)|/))`"
)
_FENCE = re.compile(r"^\s*(```|~~~)")
_PARAM = re.compile(r"\{[^}]*\}|<[^>]*>|:[A-Za-z_][A-Za-z0-9_]*")

TECHNOLOGIES: dict[str, tuple[str, ...]] = {
    "FastAPI": ("fastapi",), "Flask": ("flask",), "Django": ("django",),
    "Starlette": ("starlette",), "SQLAlchemy": ("sqlalchemy",), "Pydantic": ("pydantic",),
    "Celery": ("celery",), "Redis": ("redis", "aioredis"),
    "MongoDB": ("pymongo", "motor", "mongoengine", "beanie"),
    "PostgreSQL": ("psycopg2", "psycopg", "asyncpg", "sqlalchemy", "django"),
    "NumPy": ("numpy",), "Pandas": ("pandas",), "TensorFlow": ("tensorflow",),
    "PyTorch": ("torch",), "scikit-learn": ("sklearn",), "pytest": ("pytest",),
    "Click": ("click",), "Typer": ("typer",), "Uvicorn": ("uvicorn",),
}
_COMMON_WORDS = frozenset({"Click", "Typer"})
_TECH_RES = {
    name: re.compile(
        rf"(?:`{re.escape(name)}`|\*\*{re.escape(name)}\*\*)"
        if name in _COMMON_WORDS
        else rf"(?<![A-Za-z0-9_-]){re.escape(name)}(?![A-Za-z0-9_-])",
        re.IGNORECASE,
    )
    for name in TECHNOLOGIES
}
LIMITATIONS = [
    "claims are read by fixed patterns; prose describing a feature without naming an endpoint, "
    "library or path is not extracted",
    "a negated or hypothetical mention is read as a claim",
    "routes registered dynamically, and frameworks other than FastAPI/Flask/Starlette/Quart/"
    "Django URL files, are not seen",
    "a library used only indirectly can show as not_found",
]


class ExtractedClaim(TypedDict):
    kind: str
    key: tuple[str, ...]
    text: str
    line: int
    method: str | None


class Claim(TypedDict):
    kind: str
    text: str
    line: int
    status: str
    evidence: str


class ReadmeClaimsAggregate(TypedDict):
    total: int
    supported: int
    not_found: int
    not_verifiable: int
    by_kind: dict[str, dict[str, int]]
    supported_ratio: float | None
    verifiable_ratio: float


class ReadmeClaimsResult(TypedDict):
    readme_file: str
    readme_chars_read: int
    claims: list[Claim]
    aggregate: ReadmeClaimsAggregate
    limitations: list[str]


def normalize_path(path: str) -> str:
    path = path.split("?", 1)[0].rstrip("/") or "/"
    return _PARAM.sub("{}", path)


def extract_claims(text: str) -> list[ExtractedClaim]:
    """Ordered, de-duplicated claims (first mention wins)."""
    claims: list[ExtractedClaim] = []
    seen: set[tuple[str, ...]] = set()
    in_fence = False
    for number, line in enumerate(text.splitlines(), start=1):
        if _FENCE.match(line):
            in_fence = not in_fence
            continue
        for m in _ENDPOINT.finditer(line):
            method, path = m.group(1), normalize_path(m.group(2))
            key = ("endpoint", method, path)
            if key not in seen:
                seen.add(key)
                claims.append(
                    {
                        "kind": "endpoint", "key": key, "text": f"{method} {m.group(2)}"[:80],
                        "line": number, "method": method,
                    }
                )
        if in_fence:
            continue
        for name, pattern in _TECH_RES.items():
            if pattern.search(line) and ("technology", name) not in seen:
                seen.add(("technology", name))
                claims.append(
                    {"kind": "technology", "key": ("technology", name), "text": name,
                     "line": number, "method": None}
                )
        for m in _PATH_TOKEN.finditer(line):
            token = m.group(1)
            path_key = ("path", token)
            if path_key not in seen and not token.startswith("."):
                seen.add(path_key)
                claims.append(
                    {
                        "kind": "path", "key": path_key, "text": token[:80], "line": number,
                        "method": None,
                    }
                )
    return claims


def analyze_readme_claims(
    readme_file: str,
    readme_text: str,
    routes: list[Route],
    imported_external_packages: set[str],
    files: set[str],
) -> ReadmeClaimsResult | None:
    """None when the README makes no claims this check can verify."""
    extracted = extract_claims(readme_text)
    if not extracted:
        return None

    route_index = {
        (r["method"], normalize_path(r["path"])): r for r in routes
    }
    any_route_detected = bool(route_index)
    imported = {p.lower() for p in imported_external_packages}
    dirs = {p.rsplit("/", i)[0] + "/" for p in files for i in range(1, p.count("/") + 1)}
    basenames = {p.rsplit("/", 1)[-1] for p in files}
    dir_names = {d.rstrip("/").rsplit("/", 1)[-1] + "/" for d in dirs}

    claims: list[Claim] = []
    for c in extracted[:MAX_CLAIMS]:
        if c["kind"] == "endpoint":
            path = c["key"][2]
            hit = route_index.get((c["method"] or "", path)) or route_index.get(("ANY", path))
            if hit:
                status, evidence = "supported", f"{hit['file']}:{hit['line']}"
            elif not any_route_detected:
                status, evidence = "not_verifiable", "no routes detected in the analyzed code"
            else:
                status, evidence = "not_found", "no matching route detected"
        elif c["kind"] == "technology":
            used = sorted(set(TECHNOLOGIES[c["text"]]) & imported)
            if used:
                status, evidence = "supported", "imports: " + ", ".join(used)
            else:
                status, evidence = "not_found", "no import of " + "/".join(TECHNOLOGIES[c["text"]])
        else:
            token = c["text"]
            bare = token.count("/") == (1 if token.endswith("/") else 0)
            found = token in files or token in dirs or (
                bare and (token in basenames or token in dir_names)
            )
            status, evidence = (
                ("supported", "file exists") if found
                else ("not_found", "no such path in the repository")
            )
        claims.append(
            {
                "kind": c["kind"], "text": c["text"], "line": c["line"], "status": status,
                "evidence": evidence,
            }
        )

    by_kind: dict[str, dict[str, int]] = {}
    for claim in claims:
        by_kind.setdefault(
            claim["kind"], {"supported": 0, "not_found": 0, "not_verifiable": 0}
        )[claim["status"]] += 1
    supported = sum(1 for claim in claims if claim["status"] == "supported")
    not_found = sum(1 for claim in claims if claim["status"] == "not_found")
    verifiable = supported + not_found
    return {
        "readme_file": readme_file,
        "readme_chars_read": len(readme_text),
        "claims": claims,
        "aggregate": {
            "total": len(claims), "supported": supported, "not_found": not_found,
            "not_verifiable": len(claims) - verifiable,
            "by_kind": {k: by_kind[k] for k in sorted(by_kind)},
            "supported_ratio": round(supported / verifiable, 3) if verifiable else None,
            "verifiable_ratio": round(verifiable / len(claims), 3),
        },
        "limitations": LIMITATIONS,
    }
