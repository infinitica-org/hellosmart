"""Workspace session tokens (BR-13).

Short-lived (<= session deadline, max 8 h), audience-bound, signed by the API with a KMS-backed
key. One token is valid for exactly one workspace; a revoked workspace is rejected via a Redis
denylist checked on every request.
"""

from dataclasses import dataclass

import jwt

AUDIENCE = "hs-ai-proxy"
ALGORITHMS = ["ES256"]


@dataclass(frozen=True)
class WorkspaceClaims:
    workspace_id: str
    org_id: str
    assignment_id: str
    policy_version: int


class TokenError(Exception):
    """Raised for any invalid token; message is safe to return to the client."""


def verify_workspace_token(token: str, public_key: str) -> WorkspaceClaims:
    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=ALGORITHMS,
            audience=AUDIENCE,
            options={"require": ["exp", "iat", "sub", "aud", "org", "asg", "pv"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError("invalid workspace token") from exc
    return WorkspaceClaims(
        workspace_id=claims["sub"],
        org_id=claims["org"],
        assignment_id=claims["asg"],
        policy_version=int(claims["pv"]),
    )
