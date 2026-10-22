# 0005: In-house auth instead of Cognito

**Status:** Accepted · 2026-10-22

## Context
Rules: SSO must never create users (BR-04), one master login with role routing, branded login on custom domains, forced reset on first login, MFA for platform admins. Cognito's federated sign-in auto-creates users and is awkward for per-tenant custom domains.

## Decision
NestJS auth module: argon2id, opaque server-side sessions in Redis, TOTP MFA, Google + Microsoft OIDC (PKCE, state, nonce) matched to existing users by verified email only, single-use expiring tokens (hashed at rest) for invites and resets.

## Consequences
+ Exact fit to business rules; no vendor lock.
− We own the security; mitigated by sensitive-path reviews, OWASP ASVS L2 checklist and S6 pen-test.
