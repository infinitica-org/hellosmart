"""Redacts secret-shaped values before anything reaches the local spool.

This is a different job from the reviewer's sanitizer (app/sanitizer.py in services/reviewer):
that one flags suspected prompt-injection in evidence a model will read, but keeps the content.
This one assumes raw candidate terminal output can contain a real, accidentally-pasted
credential, and destroys it -- irrecoverably, before it is ever written to disk -- rather than
flagging it for a human or a model to see. Do not reuse this module for the reviewer's job, or
vice versa; the two threats and the two correct responses are different.
"""

from __future__ import annotations

import re

_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key id
    re.compile(r"(?i)aws_secret_access_key\s*=\s*\S+"),
    re.compile(r"ghp_[A-Za-z0-9]{36,}"),  # GitHub personal access token
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),  # Anthropic/OpenAI-style API key (may contain hyphens)
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
    # No leading \b: a real-world var name like DATABASE_PASSWORD has a word character (`_`)
    # right before PASSWORD, so a \b there would never match -- under-redaction is the one
    # failure mode this module must not have.
    re.compile(r"(?i)(password|passwd|secret|token)\s*[:=]\s*\S{6,}"),
)
REDACTED = "[redacted]"


def redact(text: str) -> str:
    """Replace every secret-shaped match with a fixed marker. Over-redaction (a false positive
    on something that wasn't actually a secret) is the safe failure mode here; under-redaction
    is not, so patterns stay broad."""
    for pattern in _PATTERNS:
        text = pattern.sub(REDACTED, text)
    return text
