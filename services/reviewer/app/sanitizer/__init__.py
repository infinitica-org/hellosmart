"""Grader input sanitizer (BR-18, AD-017). Sensitive path: Architecture approval required.

Candidate content is data, never instructions. Steps:
  1. normalise (strip zero-width / bidi control chars, NFC)
  2. detect grader-directed text (classifier + patterns), record as flag, do NOT silently delete
  3. wrap in an untrusted block with a per-run random boundary the content cannot predict
"""

import re
import secrets
import unicodedata

_INVISIBLE = re.compile(r"[​-‏‪-‮⁠-⁤﻿]")
_SUSPECT = re.compile(
    r"(ignore (all|previous|the above) instructions|you are (now )?the (grader|reviewer)|"
    r"score (this|me) (a )?\d|system prompt|assistant:|<\s*/?\s*(system|instructions)\s*>)",
    re.IGNORECASE,
)


def normalise(text: str) -> str:
    return _INVISIBLE.sub("", unicodedata.normalize("NFC", text))


def suspicious(text: str) -> bool:
    return bool(_SUSPECT.search(text))


def wrap_untrusted(text: str) -> tuple[str, str]:
    """Returns (wrapped_text, boundary). The boundary goes in the system prompt only."""
    boundary = f"UNTRUSTED-{secrets.token_hex(8)}"
    clean = normalise(text).replace(boundary, "")
    return f"<<{boundary}>>\n{clean}\n<</{boundary}>>", boundary
