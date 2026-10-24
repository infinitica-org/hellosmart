"""The only sanctioned way to read files from a candidate's repo/workspace snapshot (AD-014b).

Ported from ProjAgentScan's `src/repo_io.py` near-verbatim (no ProjAgentScan-specific
dependencies there to begin with -- stdlib only). Used by every evidence builder under
`evidence_sources/checks/` and every migrated agent's evidence module. Modernised to this
repo's `X | None` type-hint convention (mypy strict + ruff UP) during the port; behavior
unchanged.

Why it exists: a candidate's repo is untrusted input. Reading it naively has already caused
these defects in ProjAgentScan's own review history: symlinks that pull files from outside the
clone into an LLM prompt, one hostile file crashing a whole check (RecursionError), unbounded
file sizes and item counts, candidate-controlled strings used as evidence ids, and non-Python
repos silently reading as "empty".

What RepoReader guarantees
  - never follows symlinks (or junctions) and never leaves the clone directory
  - skips oversized and binary files, with a short fixed reason recorded in `reader.skipped`
  - walks the repo ONCE, deterministically (sorted), with a file-count cap
  - uses the manifest's source/test classification when you ask for those kinds
  - never raises on a bad file: it records a skip and moves on

Skip reasons are fixed codes (never raw exception text, which can leak local paths):
  symlink, outside_repo, oversized, binary, unreadable, not_found, too_deeply_nested,
  syntax_error, unparseable
"""

from __future__ import annotations

import ast
import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

MAX_FILE_BYTES = 500_000
MAX_FILES = 5_000
MAX_ID_LEN = 64

# Directories never worth walking. Hidden dirs such as .github are NOT excluded
# (CI workflows live there); only .git and tool caches are.
EXCLUDED_DIRS = frozenset(
    {
        ".git", "node_modules", "venv", ".venv", "env", "site-packages", "vendor",
        "third_party", "dist", "build", "__pycache__", "target", "out", "coverage",
        ".next", ".tox", ".mypy_cache", ".pytest_cache", ".ruff_cache",
        "bower_components", "htmlcov",
    }
)

EXTENSION_LANGUAGES = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
    ".cjs": "javascript", ".ts": "typescript", ".tsx": "typescript", ".java": "java",
    ".kt": "kotlin", ".go": "go", ".rs": "rust", ".rb": "ruby", ".php": "php",
    ".cs": "csharp", ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp", ".hpp": "cpp",
    ".swift": "swift", ".scala": "scala", ".lua": "lua", ".dart": "dart", ".ex": "elixir",
    ".exs": "elixir", ".sh": "shell", ".r": "r",
}


@dataclass(frozen=True)
class Skip:
    path: str
    reason: str


class RepoReader:
    def __init__(
        self,
        clone_dir: Path | str,
        manifest: dict[str, Any] | None = None,
        max_file_bytes: int = MAX_FILE_BYTES,
        max_files: int = MAX_FILES,
    ) -> None:
        self.root = Path(clone_dir).resolve()
        self.manifest = manifest or {}
        self.max_file_bytes = max_file_bytes
        self.max_files = max_files
        self.skipped: list[Skip] = []
        self.truncations: list[str] = []

    # -- path safety ----------------------------------------------------------
    def _skip(self, rel: str, reason: str) -> None:
        item = Skip(rel, reason)
        if item not in self.skipped:
            self.skipped.append(item)

    def _safe_path(self, rel: str) -> Path | None:
        """Return the real path for `rel`, or None (recording why) if it is unsafe."""
        rel_path = Path(rel)
        if rel_path.is_absolute() or ".." in rel_path.parts:
            self._skip(rel, "outside_repo")
            return None
        cur = self.root
        for part in rel_path.parts:
            cur = cur / part
            if cur.is_symlink():
                self._skip(rel, "symlink")
                return None
        try:
            if not cur.resolve().is_relative_to(self.root):  # catches junctions and odd mounts
                self._skip(rel, "outside_repo")
                return None
        except (OSError, RuntimeError):
            self._skip(rel, "unreadable")
            return None
        return cur

    def exists(self, rel: str) -> bool:
        """True only for a real, in-repo, non-symlink file (probing never records a skip)."""
        p = self._safe_path(rel)
        return bool(p and p.is_file())

    # -- reading ----------------------------------------------------------------
    def read_text(
        self, rel: str, *, max_bytes: int | None = None, truncate: bool = False
    ) -> str | None:
        """Read a candidate file as text. Returns None (with a recorded skip) if it is a
        symlink, outside the repo, oversized (unless truncate=True), binary or unreadable.
        A missing file returns None WITHOUT recording a skip (it is a normal probe)."""
        p = self._safe_path(rel)
        if p is None:
            return None
        try:
            if not p.is_file():
                return None
            limit = max_bytes or self.max_file_bytes
            size = p.stat().st_size
            if size > limit and not truncate:
                self._skip(rel, "oversized")
                return None
            with open(p, "rb") as fh:
                data = fh.read(limit)
            if size > limit:
                self.truncations.append(f"{rel}: first {limit} of {size} bytes read")
            if b"\x00" in data[:8192]:
                self._skip(rel, "binary")
                return None
            return data.decode("utf-8", errors="replace")
        except OSError:
            self._skip(rel, "unreadable")
            return None

    # -- walking ------------------------------------------------------------------
    def iter_files(
        self,
        kind: str = "source",
        suffixes: Iterable[str] | None = None,
        names: Iterable[str] | None = None,
    ) -> list[str]:
        """Sorted relative posix paths. kind:
          "source" / "test": the manifest's classification when available, else a walk;
          "any": always a walk (use for Dockerfiles, CI workflows and other non-source files).
        The manifest excludes dot-directories, so files under .github/ require kind="any"."""
        suf = {s.lower() for s in suffixes} if suffixes else None
        nm = set(names) if names else None

        entries = self.manifest.get(f"{kind}_files") if kind in ("source", "test") else None
        if entries is not None:
            paths = sorted({e["path"] if isinstance(e, dict) else e for e in entries})
        else:
            paths = self._walk()

        out = []
        for rel in paths:
            base = os.path.basename(rel)
            if suf is not None and Path(base).suffix.lower() not in suf:
                continue
            if nm is not None and base not in nm:
                continue
            out.append(rel)
        if len(out) > self.max_files:
            self.truncations.append(f"file list capped at {self.max_files} of {len(out)}")
            out = out[: self.max_files]
        return out

    def _walk(self) -> list[str]:
        found: list[str] = []
        for dirpath, dirnames, filenames in os.walk(self.root, followlinks=False):
            here = Path(dirpath)
            keep = []
            for d in sorted(dirnames):
                rel_dir = (here / d).relative_to(self.root).as_posix()
                if d in EXCLUDED_DIRS:
                    continue
                if (here / d).is_symlink():
                    self._skip(rel_dir, "symlink")
                    continue
                keep.append(d)
            dirnames[:] = keep
            for f in sorted(filenames):
                full = here / f
                rel = full.relative_to(self.root).as_posix()
                if full.is_symlink():
                    self._skip(rel, "symlink")
                    continue
                found.append(rel)
                if len(found) > self.max_files * 4:  # hard stop for pathological repos
                    self.truncations.append("repository walk stopped early (too many files)")
                    return sorted(found)
        return sorted(found)


# -- parsing helpers --------------------------------------------------------------


def safe_parse_python(
    source: str, filename: str = "<candidate>"
) -> tuple[ast.AST | None, str | None]:
    """Parse candidate Python without executing it. Returns (tree, None) or (None, skip_reason)."""
    try:
        return ast.parse(source, filename=filename), None
    except SyntaxError:
        return None, "syntax_error"
    except RecursionError:
        return None, "too_deeply_nested"
    except (ValueError, MemoryError):
        return None, "unparseable"


def visit_safely(visitor: ast.NodeVisitor, tree: ast.AST) -> str | None:
    """Run an ast.NodeVisitor on a candidate's tree. NodeVisitor recurses, and a file can parse
    fine yet be too deep to visit (about 600 chained operators), so RecursionError must be
    caught per file. Returns None on success or a skip reason. Prefer ast.walk when you don't
    need a visitor."""
    try:
        visitor.visit(tree)
        return None
    except RecursionError:
        return "too_deeply_nested"


# -- evidence helpers -----------------------------------------------------------------


def safe_id(text: str, max_len: int = MAX_ID_LEN) -> tuple[str, bool]:
    """Turn a candidate-controlled string (package name, file name, route...) into a safe
    evidence id segment: lowercase [a-z0-9_-] only, no dots (dots separate id segments),
    length-capped. Returns (safe_segment, was_modified)."""
    cleaned = re.sub(r"[^a-z0-9_-]+", "_", str(text).lower()).strip("_") or "unnamed"
    cleaned = cleaned[:max_len]
    return cleaned, cleaned != str(text)


def cap_items(items: list[Any], limit: int, label: str) -> tuple[list[Any], str | None]:
    """Keep the first `limit` items; return a truncation note when something was dropped."""
    if len(items) <= limit:
        return items, None
    return items[:limit], f"{label}: {limit} of {len(items)} shown"


def coverage_summary(paths: Iterable[str], covered_languages: Iterable[str]) -> dict[str, Any]:
    """Say what was and was not examined, so an unsupported language never reads as "zero
    findings". Only recognised code extensions are counted."""
    covered = {c.lower() for c in covered_languages}
    counts: dict[str, int] = {}
    for p in paths:
        lang = EXTENSION_LANGUAGES.get(Path(p).suffix.lower())
        if lang:
            counts[lang] = counts.get(lang, 0) + 1
    total = sum(counts.values())
    in_scope = sum(n for lang, n in counts.items() if lang in covered)
    return {
        "languages_covered": sorted(lang for lang in counts if lang in covered),
        "uncovered_languages": {
            lang: n for lang, n in sorted(counts.items()) if lang not in covered
        },
        "covered_file_ratio": round(in_scope / total, 3) if total else None,
    }
