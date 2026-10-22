# 0002: Tenant isolation via Postgres RLS + application scoping

**Status:** Accepted · 2026-10-22

## Context
BR-01 makes cross-tenant leakage the worst possible failure. Agent-written code increases the chance that a query forgets a `WHERE org_id = …`.

## Decision
- Every tenant table has `org_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, and a `tenant_isolation` policy on `app.current_org_id()`.
- Runtime DB role `hs_app` is `NOBYPASSRLS`. Migrations run as `hs_migrator`; the app never has DDL rights.
- API sets `app.org_id` per transaction via `withOrg()` from the authenticated session only.
- Platform cross-org access uses `app.is_platform`, set only by `withPlatform()`, and always audits.
- Cache keys, S3 prefixes, SSM paths and queue messages all carry `orgId`.
- CI cross-tenant suite runs against real Postgres with RLS on.

## Consequences
+ Two independent layers must both fail for a leak.
− Connection pooling must use transaction-scoped settings (`set_config(..., true)`); no session-level state.
