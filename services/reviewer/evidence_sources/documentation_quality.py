"""Evidence builder for the documentation-quality agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/documentation_quality/evidence.py: README
presence/content, public-docstring samples (sharing code-quality's docstring-coverage logic,
evidence_sources/checks/docstring_coverage.py), and now docstring-substance ("does it just
restate the function's own name" -- docstring_substance.py), the check the narrower first pass
deliberately left out even though this agent's own rubric cites it directly.
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.docstring_coverage import analyze_tree
from .checks.docstring_substance import analyze_substance
from .repo_io import RepoReader, safe_id, safe_parse_python

TOP_FILES_FOR_SAMPLING = 3
MAX_SAMPLES = 8
README_MAX_CHARS = 4000
README_CANDIDATES = ("README.md", "README.rst", "README.txt", "README", "readme.md")


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_docstring_samples(pack: EvidencePack, reader: RepoReader) -> int:
    py_files = reader.iter_files("source", suffixes={".py"})
    sized: list[tuple[int, str, str]] = []
    for rel in py_files:
        text = reader.read_text(rel)
        if text is not None:
            sized.append((len(text.splitlines()), rel, text))
    sized.sort(key=lambda t: (-t[0], t[1]))

    added = 0
    for _, rel, text in sized[:TOP_FILES_FOR_SAMPLING]:
        if added >= MAX_SAMPLES:
            break
        tree, _reason = safe_parse_python(text, rel)
        if tree is None:
            continue
        counts = analyze_tree(tree)
        if counts["functions"] == 0:
            continue
        safe_rel, _ = safe_id(rel)
        ref = f"repo:ev.docstring.{safe_rel}"
        param_ratio = (
            round(counts["params_annotated"] / counts["params"], 3) if counts["params"] else None
        )
        body = (
            f"file={rel}; public_functions={counts['functions']}; "
            f"documented={counts['documented']}; param_annotation_ratio={param_ratio}"
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


def _add_docstring_substance(pack: EvidencePack, reader: RepoReader) -> None:
    trees = {}
    for rel in reader.iter_files("source", suffixes={".py"}):
        text = reader.read_text(rel)
        if text is None:
            continue
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
    pack = EvidencePack(agent_id="documentation-quality", submission_id=submission_id)
    reader = RepoReader(clone_dir, manifest=manifest)

    sampled = _add_docstring_samples(pack, reader)
    has_readme = _add_readme(pack, reader)
    _add_docstring_substance(pack, reader)

    pack.truncations.extend(reader.truncations)
    if sampled == 0 and not has_readme:
        pack.missing_required.append("documentation")
    return pack
