"""structlog configuration with key/secret redaction (AD-014a AC8).

Mirrors services/ai-proxy's existing convention (CLAUDE.md: "structlog
processor redacts headers authorization, x-api-key, and any value matching
key patterns") rather than inventing a separate one — reviewer's grader
keys are a different pool from ai-proxy's provider keys, but they must be
redacted the same way.
"""

from __future__ import annotations

import re
from collections.abc import MutableMapping
from typing import Any

import structlog
from structlog.types import EventDict

_REDACT_KEYS = {"authorization", "x-api-key", "api_key", "apikey", "key", "token"}
_KEY_LOOKING_VALUE = re.compile(r"^(sk-|sk_|Bearer\s|AIza)[\w.\-]{8,}$")


def _redact_processor(
    _logger: object, _method_name: str, event_dict: MutableMapping[str, Any]
) -> EventDict:
    for k, v in list(event_dict.items()):
        if k.lower() in _REDACT_KEYS:
            event_dict[k] = "[redacted]"
        elif isinstance(v, str) and _KEY_LOOKING_VALUE.match(v):
            event_dict[k] = "[redacted]"
    return dict(event_dict)


def configure_logging() -> None:
    structlog.configure(
        processors=[
            _redact_processor,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ]
    )


def get_logger(name: str) -> Any:
    return structlog.get_logger(name)
