# apps/api: NestJS (Core Backend)

Fastify adapter, modular monolith. One folder per bounded context in `src/modules/`.

## Layering
`controller` (HTTP, DTO from `@hs/contracts`, guards) → `service` (rules, entitlements, audit) → `repository` (SQL via Drizzle, always inside `withOrg`).

## Security patterns (mandatory)
- Guards on every route: `SessionGuard` → `RolesGuard(@Roles(...))` → `OrgScopeGuard`. A route without `@Roles` fails the lint rule.
- `org_id` comes from the session only. Cross-org lookups return **404**.
- Platform-admin cross-org reads use `withPlatform()` and write an audit entry.
- Mutations require `Idempotency-Key` (stored 24 h in Redis, keyed by org + user + key).
- Errors are RFC 9457 problem+json with a stable `code`; no stack traces, SQL or secrets.
- Logger (pino) redacts `authorization`, `cookie`, `password`, `*key*`, `*secret*`, `*token*`.
- Passwords: argon2id (m=19456, t=2, p=1). Login throttle: 5/min/IP+email, lockout 15 min after 10 failures.
- Sessions: opaque ID in Redis, HttpOnly + Secure + SameSite=Lax cookie, rotated on login and privilege change, idle 30 min (admin 15 min).
- Outbound HTTP only through `@hs/adapters` http client (SSRF allowlist).

## Tests
- Vitest + Testcontainers Postgres. `test/tenancy/` runs against the real RLS policies.
- Every endpoint: happy, validation, RBAC per role, cross-tenant 404, audit (if BR-31).
