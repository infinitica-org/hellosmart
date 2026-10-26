# HelloSmart AI Developer Life Cycle (AIDLC) Agent Rules

You are an expert AI software engineer pair programming on the **HelloSmart.ai** platform. All code and modifications must adhere strictly to these engineering invariants.

---

## 1. Hierarchy of Authority
1. **Business Rules (BR-01 to BR-33)** in `AGENTS.md`: Inviolable invariants that must NEVER be violated.
2. **Contracts in `packages/contracts`**: The single source of truth for database migrations, OpenAPI 3.1 endpoints, and event schemas.
3. **Internal Documentation in `apps/docs`**: The living, role-protected documentation portal.

---

## 2. Inviolable Security & Tenancy Invariants
- **BR-01 (Tenant Isolation)**: Every query, cache key, and file path must be scoped by `org_id`. Cross-tenant requests must return **HTTP 404 Not Found**, never 403 (to prevent tenant existence leaks).
- **BR-13 (Zero Secret Ingestion in Workspaces)**: Never inject real provider API keys (OpenAI, Anthropic) or real cloud credentials into candidate workspaces. All AI calls route through `services/ai-proxy` using short-lived workspace tokens.
- **BR-10 & BR-11 (Workspaces)**: Cloud VM workspaces run in unprivileged Sysbox containers (`sysbox-runc`). Persist work state continuously with RPO <= 30s. Exiting full screen disconnects the session (not destroyed) and shows a resume prompt.
- **BR-31 (Tamper-Evident Audit Log)**: All administrative, destruction, and entitlement changes must write an immutable audit log row with SHA-256 hash chaining.

---

## 3. AIDLC Documentation Synchronization Protocol
Whenever your task touches:
1. **Database Schema or Migrations** (`packages/contracts/db/migrations/` or Drizzle schemas):
   - You MUST update `apps/docs/content/docs/database/db-visualization.mdx` with the updated ER diagrams, table definitions, and indexes.
2. **OpenAPI Contracts or Endpoints** (`packages/contracts/openapi/openapi.yaml`):
   - You MUST update `apps/docs/content/docs/api/overview.mdx` with the endpoint documentation, request/response payloads, and auth requirements.
3. **Architecture or Services** (`apps/`, `services/`, `infra/`):
   - You MUST update `apps/docs/content/docs/architecture/system-architecture.mdx` and `frameworks-and-versions.mdx`.
4. **Validation Check**:
   - Always execute `pnpm docs:sync-check` before completing your work. Documentation drift will cause CI and pre-commit checks to fail.

---

## 4. Standard Commands
```bash
# Verify documentation synchronization
pnpm docs:sync-check

# Run tests
pnpm test
pnpm test:tenancy

# Run type checking
pnpm typecheck

# Start local documentation server
pnpm docs:dev
```
