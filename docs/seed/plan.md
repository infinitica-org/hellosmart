# Implementation Plan: Seed Data for HelloSmart.ai

Companion to `PRD.md`, `fixture-matrix.md`, and `seed-data.md`.

---

## Guiding Principles

1. **Declarative fixtures, generic loader:** Fixture definitions live in dedicated data files; the loader logic handles orchestration, natural-key matching, hashing, and reporting.
2. **Natural keys & determinism:**
   - Organizations: `slug`
   - Platform Admin: `email` (where `org_id IS NULL`)
   - Company Admin & Candidate: `(org_id, email)`
   - Entitlements: `org_id`
   - Deterministic UUIDs via UUIDv5 with a fixed namespace.
3. **Real database layer & constraints:** Follow PostgreSQL RLS rules, role checks (`platform_admin`, `company_admin`, `candidate`), and argon2id hashing.
4. **Safety & Zero Duplicates:** Refuse production environments, refuse non-seed email collisions, and guarantee 0 created rows on reruns.

---

## Phase 0: Discovery & Alignment (Completed)

- Verified stack: TypeScript, pnpm monorepo, NestJS, Fastify, Drizzle ORM, `pg` client, PostgreSQL 16 with RLS.
- Verified tables: `app.organizations`, `app.entitlements`, `app.users`, `audit.events`.
- Identified status checks:
  - `app.organizations.status IN ('provisioned', 'trial_active', 'trial_expired', 'paid_active', 'suspended')`
  - `app.users.status IN ('invited', 'active', 'suspended', 'deleted')`
  - `app.users.role IN ('platform_admin', 'company_admin', 'candidate')`
- Confirmed hashing algorithm: `@node-rs/argon2` argon2id (`m=19456, t=2, p=1`).

---

## Phase 1: Working Slice 1 (Orgs & Users)

**Goal:** Scaffolding, safety guards, upsert engine, and seeding the 2 organizations + users.

### 1. Structure in `packages/fixtures`:

```
packages/fixtures/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # Entry point (CLI runner: pnpm db:seed)
│   ├── config.ts               # Env loading & safety guard
│   ├── lib/
│   │   ├── guard.ts            # Production & host allowlist checks
│   │   ├── keys.ts             # Normalization & deterministic UUIDv5 helper
│   │   ├── hasher.ts           # Argon2id password hashing helper
│   │   ├── db.ts               # Database connection (migrator role / admin)
│   │   ├── upsert.ts           # Generic natural-key upsert engine
│   │   └── reporter.ts         # Run summary & table output
│   ├── fixtures/
│   │   ├── platform-admins.ts  # admin_super, admin_support, admin_suspended
│   │   ├── organizations.ts    # aster (paid_active), brindle (trial_active) + entitlements
│   │   ├── company-users.ts    # aster and brindle company admins
│   │   └── candidates.ts       # complete, invited, unverified, pipeline candidates
│   └── loaders/
│       ├── platform-admins.ts
│       ├── organizations.ts
│       ├── company-users.ts
│       └── candidates.ts
```

### 2. Dependency-Ordered Execution Order:

1. **Platform Admin**: `admin_super` must be created first because `app.organizations.created_by` requires a valid platform admin UUID.
2. **Organizations**: `aster` (`paid_active`) and `brindle` (`trial_active`) created with `created_by = admin_super.id`.
3. **Entitlements**: `app.entitlements` records upserted for each organization.
4. **Company Admins**: Users with `role = 'company_admin'` and assigned `org_id`.
5. **Candidates**: Users with `role = 'candidate'` and assigned `org_id`.

### 3. Execution & Verification:

- Run 1 on local DB: Inserts records, prints summary report.
- Run 2 on local DB: Updates 0 rows, inserts 0 rows, all unchanged.

---

## Phase 2: Working Slice 2 (Assessments & Assignments)

**Goal:** Adding Templates, Assessments, and Assignments once migration tables are confirmed.

1. **Templates**: Blueprint tasks assigned privately to organizations (`backend-incident-debug`).
2. **Assessments**: Pinned template versions configured with duration/window timing and AI policies.
3. **Assignments**: Candidates assigned to assessments across pipeline states (`invited` -> `window_not_open` -> `ready` -> `in_progress` -> `disconnected` -> `submitted`).
4. **Submissions & Reviews**: Evidence bundles and AI reviewer agent scoring.
