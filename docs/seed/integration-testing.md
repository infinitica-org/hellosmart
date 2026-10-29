# HelloSmart Integration Testing & Local Verification Guide

> [!WARNING] > **DEVELOPMENT & TESTING FIXTURES ONLY**  
> All fixtures, seed databases, and test utilities documented here are strictly intended for local development, automated integration testing, and CI validation. **Never execute the seed command or use these test credentials in staging or production environments.**

---

## 1. Overview & Architecture

HelloSmart's integration test suite validates multi-tenant isolation ([`BR-01`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md#L206)), authentication compatibility ([`CO-001`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md#L45)), candidate onboarding & invitation lifecycle ([`S0-T08`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/docs/seed/invitation-api-dependencies.md#L3), [`BR-24`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md#L214)), and database idempotency against a local PostgreSQL instance.

```mermaid
flowchart TD
  subgraph LOCAL["Developer Workstation / CI"]
    ENV[".env & .env.local<br/>(uncommitted secrets)"]
    CLI["pnpm db:seed<br/>pnpm db:verify-seed"]
    TESTS["Integration Tests<br/>(packages/fixtures/test)"]
  end

  subgraph DB["Local PostgreSQL (port 5434)"]
    MIG["Migrations 0001 - 0005<br/>(0004 RLS, 0005 hs_platform)"]
    ROLES["Roles:<br/>hs_owner, hs_migrator, hs_platform, hs_app"]
    DATA["123 Enterprise Seed Records<br/>(3 orgs, 3 ents, 114 users, 3 invs)"]
  end

  subgraph API["HelloSmart Backend (apps/api)"]
    AUTH["AuthService<br/>(Argon2id + TOTP MFA)"]
    INV["InvitationsService<br/>(SHA-256 bytea lookup/accept)"]
    LOG["Observability Hooks<br/>(path & body redaction)"]
  end

  ENV --> CLI
  ENV --> TESTS
  CLI -->|Connects as hs_migrator| DB
  TESTS -->|Tests live services against| DB
  TESTS --> AUTH
  TESTS --> INV
  TESTS --> LOG
```

---

## 2. Local Environment Setup

### 2.1 Runtime & Tooling Prerequisites

- **Node.js**: `>= 22.11.0` (as defined in root `package.json`)
- **pnpm**: `>= 9.12.0` (`pnpm@9.12.3`)
- **Docker & Docker Compose**: Required for local PostgreSQL container stack.

### 2.2 Infrastructure Initialization

1. Start the local database infrastructure:

   ```bash
   pnpm infra:up
   # or: docker compose up -d
   ```

   The local PostgreSQL instance forwards to **`localhost:5434`** (configured via `docker-compose.override.yml`).

2. Apply all database migrations (0001 through 0005):
   ```bash
   pnpm db:migrate
   ```
   Migrations applied:
   - `0001_tenancy_foundation.sql`: Core schemas, organizations, users, and entitlements.
   - `0002_user_status_enums.sql`: User lifecycle status constraints.
   - `0003_invitations.sql`: Candidate invitations schema (`token_hash bytea`, lookup functions).
   - `0004_rls_access_paths.sql`: Stored procedures for login, user lookup, and invitation token search.
   - `0005_platform_role.sql`: `hs_platform` database role and privilege configuration.

### 2.3 Environment Variable Configuration

Ensure `.env` and `.env.local` exist in the repository root:

- **`.env`** (committed or developer defaults):

  ```env
  NODE_ENV=development
  DATABASE_URL=postgres://hs_app:hs_app_local@localhost:5434/hellosmart
  DATABASE_MIGRATOR_URL=postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart
  DATABASE_ADMIN_URL=postgres://hs_owner:hs_owner_local@localhost:5434/hellosmart
  SEED_ALLOWED_DB_HOSTS=localhost,127.0.0.1,postgres
  ```

- **`.env.local`** (strictly uncommitted, developer-specific secrets):

  ```env
  # Password used to compute Argon2id password hashes for loginable test accounts
  SEED_DEFAULT_PASSWORD=YourLocalTestPassword123!

  # Base32 TOTP secret for Platform Admin 2-step MFA verification
  SEED_PLATFORM_ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXP
  PLATFORM_ADMIN_MFA_SECRET=JBSWY3DPEHPK3PXP
  ```

> [!IMPORTANT]
> The database seeder and verification command connect using `DATABASE_MIGRATOR_URL` (role `hs_migrator`), which bypasses PostgreSQL Row-Level Security (RLS) to seed cross-tenant fixtures. Application runtime queries use `DATABASE_URL` (role `hs_app`), which strictly enforces RLS per tenant.

---

## 3. Database Seeding & Verification

### 3.1 Executing the Seed Engine

Run the seed command from the repository root:

```bash
# Standard idempotent execution
pnpm db:seed

# Optional local inspection: print raw tokens (strictly refused in CI)
pnpm db:seed -- --show-tokens
```

- **Idempotency**: Running `pnpm db:seed` multiple times produces **0 duplicate records** and finishes in **~1.0 second**.
- **Security Guard**: Blocks execution immediately if `NODE_ENV=production` or `DATABASE_URL` points to a non-local host.
- **Log Masking**: Console output and execution logs mask sensitive fields and contain zero plaintext passwords, TOTP secrets, or raw invitation tokens.

### 3.2 Running Comprehensive Seed Verification

Run the verification suite to assert 12 automated invariants against the database:

```bash
pnpm db:verify-seed
```

| Check # | Verification Item                    | Expected Result | Enforced Invariant                                                 |
| :-----: | :----------------------------------- | :-------------: | :----------------------------------------------------------------- |
|  **0**  | **Environment Safety Guard**         |     `PASS`      | Host is `localhost`/`127.0.0.1`, `NODE_ENV != production`          |
|  **1**  | **Database Connectivity & Role**     |     `PASS`      | Connected as `hs_migrator`                                         |
|  **2**  | **Table Record Counts**              |     `PASS`      | Exactly 123 records (3 orgs, 3 ents, 114 users, 3 invs)            |
|  **3**  | **Role & Status Distribution**       |     `PASS`      | 78 active, 18 invited, 11 suspended, 7 deleted                     |
|  **4**  | **Tenant Scoping & Foreign Keys**    |     `PASS`      | All tenant records strictly scoped; `platform_has_no_org` holds    |
|  **5**  | **Active User Password Hashes**      |     `PASS`      | All active users have valid Argon2id password hashes               |
|  **6**  | **Platform Admin MFA Config**        |     `PASS`      | Configured via reference `env:PLATFORM_ADMIN_MFA_SECRET`           |
|  **7**  | **Entitlements & Trial Windows**     |     `PASS`      | 1:1 mapping with orgs, 14-day trial window set for Brindle & Co    |
|  **8**  | **Invitations State & Token Hashes** |     `PASS`      | 1 valid, 1 expired, 1 used; all tokens are 32-byte binary digests  |
|  **9**  | **Soft-Deletion Invariants**         |     `PASS`      | Deleted users have `deleted_at` set; active have `deleted_at` null |
| **10**  | **Plaintext Secret & Pattern Scan**  |     `PASS`      | Zero plaintext passwords, TOTP secrets, or raw tokens in DB        |
| **11**  | **Seed Idempotency & Run Timing**    |     `PASS`      | 2 consecutive runs produce 0 extra rows in < 3000ms each           |

---

## 4. Seeded Accounts Verification Matrix

The test database contains designated positive and negative test personas across three organizations and the platform scope. **No passwords or secrets are documented here; all loginable accounts authenticate using the local `$SEED_DEFAULT_PASSWORD`.**

| Account Role              | Organization              | Email Identifier                        | State / Status                    |   Expected Login Result   | Test Purpose                                 |
| :------------------------ | :------------------------ | :-------------------------------------- | :-------------------------------- | :-----------------------: | :------------------------------------------- |
| **Platform Admin**        | Platform (`org_id: null`) | `superadmin@hellosmart.ai`              | `active` (MFA enabled)            |   `200 OK` (2-step MFA)   | S0-T14 Platform Superadmin access            |
| **Company Admin**         | Aster Ridge Technologies  | `admin@asterridge.com`                  | `active`                          |         `200 OK`          | S0-T14 Paid customer company admin           |
| **Company Admin**         | Brindle & Co              | `trialadmin@brindle.co`                 | `active`                          |         `200 OK`          | S0-T14 Trial customer company admin          |
| **Company Admin**         | Crestview Financial       | `admin@crestview.test`                  | `active` (Org suspended)          |    `403 ORG_SUSPENDED`    | Negative test: suspended organization access |
| **Candidate (Active)**    | Aster Ridge Technologies  | `candidate.aster-ridge.001@example.com` | `active`                          |         `200 OK`          | S0-T14 Active candidate workspace access     |
| **Candidate (Invited)**   | Aster Ridge Technologies  | `candidate.aster-ridge.071@example.com` | `invited` (`password_hash: null`) | `401 INVALID_CREDENTIALS` | S0-T08 Unaccepted candidate cannot log in    |
| **Candidate (Suspended)** | Aster Ridge Technologies  | `candidate.aster-ridge.081@example.com` | `suspended`                       |  `403 ACCOUNT_SUSPENDED`  | Negative test: suspended candidate access    |
| **Candidate (Deleted)**   | Aster Ridge Technologies  | `candidate.aster-ridge.091@example.com` | `deleted` (`deleted_at` set)      | `401 INVALID_CREDENTIALS` | Negative test: soft-deleted candidate login  |
| **Candidate (Invited)**   | Brindle & Co              | `candidate.brindle.008@example.com`     | `invited` (`password_hash: null`) | `401 INVALID_CREDENTIALS` | Trial org candidate invitation sample        |
| **Non-Existent User**     | None                      | `unknown-user@example.com`              | Not in DB                         | `401 INVALID_CREDENTIALS` | Negative test: uniform error response        |

> [!NOTE]
> Per security specification ([`BR-18`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md#L45)), `unknown email`, `wrong password`, `invited user (null password_hash)`, and `deleted user` all return an identical RFC 9457 `401 Unauthorized` (`INVALID_CREDENTIALS`) to prevent account enumeration.

---

## 5. Candidate Invitation Lifecycle & Token Specification

Candidate invitations implement the contract confirmed with the backend team ([`invitation-api-dependencies.md`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/docs/seed/invitation-api-dependencies.md)):

```mermaid
sequenceDiagram
  autonumber
  actor Candidate
  participant Web as Candidate Web Portal
  participant API as Backend (InvitationsController)
  participant DB as PostgreSQL (app.invitations)

  Candidate->>Web: Clicks email link (/accept-invite?token=<rawToken>)
  Web->>API: GET /auth/invitations/<rawToken>
  Note over API: OnResponse hook rewrites URL to /auth/invitations/[REDACTED]
  API->>DB: app.find_invitation_by_token_hash(sha256(rawToken))
  DB-->>API: { id, email, role, orgName, status }
  API-->>Web: 200 OK { email, role, orgName }

  Candidate->>Web: Submits new password (12-128 chars)
  Web->>API: POST /auth/invitations/accept { token, password }
  API->>DB: app.accept_invitation(sha256(rawToken), passwordHash)
  DB-->>API: Updated user record (status: active, must_reset_password: false)
  API-->>Web: 200 OK { success: true }
```

### 5.1 Token Storage Invariant

- **Raw Token**: 64-character lowercase hexadecimal string (32 cryptographically random bytes). Raw tokens are **never stored** in PostgreSQL and **never logged**.
- **Stored Token Hash**: 32-byte binary digest (`bytea`), computed strictly as `sha256(rawToken.trim())`.
- **Database Functions**:
  - `app.find_invitation_by_token_hash(bytea)`
  - `app.accept_invitation(bytea, text)`

---

## 6. Running Integration Tests

### 6.1 Fixtures & Invitation Integration Test Suite

Execute the full suite of 123 unit and integration tests:

```bash
pnpm --filter @hs/fixtures test
```

- **Online Behavior (Local DB running)**:
  - **123 passed, 0 failed, 0 skipped**.
  - Covers Argon2id password hashing, TOTP MFA validation, real backend `AuthService` login compatibility, `InvitationsService` lookup and accept flows, fastify request log URL redaction, and seed verification.
- **Offline Behavior (Local DB stopped)**:
  - **60 passed, 63 skipped, 0 failed**.
  - All database-dependent tests cleanly skip with descriptive reason `Local test database not available` without process crashes or connection error unhandled rejections.

### 6.2 Running Backend API Tests

To run the backend test suite:

```bash
pnpm --filter @hs/api test
```

- **Unit Tests**: Pass cleanly (logger, audit writer, password helpers, interceptors).
- **End-to-End Tests**: Files `test/auth.e2e-spec.ts` and `test/tenancy.e2e-spec.ts` require a running backend server process on `http://127.0.0.1:4000/api/v1`.

---

## 7. Known Limitations & API Dependencies

The following endpoints and features are planned in subsequent tickets and documented in detail in [`invitation-api-dependencies.md`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/docs/seed/invitation-api-dependencies.md):

1. **Candidate Resend Endpoint (`CO-017`)**:
   - `POST /candidates/:id/resend-invite` (Company Admin only). Invalidates the previous invitation and issues a fresh 72-hour token.
2. **Candidate Revocation (`CO-031`)**:
   - `POST /candidates/:id/revoke` or assignment revocation. Handled at the candidate/assignment lifecycle level rather than a standalone invitation endpoint.
3. **Candidate Listing (`CO-015`)**:
   - `GET /candidates` scoped strictly by `org_id` via PostgreSQL RLS.
4. **Accept-Invite Frontend Page**:
   - Implemented in `apps/web/src/app/(auth)/accept-invite/page.tsx`. Next.js client page receives token via `/accept-invite?token=<rawToken>`, cleans token from browser history, validates metadata via `validateInvitation`, and renders `SetPasswordForm`.

---

## 8. Cross-Reference Documentation

- [HelloSmart Database Seed Guide](seed-data.md): CLI usage, flags, environment setup, and troubleshooting.
- [Candidate Invitation API Dependencies & Contract Specification](invitation-api-dependencies.md): Complete route, request/response, and stored procedure contract for candidate onboarding.
- [Test Fixture Matrix](fixture-matrix.md): Enterprise entity matrix covering Aster Ridge, Brindle & Co, and Crestview Financial.
