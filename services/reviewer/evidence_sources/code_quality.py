"""Evidence builder for the code-quality agent (AD-014b).

Ported from ProjAgentScan's src/agents/code_quality/evidence.py: same selection logic (3
largest Python files by line count, up to 8 docstring samples, cognitive-complexity aggregate,
README), adapted to emit EvidencePack v1 (app/evidence.py) with `repo:`-prefixed refs instead of
ProjAgentScan's own EvidencePack, and routed through this service's sanitizer
(app.sanitizer.wrap_untrusted) instead of ProjAgentScan's injection_scanner.

Candidate files are read only through evidence_sources.repo_io.RepoReader. Quotable items are
rendered as plain text (one fact/sample per item), never a JSON blob the model would need to
quote from verbatim -- see ProjAgentScan's docs/memory/pitfalls.md #20/#25 for why that fails in
practice even for short lists.
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.cognitive_complexity import percentile, score_tree
from .checks.docstring_coverage import analyze_tree
from .repo_io import RepoReader, safe_id, safe_parse_python

TOP_FILES_FOR_SAMPLING = 3
MAX_DOCSTRING_SAMPLES = 8
MAX_DOCSTRING_CHARS = 400
README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    """Normalise and flag (never wrap) at evidence-build time: `wrap_untrusted`'s boundary is
    random *per call* (its own docstring: "a per-run random boundary") -- calling it here would
    make the stored EvidencePack non-deterministic. Wrapping happens once per prompt render
    instead (app/prompt.py), matching that "per-run" scope. This function is what satisfies
    EvidenceItem's `untrusted implies sanitized` rule: normalised and scanned, just not yet
    delimited."""
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_complexity(pack: EvidencePack, reader: RepoReader) -> None:
    py_files = reader.iter_files("source", suffixes={".py"})
    all_scores: list[int] = []
    per_file: list[tuple[str, list[dict[str, object]]]] = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is None:
            continue
        tree, reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        try:
            functions = score_tree(tree)
        except RecursionError:
            continue
        if functions:
            per_file.append((rel, functions))
            all_scores.extend(
                f["cognitive"] for f in functions if isinstance(f["cognitive"], int)
            )

    if not all_scores:
        pack.coverage.append(
            EvidenceCoverage(
                channel="artifact", status="not_applicable",
                reason="no functions found in the analyzed Python files",
            )
        )
        return

    ordered = sorted(all_scores)
    summary = (
        f"function_count={len(ordered)}; mean={round(sum(ordered) / len(ordered), 2)}; "
        f"p95={percentile(ordered, 95)}; max={ordered[-1]}"
    )
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.cognitive_complexity.aggregate",
            source="artifact",
            content=summary,
            untrusted=False,
            sanitized=False,
        )
    )


def _add_docstring_samples(pack: EvidencePack, reader: RepoReader) -> int:
    py_files = reader.iter_files("source", suffixes={".py"})
    sized: list[tuple[int, str, str]] = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is not None:
            sized.append((len(text.splitlines()), rel, text))
    sized.sort(key=lambda t: (-t[0], t[1]))
    top = sized[:TOP_FILES_FOR_SAMPLING]

    added = 0
    for _, rel, text in top:
        if added >= MAX_DOCSTRING_SAMPLES:
            break
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        counts = analyze_tree(tree)
        if counts["functions"] == 0:
            continue
        safe_rel, _ = safe_id(rel)
        ref = f"repo:ev.docstring.{safe_rel}"
        body = (
            f"file={rel}; public_functions={counts['functions']}; "
            f"documented={counts['documented']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref,
                source="artifact",
                content=_sanitize(pack, ref, body),
                untrusted=True,
                sanitized=True,
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
            ref=ref,
            source="artifact",
            content=_sanitize(pack, ref, text),
            untrusted=True,
            sanitized=True,
        )
    )
    return True


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="code-quality", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    _add_complexity(pack, reader)
    sampled = _add_docstring_samples(pack, reader)
    has_readme = _add_readme(pack, reader)

    pack.truncations.extend(reader.truncations)
    if sampled == 0 and not has_readme:
        pack.missing_required.append("documentation")
    return pack
