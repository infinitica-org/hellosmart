"""Duplicated code blocks across the repository's Python files.

Ported from ProjAgentScan's src/checks/quality/duplication.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

Static, text-based. Each file is reduced to its significant lines (comments, blank lines and
trivial lines such as a lone bracket, ``pass`` or ``else:`` are dropped; whitespace is
collapsed). Every window of ``WINDOW`` consecutive significant lines is fingerprinted; a window
that occurs more than once (in one file at non-overlapping positions, or in several files) marks
its lines as duplicated.

Known limits (so a low ratio is not proof of original code): renamed copies, copies shorter than
``WINDOW`` lines, and reordered/interleaved copies are not caught -- no AST-level matching.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import TypedDict

MAX_FILE_LINES = 20_000
MAX_TOTAL_LINES = 200_000
WINDOW = 6
MAX_BLOCKS = 10
MAX_ALSO_IN = 3
_TRIVIAL = re.compile(
    r"^(?:[\[\]\(\)\{\},:]*|pass|else:|try:|finally:|break|continue|return|\.\.\.)$"
)
_WS = re.compile(r"\s+")


class AlsoIn(TypedDict):
    file: str
    start_line: int


class DuplicationBlock(TypedDict):
    file: str
    start_line: int
    end_line: int
    lines: int
    also_in: list[AlsoIn]


class DuplicationResult(TypedDict):
    duplicated_line_ratio: float
    duplicated_lines: int
    total_lines: int
    blocks: list[DuplicationBlock]
    window_lines: int


def significant_lines(text: str) -> list[tuple[int, str]]:
    """[(1-based line number, normalized text)] for lines that carry meaning."""
    out = []
    for number, raw in enumerate(text.splitlines(), start=1):
        line = _WS.sub(" ", raw.strip())
        if not line or line.startswith("#") or _TRIVIAL.match(line):
            continue
        out.append((number, line))
    return out


def find_duplicates(
    seqs: dict[str, list[tuple[int, str]]],
) -> tuple[dict[str, set[int]], dict[tuple[str, int], list[tuple[str, int]]]]:
    """-> ({file: covered indices}, {(file, start_index): [(file, index), ...] partner windows})"""
    windows: dict[tuple[str, ...], list[tuple[str, int]]] = defaultdict(list)
    for file in sorted(seqs):
        seq = seqs[file]
        for i in range(len(seq) - WINDOW + 1):
            key = tuple(text for _, text in seq[i : i + WINDOW])
            if len(set(key)) == 1:  # the same line repeated is not a copied block
                continue
            windows[key].append((file, i))

    covered: dict[str, set[int]] = defaultdict(set)
    partners: dict[tuple[str, int], list[tuple[str, int]]] = {}
    for places in windows.values():
        kept: list[tuple[str, int]] = []
        for file, i in places:  # drop overlapping repeats within one file
            if all(f != file or abs(i - j) >= WINDOW for f, j in kept):
                kept.append((file, i))
        if len(kept) < 2:
            continue
        for file, i in kept:
            covered[file].update(range(i, i + WINDOW))
            partners[(file, i)] = [p for p in kept if p != (file, i)]
    return covered, partners


def _runs(indices: set[int]) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start: int | None = None
    prev: int = -1
    for i in sorted(indices):
        if start is None:
            start, prev = i, i
        elif i == prev + 1:
            prev = i
        else:
            runs.append((start, prev))
            start, prev = i, i
    if start is not None:
        runs.append((start, prev))
    return runs


def find_duplication(file_texts: dict[str, str]) -> DuplicationResult | None:
    """None when there is nothing to analyze (no significant lines in any file)."""
    seqs: dict[str, list[tuple[int, str]]] = {}
    total = 0
    for rel in sorted(file_texts):
        seq = significant_lines(file_texts[rel])
        if len(seq) > MAX_FILE_LINES or total + len(seq) > MAX_TOTAL_LINES:
            continue  # this file only: later, smaller files still get scanned
        total += len(seq)
        seqs[rel] = seq
    if not seqs or total == 0:
        return None

    covered, partners = find_duplicates(seqs)
    duplicated = sum(len(v) for v in covered.values())

    blocks: list[DuplicationBlock] = []
    for file in sorted(covered):
        seq = seqs[file]
        for start, end in _runs(covered[file]):
            also: list[tuple[str, int]] = []
            for i in range(start, end - WINDOW + 2):
                if (file, i) in partners:
                    also = partners[(file, i)]
                    break
            blocks.append(
                {
                    "file": file,
                    "start_line": seq[start][0],
                    "end_line": seq[end][0],
                    "lines": end - start + 1,
                    "also_in": [
                        {"file": f, "start_line": seqs[f][j][0]} for f, j in also[:MAX_ALSO_IN]
                    ],
                }
            )
    blocks.sort(key=lambda b: (-b["lines"], b["file"], b["start_line"]))

    return {
        "duplicated_line_ratio": round(duplicated / total, 3),
        "duplicated_lines": duplicated,
        "total_lines": total,
        "blocks": blocks[:MAX_BLOCKS],
        "window_lines": WINDOW,
    }
