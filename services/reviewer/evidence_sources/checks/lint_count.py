"""Lint findings in the repository's Python files, using ruff in isolated mode.

Ported from ProjAgentScan's src/checks/quality/lint_count.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

ruff only reads and parses the files; it does not import or run them -- static analysis, not
candidate code execution. Invoked with ``--isolated`` so the candidate's own ruff/pyproject
configuration is ignored, and with a fixed rule selection (pyflakes ``F``, pycodestyle
``E``/``W``, minus line length ``E501``).

ruff is this service's own dev dependency (`pyproject.toml`'s `[dependency-groups] dev`), not a
runtime one -- in any environment where it isn't installed this returns None (the caller should
treat that as "unavailable", never as zero findings), matching the original's documented,
deliberate choice not to force a lint tool into production dependencies just for this signal.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path, PurePath
from typing import TypedDict

CHUNK = 100
TIMEOUT_S = 60
RULES = "E,F,W"
IGNORED = "E501"
TOP_RULES = 10
TOP_FILES = 5


class RuleCount(TypedDict):
    code: str
    count: int


class FileCount(TypedDict):
    file: str
    count: int


class LintCountResult(TypedDict):
    total_findings: int
    findings_per_kloc: float
    total_lines: int
    by_rule: list[RuleCount]
    worst_files: list[FileCount]
    syntax_errors: int
    rules_selected: str
    tool_version: str


def _ruff(args: list[str], cwd: Path | str) -> subprocess.CompletedProcess[str]:
    # Fixed argv (no untrusted input in the command itself) -- paths passed in `args` come only
    # from RepoReader-approved candidate-relative paths, already safety-checked before this runs.
    return subprocess.run(  # noqa: S603
        [sys.executable, "-m", "ruff", *args],
        cwd=cwd, capture_output=True, text=True, timeout=TIMEOUT_S,
        encoding="utf-8", errors="replace",
    )


def _relative(filename: str, candidates: list[str]) -> str:
    """Map ruff's absolute filename back to the repo-relative path we passed in."""
    norm = filename.replace("\\", "/").lower()
    for rel in candidates:
        if norm == rel.lower() or norm.endswith("/" + rel.lower()):
            return rel
    return PurePath(filename).name  # never leak an absolute path


def lint_candidate_files(clone_dir: str, file_texts: dict[str, str]) -> LintCountResult | None:
    """None when ruff isn't installed or could not be started/timed out -- caller must treat
    that as "unavailable", never as zero findings."""
    if importlib.util.find_spec("ruff") is None:
        return None

    try:
        version_proc = _ruff(["--version"], clone_dir)
        version = version_proc.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None

    by_rule: Counter[str] = Counter()
    by_file: Counter[str] = Counter()
    syntax_files: set[str] = set()
    paths = sorted(file_texts)
    for i in range(0, len(paths), CHUNK):
        chunk = paths[i : i + CHUNK]
        try:
            proc = _ruff(
                [
                    "check", "--isolated", "--no-cache", "--output-format", "json",
                    "--select", RULES, "--ignore", IGNORED, "--", *chunk,
                ],
                clone_dir,
            )
            findings = json.loads(proc.stdout or "[]")
        except (subprocess.TimeoutExpired, OSError, subprocess.SubprocessError, ValueError):
            return None
        for f in findings:
            if not f.get("code") or f["code"] == "invalid-syntax":
                syntax_files.add(_relative(f.get("filename", ""), chunk))
                continue
            by_rule[f["code"]] += 1
            by_file[_relative(f.get("filename", ""), chunk)] += 1

    total_lines = sum(len(t.splitlines()) for t in file_texts.values())
    total = sum(by_rule.values())
    return {
        "total_findings": total,
        "findings_per_kloc": round(total / (total_lines / 1000), 2) if total_lines else 0,
        "total_lines": total_lines,
        "by_rule": [
            {"code": c, "count": n}
            for c, n in sorted(by_rule.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_RULES]
        ],
        "worst_files": [
            {"file": f, "count": n}
            for f, n in sorted(by_file.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_FILES]
        ],
        "syntax_errors": len(syntax_files),
        "rules_selected": f"{RULES} (ignoring {IGNORED})",
        "tool_version": version,
    }
