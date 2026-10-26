from __future__ import annotations

from ws_agent.redact import REDACTED, redact


def test_aws_access_key_id_is_redacted() -> None:
    text = "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
    assert "AKIAIOSFODNN7EXAMPLE" not in redact(text)


def test_aws_secret_key_assignment_is_redacted() -> None:
    text = "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    result = redact(text)
    assert "wJalrXUtnFEMI" not in result
    assert REDACTED in result


def test_github_pat_is_redacted() -> None:
    token = "ghp_" + "a1b2c3d4e5" * 4  # 40 chars after the prefix, real PATs are 36+
    text = f"git remote set-url origin https://{token}:x@github.com/x/y"
    assert token not in redact(text)


def test_anthropic_style_api_key_is_redacted() -> None:
    text = "export ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890"
    assert "sk-ant-api03" not in redact(text)


def test_private_key_block_is_redacted() -> None:
    text = (
        "-----BEGIN RSA PRIVATE KEY-----\n"
        "MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEA\n"
        "-----END RSA PRIVATE KEY-----"
    )
    result = redact(text)
    assert "MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEA" not in result


def test_generic_password_assignment_is_redacted() -> None:
    text = "DATABASE_PASSWORD=sup3rS3cretValue123"
    result = redact(text)
    assert "sup3rS3cretValue123" not in result


def test_ordinary_terminal_output_is_unchanged() -> None:
    text = "pytest -q\n5 passed in 0.3s\n"
    assert redact(text) == text


def test_short_benign_assignment_is_left_alone() -> None:
    """The password/secret/token pattern requires 6+ characters after the `=` -- a short,
    clearly-non-secret value like a boolean flag should not be treated as a leaked credential."""
    text = "DEBUG_TOKEN=1"
    assert redact(text) == text
