"""Docstrings that say nothing new: ones that only restate the function's own name.

Ported from ProjAgentScan's src/checks/quality/docstring_substance.py (logic unchanged; the
`@register_check`/`CheckContext` fact-store wrapper was dropped, see package docstring).

Companion to docstring_coverage.py, which counts presence only. A one-line docstring saying only
"Get user." on ``get_user`` raises coverage without documenting anything, so this separates
documented public functions into restating and substantive ones. A docstring is "restating" when,
after dropping filler words ("the", "a", "return", "get", ...) and a trailing plural "s", every
word in it is already a word of the function name. Empty docstrings are not counted as documented.

Known limits (so a clean result is not proof of good documentation): a generic docstring that
doesn't repeat the name ("Handle the request.") counts as substantive even if meaningless; a
docstring that restates the name in other words ("Remove item." on ``delete_item``) is not caught.
"""

from __future__ import annotations

import ast
import re
from collections.abc import Iterator
from typing import TypedDict

from .docstring_coverage import _FUNC_TYPES, _has_doc, _is_overload

TOP_EXAMPLES = 5
_FILLER = frozenset(
    "a an the of for to and or this that is are it its in on with by from as be get gets set sets "
    "return returns returning make makes do does run runs".split()
)
_CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")
_WORD = re.compile(r"[a-z0-9]+")


class RestatingExample(TypedDict):
    file: str
    name: str
    line: int


class DocstringSubstanceResult(TypedDict):
    public_functions: int
    documented_functions: int
    restating_docstrings: int
    substantive_docstrings: int
    substantive_coverage: float
    restating_examples: list[RestatingExample]


def _stem(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") else word


def _words(text: str) -> list[str]:
    return [_stem(w) for w in _WORD.findall(_CAMEL.sub(" ", text).lower())]


def is_restating(name: str, docstring: str) -> bool:
    name_words = set(_words(name.replace("_", " ")))
    doc_words = {w for w in _words(docstring) if w not in _FILLER}
    return doc_words <= name_words


def iter_public_functions(body: list[ast.stmt], prefix: str = "") -> Iterator[ast.AST]:
    for node in body:
        if isinstance(node, _FUNC_TYPES):
            if not node.name.startswith("_") and not _is_overload(node):
                yield node
        elif isinstance(node, ast.ClassDef):
            if not node.name.startswith("_"):
                yield from iter_public_functions(node.body)
        else:
            for attr in ("body", "orelse", "finalbody"):
                inner = getattr(node, attr, None)
                if isinstance(inner, list) and inner and isinstance(inner[0], ast.stmt):
                    yield from iter_public_functions(inner)


def analyze_substance(file_trees: dict[str, ast.AST]) -> DocstringSubstanceResult | None:
    public = documented = restating = 0
    examples: list[RestatingExample] = []
    parsed = 0
    for rel in sorted(file_trees):
        tree = file_trees[rel]
        found = file_documented = file_restating = 0
        file_examples: list[RestatingExample] = []
        try:
            for fn in iter_public_functions(tree.body):  # type: ignore[attr-defined]
                found += 1
                if not _has_doc(fn):
                    continue
                file_documented += 1
                doc = ast.get_docstring(fn)  # type: ignore[arg-type]
                if doc and is_restating(fn.name, doc):  # type: ignore[attr-defined]
                    file_restating += 1
                    file_examples.append(
                        {"file": rel, "name": fn.name, "line": fn.lineno}  # type: ignore[attr-defined]
                    )
        except RecursionError:
            continue
        parsed += 1
        public += found
        documented += file_documented
        restating += file_restating
        examples += file_examples

    if not parsed or public == 0:
        return None

    return {
        "public_functions": public,
        "documented_functions": documented,
        "restating_docstrings": restating,
        "substantive_docstrings": documented - restating,
        "substantive_coverage": round((documented - restating) / public, 3),
        "restating_examples": examples[:TOP_EXAMPLES],
    }
