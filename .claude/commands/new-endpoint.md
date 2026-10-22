Implement the API endpoint for operationId $ARGUMENTS exactly as defined in `packages/contracts/openapi/openapi.yaml`.

Follow `apps/api/CLAUDE.md`: controller → service → repository, DTOs from `@hs/contracts` Zod schemas, `@Roles()` guard, `withOrg()` scoping, `audit.record()` for BR-31 actions, `Idempotency-Key` for mutations.

Required tests: happy path, validation failure, RBAC denial for every other role, cross-tenant 404 (`test(BR-01): ...`), audit entry written (if BR-31). Run `pnpm --filter @hs/api test` before finishing.
