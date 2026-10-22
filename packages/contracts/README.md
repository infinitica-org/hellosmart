# @hs/contracts

The single source of truth every department builds against. Owned by **Architecture & Platform**.

| Path | What |
|---|---|
| `openapi/openapi.yaml` | REST API (OpenAPI 3.1). `x-requirement` and `x-roles` on every operation. |
| `src/` | Zod schemas + generated types (`pnpm generate`) |
| `events/` | Queue/EventBridge event envelope + types |
| `db/migrations/` | SQL migrations (RLS pattern in `0001`) |
| `db/init/` | Local DB role bootstrap |

## Rules
- Frozen **Fri 30 Oct 2026**. After that: additive changes only; breaking = ADR.
- Contract change requests answered by Architecture within 4 working hours.
- Every tenant table follows the RLS pattern in `0001_tenancy_foundation.sql`.
- Every operation declares `x-roles`; the API's guard and the cross-tenant suite are generated from it.
- `pnpm mock` serves the spec on :4010 so frontend never waits for backend.
