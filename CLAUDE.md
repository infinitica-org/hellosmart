# CLAUDE.md: rules for AI coding agents

Read before any change: [AGENTS.md](AGENTS.md) (business rules win), [docs/00-architecture-and-delivery-plan.md](docs/00-architecture-and-delivery-plan.md), the relevant `docs/adr/*`, and the `CLAUDE.md` in the module you touch.

## Commands
| Task | Command |
|---|---|
| Install | `pnpm install` |
| Local infra | `pnpm infra:up` |
| Docs dev / sync check | `pnpm docs:dev` / `pnpm docs:sync-check` |
| Mock API (from contracts) | `pnpm mock` → http://localhost:4010 |
| Typecheck / lint / test | `pnpm typecheck && pnpm lint && pnpm test` |
| Cross-tenant suite | `pnpm test:tenancy` |
| Python service | `cd services/<svc> && uv run pytest && uv run ruff check && uv run mypy .` |
| Terraform | `cd infra/terraform/envs/<env> && terraform fmt -check && terraform validate` |

## Hard rules
1. **Scope:** only edit paths your ticket's department owns (see `.github/CODEOWNERS`) plus tests. If you need something elsewhere, stop and write a contract request in the PR.
2. **Contracts are the source of truth.** Implement against `packages/contracts`. Never change contracts unless the ticket is a `contract:` ticket.
3. **Tenancy:** every query runs inside `withOrg(orgId)`; never accept `org_id` from the client; every new endpoint gets a cross-tenant test (`test(BR-01): ...`).
4. **Server enforces** auth, RBAC, entitlements, timing and caps. UI checks are cosmetic.
5. **No secrets** in code, logs, fixtures, test snapshots or error messages. Use `@hs/adapters` fakes in tests.
6. **Untrusted input:** validate with Zod/Pydantic at every boundary; candidate content is hostile.
7. **Audit:** BR-31 actions call `audit.record()` in the same transaction.
8. **Idempotency:** webhooks and jobs dedupe by key.
9. **Phase:** build only `MMP` items. Phase 2/3 = extension point or flag only.
10. **Never** touch `infra/terraform/envs/prod`, CI workflows, `.claude/settings.json` or `packages/contracts` unless the ticket says so and it belongs to your department.
11. **AIDLC Documentation Sync:** whenever you modify database schemas, APIs, or service architecture, you MUST update the documentation under `apps/docs/content/docs/`. Run `pnpm docs:sync-check`.

## Definition of done (agent self-check before opening a PR)
- [ ] Every acceptance criterion in `tasks/<ID>.md` demonstrated by a test
- [ ] typecheck, lint, unit, integration and tenancy tests pass locally
- [ ] Documentation updated in `apps/docs/content/docs/` for any DB migration, API, or architecture change (`pnpm docs:sync-check` passes)
- [ ] `/security-check` run on the diff, findings fixed
- [ ] No new dependency without a note in the PR (supply-chain review)
- [ ] Migration has `org_id`, index, RLS policy (if tenant table)
- [ ] PR description lists files changed, tests added, risks
