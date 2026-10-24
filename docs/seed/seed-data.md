# Seed Data Documentation (HelloSmart)

**Status:** Aligned with codebase (`packages/contracts/db/migrations/0001_tenancy_foundation.sql`, `AGENTS.md`, and `packages/contracts/openapi/openapi.yaml`).

## 1. Purpose

A single, repeatable set of deterministic, fictional test data for HelloSmart.ai local development, automated testing (unit, tenancy, E2E), QA, and demo presentations.

Every developer and CI runner can load it in one command and achieve an identical, reproducible database state. It contains no real people, real companies, real emails, or real credentials.

---

## 2. What Gets Seeded

| Domain Group        | Real Schema Table                    | Seed Count | Contents                                                                                                                                                          |
| ------------------- | ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organizations**   | `app.organizations`                  | **2**      | 2 fictional companies: **Aster Ridge Technologies** (`paid_active`, mature, full flags) and **Brindle & Co. Logistics** (`trial_active`, new, restricted)         |
| **Entitlements**    | `app.entitlements`                   | **2**      | Per-org limits and feature flags (Aster: 5 templates / 25 candidates; Brindle: 1 template / 5 candidates)                                                         |
| **Platform Admins** | `app.users` (role: `platform_admin`) | **3**      | `admin_super` (creator of orgs), `admin_support`, `admin_suspended` (`org_id IS NULL` enforced by check constraint)                                               |
| **Company Users**   | `app.users` (role: `company_admin`)  | **11**     | 8 Aster admins (`owner`, `admin2`, `hm`, `invited`, `suspended`, `deactivated`, `unverified`, `locked`) + 3 Brindle admins (`owner`, `admin2`, `invited_expired`) |
| **Candidates**      | `app.users` (role: `candidate`)      | **19**     | 10 standalone/edge-case candidates + 2 multi-tenant candidates + 7 pipeline state candidates (`invited` through `submitted`)                                      |
| **TOTAL**           |                                      | **37**     | Full dataset seeded in 1 pass; strictly idempotent on reruns                                                                                                      |

> [!NOTE]
> Templates, assessments, assignments, and reviews exist currently in `AGENTS.md` spec and `openapi.yaml`, but do not have database migrations yet. They will be seeded in Slice 2 once their respective tables are migrated.

---

## 3. How to Run

Seeding is run via `pnpm` through the `@hs/fixtures` package:

```bash
# Full seed
pnpm db:seed

# Or via package directly:
pnpm --filter @hs/fixtures seed

# Dry run: preview planned changes without writing to DB
pnpm --filter @hs/fixtures seed --dry-run

# Partial seed: seed only specific entity groups
pnpm --filter @hs/fixtures seed --only orgs,users

# Reset: delete ONLY seed-owned records and reseed
pnpm --filter @hs/fixtures seed --reset --yes
```

### Setup:

1. Ensure `.env` is configured (copy from `.env.example`).
2. Set `SEED_DEFAULT_PASSWORD` (dev-only plaintext password used by all seeded user accounts).
3. Set `DATABASE_URL` (e.g. `postgres://hs_app:hs_app_local@localhost:5432/hellosmart` or `DATABASE_MIGRATOR_URL=postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart`).
4. Ensure local database is up (`pnpm infra:up`).

---

## 4. Naming Conventions & Identifiers

- **Domain Isolation:** All fixture emails end with `@seed.example.test` or `@<company>.seed.example.test`. The `.test` top-level domain is reserved by IETF RFC 2606 and never resolves on the internet.
- **Websites & Domains:** Use `.example.test` or `.test` domains (e.g. `https://aster.example.test`).
- **Fixture Keys:** Every fixture has a permanent, unique key (e.g. `admin_super`, `aster_owner`, `cand_complete`). Automated tests reference fixtures by their key or email, never by raw auto-increment IDs.
- **Deterministic IDs:** UUIDs are generated deterministically using UUIDv5 from a fixed project namespace and fixture key.

---

## 5. Idempotency & Upsert Strategy

The seed script is strictly **idempotent**:

- Every entity matches against its database natural key:
  - `app.organizations`: natural key `slug` (`citext`).
  - `app.entitlements`: natural key `org_id` (`uuid`).
  - `app.users` (`platform_admin`): natural key `email` (`citext` where `org_id IS NULL`).
  - `app.users` (`company_admin` & `candidate`): natural key `(org_id, email)` (`citext` scoped by `org_id`).
- When a record already exists:
  - Fields are compared. If values are identical, no write occurs (preventing `updated_at` churn).
  - If values differ on seed-owned fields, the record is updated to the defined state.
  - If a record exists with the key but is **not** a seed record (does not match `@seed.example.test` or seed slug), the runner aborts immediately with a clear error to prevent hijacking non-seed data.
- Running the seed twice produces **0 created records** on the second run.

---

## 6. Security & Safety Rules

- **Environment Guard:** The runner refuses to run if `NODE_ENV === 'production'`.
- **Database Host Allow-List:** Only allows localhost / dev hosts (`localhost`, `127.0.0.1`, `postgres`).
- **Remote Host Protection:** Any non-localhost DB requires an explicit `--confirm-remote` flag, and prints the target database hostname and database name before executing.
- **Password Hashing:** Passwords are never stored in plain text and never hardcoded in repository code. Plaintext password is read from `SEED_DEFAULT_PASSWORD` and hashed using HelloSmart's standard hasher (`@node-rs/argon2` argon2id: `m=19456, t=2, p=1`).
- **Tenancy Enforcement:** Respects PostgreSQL Row Level Security (RLS) rules (`0001_tenancy_foundation.sql`). Seeding runs with administrative/platform privileges to provision organizations and cross-tenant seed data.

---

## 7. Side Effects Suppression

During seed execution:

- Outbound emails are disabled or mocked using `@hs/adapters` `fake` email sender.
- External webhooks and third-party API calls are bypassed.
- No background workers or queue tasks are triggered without explicit flags.

---

## 8. Dates & Time

- All timestamps are UTC (`timestamptz`).
- Relative dates are calculated relative to `SEED_REFERENCE_DATE` (e.g. `ref - 14d`, `ref + 30d`).
- Expired records (such as past windows or expired invitations) use fixed past timestamps so they remain deterministically expired across runs.
