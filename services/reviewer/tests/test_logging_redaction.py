"""AC8: grader key never appears in the captured log sink."""

import io
import json

import structlog

from app.logging import configure_logging


def test_key_looking_values_are_redacted() -> None:
    sink = io.StringIO()
    configure_logging()
    structlog.configure(
        processors=structlog.get_config()["processors"],
        logger_factory=structlog.PrintLoggerFactory(file=sink),
    )
    log = structlog.get_logger("test")

    secret_key = "sk-ant-api03-REAL-LOOKING-SECRET-VALUE-00000000"
    log.info("provider call", provider="anthropic", api_key=secret_key, authorization=secret_key)

    captured = sink.getvalue()
    assert secret_key not in captured
    assert "[redacted]" in captured


def test_redaction_is_keyed_not_just_pattern_matched() -> None:
    """A value under a redact-listed key is always masked, even if it
    doesn't happen to match the key-shaped regex (e.g. a short test key) —
    AC8 requires this to key off the field name, not rely solely on the
    value looking like a known provider's key format.
    """
    sink = io.StringIO()
    structlog.configure(
        processors=[
            __import__("app.logging", fromlist=["_redact_processor"])._redact_processor,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(file=sink),
    )
    log = structlog.get_logger("test")
    log.info("provider call", api_key="short")

    body = json.loads(sink.getvalue())
    assert body["api_key"] == "[redacted]"
