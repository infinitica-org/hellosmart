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
   - Ensure a `.env` file exists in the repo root (copied from `.env.example`).
   - Example configuration:
     ```env
     NODE_ENV=development
     DATABASE_URL=postgres://hs_app:hs_app_local@localhost:5434/hellosmart
     DATABASE_MIGRATOR_URL=postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart
     ```
4. **Database Schema Migrated**:
   - The foundation migration ([`packages/contracts/db/migrations/0001_tenancy_foundation.sql`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/packages/contracts/db/migrations/0001_tenancy_foundation.sql)) must be applied. On Docker startup, this is automatically initialized from `/docker-entrypoint-initdb.d`.

---

## 2. Running the Seed Command

From the root of the repository, execute:

```bash
pnpm db:seed
```

### Expected Output

Upon successful execution, the CLI runner displays the connection target (host and database name only, never credentials), progress per entity phase, and a clean formatted summary table:

```
Connecting to local test database at localhost:5434 (hellosmart)...
Upserted 1 platform admin(s) (superadmin@hellosmart.ai)
Upserted 2 organization(s) and 2 entitlement record(s)
Upserted 2 company admin(s)
Upserted 110 candidate(s)
Upserted 3 candidate invitation token(s) (valid, expired, used)
Seed completed successfully: 120 total records processed.

================ HelloSmart Seed Summary ================
┌─────────┬────────────────────────────────────────────┬─────────────┬─────────┐
│ (index) │ Entity                                     │ Status      │ Count   │
├─────────┼────────────────────────────────────────────┼─────────────┼─────────┤
│ 0       │ 'Organizations (app.organizations)'        │ 'Upserted'  │ 2       │
│ 1       │ 'Entitlements (app.entitlements)'          │ 'Upserted'  │ 2       │
│ 2       │ 'Platform Admins (app.users)'              │ 'Upserted'  │ 1       │
│ 3       │ 'Company Admins (app.users)'               │ 'Upserted'  │ 2       │
│ 4       │ 'Candidates (app.users)'                   │ 'Upserted'  │ 110     │
│ 5       │ 'Candidate Invitations (app.invitations)'  │ 'Upserted'  │ 3       │
│ 6       │ '────────────────────────────────────────' │ '────────'  │ '─────' │
│ 7       │ 'Grand Total'                              │ 'Processed' │ 120     │
└─────────┴────────────────────────────────────────────┴─────────────┴─────────┘
Target Database : localhost:5434 / hellosmart
Execution Time  : 1010ms
Status          : Seed Completed Successfully (Idempotent)
=========================================================
```

### Record Count Breakdown: 37 Prototype Records vs 120 Enterprise Records

| Entity Group              | Prototype (Legacy) | Enterprise Seed (Current) | Purpose & Details                                                                                                                                                                                                  |
| ------------------------- | ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Organizations**         | 2                  | **2**                     | Aster Ridge Technologies (`paid_active`) and Brindle & Co (`trial_active`).                                                                                                                                        |
| **Entitlements**          | 2                  | **2**                     | Quota definitions, feature flags (`cloud`, `chat`), and trial window (14 days).                                                                                                                                    |
| **Platform Admins**       | 3                  | **1**                     | `superadmin@hellosmart.ai` with MFA enabled (`mfa_secret_ref`).                                                                                                                                                    |
| **Company Admins**        | 2                  | **2**                     | `admin@asterridge.com` (Aster Ridge) and `trialadmin@brindle.co` (Brindle & Co).                                                                                                                                   |
| **Candidates**            | 28                 | **110**                   | **Aster Ridge**: 100 candidates (full quota capacity test: 70 active, 15 invited, 10 suspended, 5 deleted).<br>**Brindle & Co**: 10 candidates (full trial cap test: 4 active, 3 invited, 1 suspended, 2 deleted). |
| **Candidate Invitations** | 0                  | **3**                     | Candidate onboarding tokens: 1 valid (72h expiry), 1 expired (-24h), 1 used (`used_at` set).                                                                                                                       |
| **GRAND TOTAL**           | **37**             | **120**                   | **120 persistent records across 4 tenant-isolated tables.**                                                                                                                                                        |

---

## 3. Idempotency & Safe Re-runs

The seed engine is **100% idempotent**:

- **Deterministic UUIDv5**: All record IDs are computed via UUIDv5 from fixed category namespaces and normalized identifiers (e.g. `deterministicUuid('user', email)`).
- **Zero Duplicate Rows**: Re-running `pnpm db:seed` produces **0 extra rows**.
- **Preserved State**:
  - `created_at` timestamps on existing organizations, entitlements, and users are never overwritten on conflict.
  - `used_at` timestamps on redeemed candidate invitation tokens are preserved on conflict.
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

| Persona                        | Email                                   | Dev Password      | Notes                                        |
| ------------------------------ | --------------------------------------- | ----------------- | -------------------------------------------- |
| **Platform Super Admin**       | `superadmin@hellosmart.ai`              | `DevPassword123!` | MFA Enabled (`mfa_secret_ref`)               |
| **Aster Ridge Company Admin**  | `admin@asterridge.com`                  | `DevPassword123!` | Mature paid tenant administrator             |
| **Brindle & Co Company Admin** | `trialadmin@brindle.co`                 | `DevPassword123!` | Active 14-day trial administrator            |
| **Active Candidates**          | `candidate.aster-ridge.001@example.com` | `DevPassword123!` | Ready for immediate login                    |
| **Invited Candidates**         | `candidate.aster-ridge.071@example.com` | _Pending Reset_   | Must reset password on first login (`BR-24`) |

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
