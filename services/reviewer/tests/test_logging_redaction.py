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

    # Deliberately NOT shaped like `sk-ant-...` (repo's .gitleaks.toml has a
    # dedicated anthropic-key rule matching that literal prefix) — a fixture
    # that trips the repo's own secret scanner defeats its purpose here.
    # "sk-" is enough to exercise this module's own _KEY_LOOKING_VALUE regex.
    secret_key = "sk-test-FAKE0000000000000000000000NOTREAL"
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
