"""Evidence builder for the architecture-design agent (AD-014b).

Narrower first-pass port of ProjAgentScan's src/agents/architecture_design/evidence.py:
per-module summaries (classes/functions/imports) and README, via the shared
evidence_sources/checks/module_summary.py. ProjAgentScan's original also detects dependency
cycles and coupling hubs; that depth is a follow-up, not carried over here.
"""

from __future__ import annotations

from typing import cast

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.module_summary import same_project_imports, summarize_module
from .repo_io import RepoReader, safe_id, safe_parse_python

MAX_MODULES = 25
README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_modules(pack: EvidencePack, reader: RepoReader) -> int:
    py_files = reader.iter_files("source", suffixes={".py"})
    all_module_ids = {
        rel[: -len(".py")].replace("/", ".") for rel in py_files if rel.endswith(".py")
    }

    summaries = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is None:
            continue
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        summaries.append(summarize_module(rel, tree))

    summaries.sort(key=lambda s: (-cast(int, s["lines"]), str(s["file"])))  # largest first
    added = 0
    for s in summaries[:MAX_MODULES]:
        safe_rel, _ = safe_id(str(s["file"]))
        ref = f"repo:ev.module.{safe_rel}"
        local = same_project_imports(all_module_ids, cast("list[str]", s["imports"]))
        body = (
            f"file={s['file']}; classes={s['classes']}; functions={s['functions']}; "
            f"imports_in_repo={local}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, body),
                untrusted=True, sanitized=True,
            )
        )
        added += 1
    return added


def _add_readme(pack: EvidencePack, reader: RepoReader) -> bool:
    name = next((n for n in README_CANDIDATES if reader.exists(n)), None)
    text = reader.read_text(name, max_bytes=README_MAX_CHARS, truncate=True) if name else None
    if not text or not text.strip():
        pack.coverage.append(
            EvidenceCoverage(channel="artifact", status="unavailable", reason="no README found")
        )
        return False
    ref = "repo:ev.readme"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact", content=_sanitize(pack, ref, text),
            untrusted=True, sanitized=True,
        )
    )
    return True


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="architecture-design", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    modules = _add_modules(pack, reader)
    _add_readme(pack, reader)

    pack.truncations.extend(reader.truncations)
    if modules == 0:
        pack.missing_required.append("code_map")
    return pack
