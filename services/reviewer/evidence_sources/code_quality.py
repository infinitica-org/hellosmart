"""Evidence builder for the code-quality agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/code_quality/evidence.py: 3 largest Python files by
line count, up to 8 docstring samples, cognitive-complexity aggregate, duplicated-code detection
(duplication.py), lint findings via ruff-in-isolated-mode (lint_count.py), docstring-substance
("does it just restate the name" -- docstring_substance.py), and README. Emits EvidencePack v1
(app/evidence.py) with `repo:`-prefixed refs; routed through this service's sanitizer
(normalise()/suspicious() at build time, wrap_untrusted() once per prompt render -- see
app/prompt.py) instead of ProjAgentScan's injection_scanner.

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
from .checks.docstring_substance import analyze_substance
from .checks.duplication import find_duplication
from .checks.lint_count import lint_candidate_files
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


def _all_python_texts(reader: RepoReader) -> dict[str, str]:
    texts: dict[str, str] = {}
    for rel in reader.iter_files("source", suffixes={".py"}):
        text = reader.read_text(rel)
        if text is not None:
            texts[rel] = text
    return texts


def _add_duplication(pack: EvidencePack, file_texts: dict[str, str]) -> None:
    result = find_duplication(file_texts)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="artifact", status="not_applicable",
                reason="no significant lines in the analyzed Python files",
            )
        )
        return
    ref = "repo:fact.duplication.summary"
    content = (
        f"duplicated_line_ratio={result['duplicated_line_ratio']}; "
        f"duplicated_lines={result['duplicated_lines']}; total_lines={result['total_lines']}"
    )
    pack.items.append(
        EvidenceItem(ref=ref, source="artifact", content=content, untrusted=False, sanitized=False)
    )
    for i, block in enumerate(result["blocks"][:5]):
        ref = f"repo:ev.duplication.block.{i}"
        content = (
            f"file={block['file']}; lines {block['start_line']}-{block['end_line']} "
            f"({block['lines']} lines); also_in={block['also_in']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_lint(pack: EvidencePack, clone_dir: str, file_texts: dict[str, str]) -> None:
    result = lint_candidate_files(clone_dir, file_texts)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="artifact", status="unavailable", reason="ruff is not installed"
            )
        )
        return
    ref = "repo:fact.lint_count.summary"
    content = (
        f"total_findings={result['total_findings']}; "
        f"findings_per_kloc={result['findings_per_kloc']}; total_lines={result['total_lines']}"
    )
    pack.items.append(
        EvidenceItem(ref=ref, source="artifact", content=content, untrusted=False, sanitized=False)
    )
    if result["by_rule"]:
        ref = "repo:ev.lint.by_rule"
        content = "; ".join(f"{r['code']}={r['count']}" for r in result["by_rule"])
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def _add_docstring_substance(pack: EvidencePack, file_texts: dict[str, str]) -> None:
    trees = {}
    for rel, text in file_texts.items():
        tree, _reason = safe_parse_python(text, rel)
        if tree is not None:
            trees[rel] = tree
    result = analyze_substance(trees)
    if result is None:
        return
    ref = "repo:fact.docstring_substance.summary"
    content = (
        f"public_functions={result['public_functions']}; "
        f"substantive_coverage={result['substantive_coverage']}; "
        f"restating_docstrings={result['restating_docstrings']}"
    )
    pack.items.append(
        EvidenceItem(ref=ref, source="artifact", content=content, untrusted=False, sanitized=False)
    )
    for ex in result["restating_examples"]:
        safe_name, _ = safe_id(f"{ex['file']}_{ex['name']}")
        ref = f"repo:ev.restating_docstring.{safe_name}"
        content = f"file={ex['file']}; name={ex['name']}; line={ex['line']}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )


def build_evidence(
    submission_id: str, clone_dir: str, manifest: dict[str, object] | None = None
) -> EvidencePack:
    pack = EvidencePack(agent_id="code-quality", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    _add_complexity(pack, reader)
    sampled = _add_docstring_samples(pack, reader)
    has_readme = _add_readme(pack, reader)

    file_texts = _all_python_texts(reader)
    _add_duplication(pack, file_texts)
    _add_lint(pack, clone_dir, file_texts)
    _add_docstring_substance(pack, file_texts)

    pack.truncations.extend(reader.truncations)
    if sampled == 0 and not has_readme:
        pack.missing_required.append("documentation")
    return pack
