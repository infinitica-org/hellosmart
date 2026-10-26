# HelloSmart Database Seed Guide (`pnpm db:seed`)

> [!WARNING] > **DEVELOPMENT & TESTING FIXTURES ONLY**  
> All credentials, tokens, and seed entities documented here and inserted by the seed engine are strictly intended for local development, automated integration testing, and CI/CD validation. **Never execute the seed command or use these credentials in staging or production environments.**

---

## 1. Prerequisites

Before running the seed command, verify that your local environment satisfies the following requirements:

1. **Runtimes & Package Managers**:
   - Node.js: `>= 22.11.0` (as defined in root `package.json`)
   - pnpm: `>= 9.12.0` (`pnpm@9.12.3`)
2. **Local PostgreSQL Running**:
   - Start the local infrastructure container stack via:
     ```bash
     pnpm infra:up
     # or: docker compose up -d
     ```
   - Standard local PostgreSQL port forwarded is **`5434`** (via `docker-compose.override.yml`) or standard `5432`.
3. **Environment Variables Configured**:

   - Ensure `.env` and `.env.local` files exist in the repo root (copied from `.env.example` and `.env.local.example`).
   - Example `.env` configuration:
     ```env
     NODE_ENV=development
     DATABASE_URL=postgres://hs_app:hs_app_local@localhost:5434/hellosmart
     DATABASE_MIGRATOR_URL=postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart
     ```
   - Example `.env.local` configuration (uncommitted, local dev credentials):

     ```env
     # Shared local test password used to generate Argon2id hashes for loginable accounts (uncommitted)
     SEED_DEFAULT_PASSWORD=

     # Base32 TOTP secret for local testing of Platform Admin MFA (RFC 4648 Base32: A-Z, 2-7, uncommitted)
     SEED_PLATFORM_ADMIN_TOTP_SECRET=
     ```

4. **Database Schema Migrated**:
   - The foundation migration ([`packages/contracts/db/migrations/0001_tenancy_foundation.sql`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/packages/contracts/db/migrations/0001_tenancy_foundation.sql)) must be applied. On Docker startup, this is automatically initialized from `/docker-entrypoint-initdb.d`.

---

## 2. Running the Seed Command

From the root of the repository, execute:

```bash
# Standard seed execution (zero secrets or raw tokens in logs)
pnpm db:seed

# Print raw invitation tokens and links for local browser testing:
pnpm db:seed -- --show-tokens
```

> [!NOTE]
> The `--show-tokens` flag is strictly prohibited in CI environments (`CI=true` or common CI variables) and will abort with a non-zero exit code if detected. Raw tokens are stored locally in the gitignored file `packages/fixtures/.seed-tokens.local.json`.

### Expected Output

Upon successful execution, the CLI runner displays the connection target (host and database name only, never credentials), progress per entity phase, and a clean formatted summary table:

```
Connecting to local test database at localhost:5434 (hellosmart)...
Upserted 1 platform admin(s) (superadmin@hellosmart.ai)
Upserted 3 organization(s) and 3 entitlement record(s)
Upserted 3 company admin(s)
Upserted 110 candidate(s)
Upserted 3 candidate invitation token(s) (valid, expired, used)
Seed completed successfully: 123 total records processed.

================ HelloSmart Seed Summary ================
┌─────────┬────────────────────────────────────────────┬─────────────┬─────────┐
│ (index) │ Entity                                     │ Status      │ Count   │
├─────────┼────────────────────────────────────────────┼─────────────┼─────────┤
│ 0       │ 'Organizations (app.organizations)'        │ 'Upserted'  │ 3       │
│ 1       │ 'Entitlements (app.entitlements)'          │ 'Upserted'  │ 3       │
│ 2       │ 'Platform Admins (app.users)'              │ 'Upserted'  │ 1       │
│ 3       │ 'Company Admins (app.users)'               │ 'Upserted'  │ 3       │
│ 4       │ 'Candidates (app.users)'                   │ 'Upserted'  │ 110     │
│ 5       │ 'Candidate Invitations (app.invitations)'  │ 'Upserted'  │ 3       │
│ 6       │ '────────────────────────────────────────' │ '────────'  │ '─────' │
│ 7       │ 'Grand Total'                              │ 'Processed' │ 123     │
└─────────┴────────────────────────────────────────────┴─────────────┴─────────┘
Target Database : localhost:5434 / hellosmart
Execution Time  : ~1150ms
Status          : Seed Completed Successfully (Idempotent)
=========================================================
```

### Record Count Breakdown: 123 Enterprise Seed Records

| Entity Group              | Count   | Purpose & Details                                                                                                                                                                                                                                           |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organizations**         | **3**   | Aster Ridge Technologies (`paid_active`), Brindle & Co (`trial_active`), and Crestview Financial (`suspended` negative sample).                                                                                                                             |
| **Entitlements**          | **3**   | Quota definitions, feature flags (`cloud`, `chat`), and trial window (14 days).                                                                                                                                                                             |
| **Platform Admins**       | **1**   | `superadmin@hellosmart.ai` with MFA enabled (`mfa_secret_ref`, `$SEED_PLATFORM_ADMIN_TOTP_SECRET`).                                                                                                                                                         |
| **Company Admins**        | **3**   | `admin@asterridge.com` (Aster Ridge), `trialadmin@brindle.co` (Brindle & Co), and `admin@crestview.test` (Crestview Financial negative test sample).                                                                                                        |
| **Candidates**            | **110** | **Aster Ridge**: 100 candidates (full quota capacity test: 70 active, 15 invited, 10 suspended, 5 deleted).<br>**Brindle & Co**: 10 candidates (full trial cap test: 4 active, 3 invited, 1 suspended, 2 deleted). Includes designated loginable candidate. |
| **Candidate Invitations** | **3**   | Candidate onboarding tokens: 1 valid (72h expiry), 1 expired (-24h), 1 used (`used_at` set).                                                                                                                                                                |
| **GRAND TOTAL**           | **123** | **123 persistent records across 4 tenant-isolated tables.**                                                                                                                                                                                                 |

---

## 3. Seed Verification & Data Integrity Checks (`pnpm db:verify-seed`)

To independently verify that the seeded database satisfies all schema constraints, tenant scoping rules, foreign key relationships, and security invariants, execute:

```bash
# Run verification checks against the local database (includes double-seed idempotency check by default)
pnpm db:verify-seed

# Run verification skipping the double-seed idempotency check
pnpm db:verify-seed -- --skip-idempotency

# Run verification restricting the password check to designated loginable accounts
pnpm db:verify-seed -- --loginable-only-hashes
```

### Verification Checks Performed

The verification runner connects using the schema owner role (`DATABASE_MIGRATOR_URL`) and evaluates 12 comprehensive integrity gates:

1. **Environment Safety Guard**: Pre-flight verification that `NODE_ENV` is non-production and target database is local.
2. **Database Connectivity & Role**: Asserts successful connection to PostgreSQL and verifies the executing user context (`hs_migrator`).
3. **Table Record Counts**: Asserts exact row counts for `app.organizations` (3), `app.entitlements` (3), `app.users` (114), and `app.invitations` (3), matching the 123 total.
4. **User Role & Status Distribution**: Asserts exact breakdown across roles and statuses (78 active, 18 invited, 11 suspended, 7 deleted).
5. **Tenant Scoping & Foreign Keys**: Verifies all 113 tenant users have valid `org_id` foreign keys, platform admin has `org_id IS NULL`, and invitations match user organization context.
6. **Active User Password Hashes**: Verifies that all 78 active users (platform admin, 3 company admins, and 74 candidates) have valid Argon2id password hashes ($64\text{ MB}$, $3$ iterations, parallelism $1$), sharing a single seed-computed hash for sub-3-second seed performance.
7. **Platform Admin MFA Configuration**: Verifies `mfa_secret_ref` is populated and contains a Secrets Manager reference rather than a raw plaintext Base32 secret. (Note: AES-256-GCM decryption is not checked because S0-T14-3 does not exist yet).
8. **Entitlements & Trial Windows**: Verifies 1:1 entitlement mapping with organizations and valid trial deadlines.
9. **Invitations State & Token Hashes**: Verifies exactly 1 valid, 1 expired, and 1 used invitation, each storing a 64-character hexadecimal SHA-256 digest (`token_hash`).
10. **Soft-Deletion Invariants**: Asserts that `status = 'deleted'` users have `deleted_at` timestamps populated while active users have `null`.
11. **Plaintext Secret & Pattern Scan**: Scans all text columns across all tables to guarantee zero plaintext passwords (`$SEED_DEFAULT_PASSWORD`), TOTP secrets, or leaked tokens are stored.
12. **Seed Idempotency & Run Timing**: Runs by default (skippable via `--skip-idempotency`). Re-runs the seed programmatically, benchmarks execution times (asserting $< 3.0\text{ s}$ SLA), and asserts that exactly zero extra rows were created.

### Expected Verification Output

```text
================ HelloSmart Seed Verification ================
┌─────────┬────────────────────────────────────┬────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ Check                              │ Status │ Details                                                                                                                     │
├─────────┼────────────────────────────────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'Environment Safety Guard'         │ 'PASS' │ "Environment 'development', local target host 'localhost:5434' verified"                                                    │
│ 1       │ 'Database Connectivity & Role'     │ 'PASS' │ "Connected to localhost:5434/hellosmart as role 'hs_migrator'"                                                              │
│ 2       │ 'Table Record Counts'              │ 'PASS' │ '123 records total (3 orgs, 3 ents, 114 users, 3 invs)'                                                                     │
│ 3       │ 'User Role & Status Distribution'  │ 'PASS' │ '78 active, 18 invited, 11 suspended, 7 deleted'                                                                            │
│ 4       │ 'Tenant Scoping & Foreign Keys'    │ 'PASS' │ 'All tenant records strictly scoped; platform_has_no_org holds; FKs match'                                                  │
│ 5       │ 'Active User Password Hashes'      │ 'PASS' │ 'All 78 active users have non-null Argon2id password_hash'                                                                 │
│ 6       │ 'Platform Admin MFA Configuration' │ 'PASS' │ "Platform admin MFA configured via secret reference 'secrets/seed-superadmin-mfa' (not plain Base32; AES-GCM decryption not  │
│         │                                    │        │  checked because S0-T14-3 does not exist yet)"                                                                              │
│ 7       │ 'Entitlements & Trial Windows'     │ 'PASS' │ '1:1 mapping with orgs, trial_ends_at set for trial_active, valid statuses'                                                 │
│ 8       │ 'Invitations State & Token Hashes' │ 'PASS' │ '1 valid, 1 expired, 1 used; all tokens are 64-hex SHA-256 digests'                                                         │
│ 9       │ 'Soft-Deletion Invariants'         │ 'PASS' │ 'Deleted users have deleted_at populated; active users have deleted_at null'                                                │
│ 10      │ 'Plaintext Secret & Pattern Scan'  │ 'PASS' │ 'Zero plaintext passwords, TOTP secrets, or leaked tokens detected (verified against local raw tokens)'                     │
│ 11      │ 'Seed Idempotency & Run Timing'    │ 'PASS' │ 'Run 1: 918ms, Run 2: 1019ms (0 extra rows)'                                                                                │
└─────────┴────────────────────────────────────┴────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Target Database : localhost:5434 / hellosmart
Execution Time  : ~2000ms
Status          : Verification Passed (All checks OK)
==============================================================
```

---

## 4. Idempotency & Safe Re-runs

The seed engine is **100% idempotent**:

- **Deterministic UUIDv5**: All record IDs are computed via UUIDv5 from fixed category namespaces and normalized identifiers (e.g. `deterministicUuid('user', email)`).
- **Zero Duplicate Rows**: Re-running `pnpm db:seed` produces **0 extra rows**.
- **Preserved State**:
  - `created_at` timestamps on existing organizations, entitlements, and users are never overwritten on conflict.
  - `used_at` timestamps on redeemed candidate invitation tokens are preserved on conflict.
  - `password_hash` values are verified against `SEED_DEFAULT_PASSWORD` and preserved without expensive re-hashing on rerun.
- **Outdated Data Migration**: If an existing development database contains outdated records with different UUIDs for the same slug or email (e.g., from older prototypes), the engine cleans up the stale records automatically and establishes the deterministic UUID hierarchy cleanly.

### Resetting Database State (Optional)

To start with a completely fresh, empty database:

```bash
# Tear down database container and delete persistent volume
docker compose down -v

# Start infrastructure fresh with auto-applied migrations
pnpm infra:up

# Re-run the seed command
pnpm db:seed
```

---

## 4. Environment Safety Guard

To prevent catastrophic data corruption, `packages/fixtures/src/lib/guard.ts` executes **pre-flight checks before any database connection is opened**:

1. **Production Environment Lock**:
   - Execution is fatally blocked if `NODE_ENV` is set to `production` or `prod`.
2. **Localhost Allowlist Only**:
   - The database hostname parsed from `DATABASE_URL` must belong to the approved local host allowlist:
     - `localhost`
     - `127.0.0.1`
     - `::1`
     - `host.docker.internal`
3. **Password & Credential Masking**:
   - Error messages, logs, and stack traces are filtered through `maskSensitiveData()` to ensure raw passwords, tokens, and credentials are never exposed.

### Sample Guard Block Output

If an engineer accidentally invokes the seed script with a non-local connection string:

```
🚫 DATABASE SEED BLOCKED BY SAFETY GUARD
Target Host : aws-rds.internal.example.com:5432
Environment : development
Reason      : SECURITY FATAL: Database host 'aws-rds.internal.example.com' is non-local and not in the approved local host allowlist. Execution blocked.

Seeding in production or against non-local database hosts is strictly forbidden.
```

---

## 5. Sample Emails & Credentials

For full credential details, passwords, and candidate distribution tables, see the [HelloSmart Fixture Matrix](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/docs/seed/fixture-matrix.md).

### Quick Reference:

| Persona                                    | Email                                               | Password Hash                    | Role / Classification | Notes                                                                              |
| ------------------------------------------ | --------------------------------------------------- | -------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| **Platform Super Admin**                   | `superadmin@hellosmart.ai`                          | Hash of `$SEED_DEFAULT_PASSWORD` | **Loginable**         | MFA Enabled (`mfa_secret_ref`, `$SEED_PLATFORM_ADMIN_TOTP_SECRET`)                 |
| **Aster Ridge Company Admin**              | `admin@asterridge.com`                              | Hash of `$SEED_DEFAULT_PASSWORD` | **Loginable**         | Mature paid tenant administrator (`paid_active`)                                   |
| **Brindle & Co Company Admin**             | `trialadmin@brindle.co`                             | Hash of `$SEED_DEFAULT_PASSWORD` | **Loginable**         | Active 14-day trial administrator (`trial_active`)                                 |
| **Active Candidates (74 total)**           | `candidate.aster-ridge.*`, `candidate.brindle-co.*` | Hash of `$SEED_DEFAULT_PASSWORD` | Active Pool           | All 74 active candidates share a single precomputed seed Argon2id hash             |
| **Suspended Candidate (Negative Sample)**  | `candidate.aster-ridge.086@example.com`             | Hash of `$SEED_DEFAULT_PASSWORD` | **Negative Sample**   | Valid password credentials; rejected at login due to user `status = 'suspended'`   |
| **Deleted Candidate (Negative Sample)**    | `candidate.aster-ridge.096@example.com`             | Hash of `$SEED_DEFAULT_PASSWORD` | **Negative Sample**   | Valid password credentials; rejected at login due to soft-deletion (`deleted_at`)  |
| **Crestview Admin (Suspended Org Sample)** | `admin@crestview.test`                              | Hash of `$SEED_DEFAULT_PASSWORD` | **Negative Sample**   | Valid password credentials; rejected at login due to tenant `status = 'suspended'` |
| **Invited Candidates (18 total)**          | `candidate.aster-ridge.071@example.com`, etc.       | `null` (Pending Reset)           | Onboarding Testing    | Must complete first-login onboarding & password reset via invite token (`BR-24`)   |
| **Other Suspended/Deleted Candidates**     | `candidate.*` (bulk suspended/deleted)              | `null`                           | Inactive Sample Pool  | Non-sample suspended/deleted candidates retain NULL hash                           |

### Setting Up Platform Admin TOTP in Authenticator Apps

To test Platform Admin login with two-factor authentication locally:

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Set `SEED_PLATFORM_ADMIN_TOTP_SECRET` to a valid RFC 4648 Base32 key (e.g. `JBSWY3DPEHPK3PXP`).
3. Add the key manually to your authenticator app (Google Authenticator, 1Password, etc.) as a Time-based (TOTP) account.
4. **Never print, commit, or log the TOTP secret string or an `otpauth://` URI.**

---

## 6. Running the Fixture Test Suite

To run all automated fixture unit and integration tests:

```bash
# Run all fixture package tests (entities, guard, masking, upsert, invitations, seed)
pnpm --filter @hs/fixtures test

# Run type check and lint
pnpm --filter @hs/fixtures typecheck
pnpm lint
```

---

## 7. Troubleshooting

### 1. `ECONNREFUSED 127.0.0.1:5434` (Database Not Running)

- **Symptom**: `connect ECONNREFUSED 127.0.0.1:5434`
- **Fix**: Start the Docker container stack via `pnpm infra:up` or `docker compose up -d` and wait for the postgres container to reach a healthy status.

### 2. `DATABASE_URL is not set`

- **Symptom**: `Missing database connection string. Please set DATABASE_URL or DATABASE_MIGRATOR_URL.`
- **Fix**: Create a `.env` file in the repo root by copying `.env.example`:
  ```bash
  cp .env.example .env
  ```

### 3. `DATABASE SEED BLOCKED BY SAFETY GUARD`

- **Symptom**: Script exits with code 1 and prints `🚫 DATABASE SEED BLOCKED BY SAFETY GUARD`.
- **Fix**: Check `NODE_ENV` (ensure it is `development` or `test`) and verify that `DATABASE_URL` specifies `localhost` or `127.0.0.1` rather than a remote server.

### 4. `relation "app.organizations" does not exist`

- **Symptom**: Table missing error during seed run.
- **Fix**: Ensure PostgreSQL database migrations are applied before running the seed script:
  ```bash
  pnpm infra:up
  ```
