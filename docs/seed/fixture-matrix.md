# HelloSmart Test Data Matrix & Fixture Specification

> [!WARNING] > **LOCAL DEV / TEST FIXTURES ONLY**  
> All credentials, emails, and tokens documented here are strictly intended for local development, integration testing, and CI/CD validation. **Never use these passwords, tokens, or emails in staging or production environments.** No plaintext passwords or production secrets are committed to git or printed in logs.

---

## 1. Overview & Architectural Alignment

This document defines the deterministic test data matrix for HelloSmart's core entities, strictly aligned with **Vishal's PostgreSQL schema** ([`packages/contracts/db/migrations/0001_tenancy_foundation.sql`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/packages/contracts/db/migrations/0001_tenancy_foundation.sql)) and the HelloSmart Product Spec ([`AGENTS.md`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md)).

### Core Schema & Tenancy Invariants

1. **Tenant Isolation (`BR-01`)**: Every tenant record (`app.organizations`, `app.entitlements`, `app.users`) carries an `org_id` UUID with row-level security enforced.
2. **Platform Role Constraint**: `CONSTRAINT platform_has_no_org CHECK ((role = 'platform_admin') = (org_id IS NULL))` ensures platform administrators have no organization attachment.
3. **Deterministic UUIDv5**: All entity IDs are derived deterministically via UUIDv5 from fixed category namespaces to ensure repeatable test executions without collisions.
4. **Soft-Deletion**: User deletion is tracked non-destructively using `app.users.deleted_at` timestamps.
5. **Login-Ready Argon2id Security (`[13.1]`)**: Passwords for loginable accounts are hashed with Argon2id ($64\text{ MB}$ memory, $3$ iterations, parallelism $1$). The shared development password is read from the uncommitted `SEED_DEFAULT_PASSWORD` environment variable in `.env.local`.
6. **Platform Admin MFA / TOTP (`[13.1]`)**: The platform administrator has MFA configured using a deterministic secret ref (`secrets/seed-superadmin-mfa`) and validates TOTP secrets provided via `SEED_PLATFORM_ADMIN_TOTP_SECRET` in `.env.local`.

---

## 2. Organizations & Entitlements Matrix

| Field                         | Aster Ridge Technologies (Paid Active)                 | Brindle & Co (Trial Active)              | Crestview Financial (Suspended Negative Sample) |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------- |
| **Deterministic UUID**        | `03fa0961-c787-51dd-a4f6-d445495111c6`                 | `43598d97-152e-5fe9-95e5-f55db8858a7f`   | `3f696114-abf5-51dd-bb33-768fe6493a89`          |
| **Name**                      | Aster Ridge Technologies                               | Brindle & Co                             | Crestview Financial                             |
| **Slug (`citext UNIQUE`)**    | `aster-ridge`                                          | `brindle-co`                             | `crestview-suspended`                           |
| **Status**                    | `paid_active`                                          | `trial_active`                           | `suspended`                                     |
| **Custom Domain**             | `hire.asterridge.com`                                  | `null`                                   | `null`                                          |
| **Logo Key**                  | `logos/aster.png`                                      | `null`                                   | `null`                                          |
| **Retention Window**          | 90 days                                                | 30 days                                  | 90 days                                         |
| **Created By (`created_by`)** | `superadmin@hellosmart.ai` (UUID)                      | `superadmin@hellosmart.ai` (UUID)        | `superadmin@hellosmart.ai` (UUID)               |
| **Max Templates**             | **10**                                                 | **2**                                    | **1**                                           |
| **Max Candidates**            | **100**                                                | **10**                                   | **5**                                           |
| **Trial Window**              | `null` (Paid Plan)                                     | **14 Days** (`TRIAL_DURATION_DAYS = 14`) | `null`                                          |
| **Pending Invite Multiplier** | `2.0`                                                  | `2.0`                                    | `2.0`                                           |
| **Feature Flags**             | `{"cloud": true, "chat": true, "custom_domain": true}` | `{"chat": true}`                         | `{}`                                            |

---

## 3. Platform & Company Administrators

All admin users have password hashes generated dynamically from `SEED_DEFAULT_PASSWORD` (Argon2id: 64 MB memory, 3 iterations, 1 parallelism).

| Role             | Organization              | Name                            | Email                      | Status   | Password Hash                    | MFA Config                              | Classification & Verification Target                            |
| ---------------- | ------------------------- | ------------------------------- | -------------------------- | -------- | -------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `platform_admin` | _(None - `org_id: null`)_ | Super Admin                     | `superadmin@hellosmart.ai` | `active` | Hash of `$SEED_DEFAULT_PASSWORD` | Enabled (`secrets/seed-superadmin-mfa`) | **Loginable**: Requires password + valid TOTP code (`[13.1]`)   |
| `company_admin`  | Aster Ridge Technologies  | Aster Ridge Admin               | `admin@asterridge.com`     | `active` | Hash of `$SEED_DEFAULT_PASSWORD` | Disabled                                | **Loginable**: Primary company admin for mature paid tenant     |
| `company_admin`  | Brindle & Co              | Brindle Trial Admin             | `trialadmin@brindle.co`    | `active` | Hash of `$SEED_DEFAULT_PASSWORD` | Disabled                                | **Loginable**: Primary company admin for active trial tenant    |
| `company_admin`  | Crestview Financial       | Crestview Admin (Suspended Org) | `admin@crestview.test`     | `active` | Hash of `$SEED_DEFAULT_PASSWORD` | Disabled                                | **Negative Sample**: Rejection at login due to suspended tenant |

---

## 4. Candidate State Distribution

Candidates are distributed across schema statuses (`active`, `invited`, `suspended`, `deleted`). Quotas total **exactly 100 for Aster Ridge** and **exactly 10 for Brindle & Co** (**110 candidates total**).

To preserve the **sub-3-second seed target**, Argon2id password hashing is precomputed once per seed run and shared across all active candidate accounts (and loginable admin accounts). Candidate accounts in `invited` state have `password_hash = null` pending onboarding reset (`BR-24`), and unused records in `suspended`/`deleted` state use `password_hash = null`.

| Organization                 | Status      | Count   | Email Pattern                                                | Must Reset Password | Email Verified    | Soft Deleted (`deleted_at`) | Password Hash Status             | Classification                                          |
| ---------------------------- | ----------- | ------- | ------------------------------------------------------------ | ------------------- | ----------------- | --------------------------- | -------------------------------- | ------------------------------------------------------- |
| **Aster Ridge Technologies** | `active`    | **70**  | `candidate.aster-ridge.001@example.com`                      | `false`             | Yes (`ref - 10d`) | `null`                      | Hash of `$SEED_DEFAULT_PASSWORD` | **Loginable**: Candidate ready for direct login         |
|                              |             |         | `candidate.aster-ridge.002@example.com` … `.070@example.com` | `false`             | Yes (`ref - 10d`) | `null`                      | Hash of `$SEED_DEFAULT_PASSWORD` | Bulk active candidate pool                              |
|                              | `invited`   | **15**  | `candidate.aster-ridge.071@example.com` … `.085@example.com` | `true`              | `null`            | `null`                      | `null` (pending onboarding)      | Onboarding flow testing (`BR-24`)                       |
|                              | `suspended` | **10**  | `candidate.aster-ridge.086@example.com`                      | `false`             | Yes (`ref - 15d`) | `null`                      | Hash of `$SEED_DEFAULT_PASSWORD` | **Negative Sample**: Rejection due to user `suspended`  |
|                              |             |         | `candidate.aster-ridge.087@example.com` … `.095@example.com` | `false`             | Yes (`ref - 15d`) | `null`                      | `null` (unhashed non-sample)     | Bulk suspended candidate pool                           |
|                              | `deleted`   | **5**   | `candidate.aster-ridge.096@example.com`                      | `false`             | Yes (`ref - 20d`) | `ref - 4d`                  | Hash of `$SEED_DEFAULT_PASSWORD` | **Negative Sample**: Rejection due to user soft-deleted |
|                              |             |         | `candidate.aster-ridge.097@example.com` … `.100@example.com` | `false`             | Yes (`ref - 20d`) | `ref - 4d`                  | `null` (unhashed non-sample)     | Bulk soft-deleted candidate pool                        |
| **Aster Ridge Subtotal**     |             | **100** |                                                              |                     |                   |                             |                                  |                                                         |
| **Brindle & Co**             | `active`    | **4**   | `candidate.brindle-co.01@example.com` … `.04@example.com`    | `false`             | Yes (`ref - 5d`)  | `null`                      | Hash of `$SEED_DEFAULT_PASSWORD` | Active trial candidates                                 |
|                              | `invited`   | **3**   | `candidate.brindle-co.05@example.com` … `.07@example.com`    | `true`              | `null`            | `null`                      | `null` (pending onboarding)      | Trial quota multiplier testing (`BR-06`)                |
|                              | `suspended` | **1**   | `candidate.brindle-co.08@example.com`                        | `false`             | Yes (`ref - 7d`)  | `null`                      | `null` (unhashed non-sample)     | Suspended trial candidate                               |
|                              | `deleted`   | **2**   | `candidate.brindle-co.09@example.com` … `.10@example.com`    | `false`             | Yes (`ref - 10d`) | `ref - 2d`                  | `null` (unhashed non-sample)     | Soft-deleted trial candidates                           |
| **Brindle & Co Subtotal**    |             | **10**  |                                                              |                     |                   |                             |                                  |                                                         |
| **TOTAL CANDIDATES**         |             | **110** |                                                              |                     |                   |                             |                                  |                                                         |

---

## 5. Sample Candidate Records & Verification Goals

| Candidate Email                         | Org          | Role        | Status      | Classification         | Verification Goal & Behavior                                                             |
| --------------------------------------- | ------------ | ----------- | ----------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `candidate.aster-ridge.001@example.com` | Aster Ridge  | `candidate` | `active`    | **Loginable**          | Has valid password hash; successfully logs in and connects to Cloud/Chat workspace.      |
| `candidate.aster-ridge.071@example.com` | Aster Ridge  | `candidate` | `invited`   | **Onboarding**         | Pending onboarding; requires first-login password reset via invite token (`BR-24`).      |
| `candidate.aster-ridge.086@example.com` | Aster Ridge  | `candidate` | `suspended` | **Negative Sample**    | Has valid password hash; login rejected with account suspended error (`403 Forbidden`).  |
| `candidate.aster-ridge.096@example.com` | Aster Ridge  | `candidate` | `deleted`   | **Negative Sample**    | Has valid password hash; login rejected as soft-deleted user (`deleted_at IS NOT NULL`). |
| `candidate.brindle-co.01@example.com`   | Brindle & Co | `candidate` | `active`    | **Quota Verification** | Active trial candidate; enforces trial cap (max 10 candidates).                          |
| `candidate.brindle-co.05@example.com`   | Brindle & Co | `candidate` | `invited`   | **Quota Verification** | Invited trial candidate; counts against pending invite multiplier quota (`BR-06`).       |
| `candidate.brindle-co.08@example.com`   | Brindle & Co | `candidate` | `suspended` | **State Preservation** | Suspended candidate in trial org.                                                        |
| `candidate.brindle-co.09@example.com`   | Brindle & Co | `candidate` | `deleted`   | **Audit Preservation** | Soft-deleted candidate in trial org.                                                     |

---

## 6. Foreign Key & Entity Relationship Validation

```
Platform Admin
  id: superadmin@hellosmart.ai (UUIDv5)
  org_id: NULL  <-- CHECK ((role = 'platform_admin') = (org_id IS NULL))
      |
      +-----> app.organizations.created_by (Aster Ridge: 03fa0961-...)
      |           |
      |           +-----> app.entitlements.org_id (10 templates, 100 candidates, paid_active)
      |           +-----> app.users.org_id (admin@asterridge.com, candidate.aster-ridge.*)
      |
      +-----> app.organizations.created_by (Brindle & Co: 43598d97-...)
      |           |
      |           +-----> app.entitlements.org_id (2 templates, 10 candidates, 14-day trial)
      |           +-----> app.users.org_id (trialadmin@brindle.co, candidate.brindle-co.*)
      |
      +-----> app.organizations.created_by (Crestview Financial: 3f696114-...)
                  |
                  +-----> app.entitlements.org_id (1 template, 5 candidates, suspended)
                  +-----> app.users.org_id (admin@crestview.test [Negative Sample])
```

1. `app.organizations.created_by` references `app.users(id)` where `role = 'platform_admin'`.
2. `app.entitlements.org_id` references `app.organizations(id)` as a 1:1 foreign key.
3. `app.users.org_id` references `app.organizations(id)` for all company admins and candidates.
4. `UNIQUE (org_id, email)` guarantees email uniqueness within any individual tenant.

---

## 7. Candidate Invitation Tokens Matrix ([13.2])

> [!IMPORTANT] > **CRYPTOGRAPHICALLY RANDOM TOKENS & SECURE STORAGE**  
> Seeded candidate invitations use 32 random bytes (`crypto.randomBytes(32)`) generated dynamically.
>
> - Raw tokens are **never committed**, **never stored in the database**, and **never written to logs or docs**.
> - Only the **SHA-256 32-byte binary digest** (`token_hash`) is persisted in `app.invitations.token_hash` (`bytea`), matching migration `0003_invitations.sql` and backend `InvitationsService.hashToken`.
> - Local persistence: Raw tokens are stored in the gitignored file `packages/fixtures/.seed-tokens.local.json` (mode `0600`) for helper consumption, and in memory during test execution.
> - To print raw tokens and links to the console for local debugging, pass the `--show-tokens` CLI flag: `pnpm db:seed -- --show-tokens`. (Printing is strictly refused in CI environments).

### Token Specification & Candidate Linkages

| Label     | Candidate Email                         | Organization                   | Status / State                                   | Token Storage & Entropy                           | Expiration Window (`INVITE_TTL_HOURS = 72`) | Used At (`used_at`)         | Intended Test Coverage                                               |
| --------- | --------------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `valid`   | `candidate.aster-ridge.071@example.com` | Aster Ridge (`ASTER_RIDGE_ID`) | Candidate `invited`, `must_reset_password: true` | Dynamic 32-byte random token; 32-byte bytea in DB | `seed_now + 72h` (unexpired)                | `null` (reset on re-seed)   | First-login password reset flow (`BR-24`, `CA-001`)                  |
| `expired` | `candidate.aster-ridge.072@example.com` | Aster Ridge (`ASTER_RIDGE_ID`) | Candidate `invited`, `must_reset_password: true` | Dynamic 32-byte random token; 32-byte bytea in DB | `seed_now - 28h` (created at `now - 100h`)  | `null`                      | Expired invite token rejection and resend prompt (`EX-12`, `CO-017`) |
| `used`    | `candidate.aster-ridge.001@example.com` | Aster Ridge (`ASTER_RIDGE_ID`) | Candidate `active`, completed onboarding         | Dynamic 32-byte random token; 32-byte bytea in DB | `seed_now + 48h` (created at `now - 24h`)   | `seed_now - 12h` (consumed) | Consumed token rejection / already used error                        |

### Programmatic Helper Usage (`packages/fixtures/src/lib/invite-links.ts`)

```typescript
import { getAcceptInviteLink, getInviteToken } from '@hs/fixtures';

// Generate full acceptance link: <APP_BASE_URL>/accept-invite?token=<rawToken>
const validInviteLink = getAcceptInviteLink('valid');
const expiredInviteLink = getAcceptInviteLink('expired');
const usedInviteLink = getAcceptInviteLink('used');

// Retrieve raw token string:
const rawValidToken = getInviteToken('valid');
```

---

## 8. Local Credentials & Authenticator Setup (`.env.local`)

To run the seed engine and test local authentication flows, configure your uncommitted `.env.local` file:

```bash
# 1. Copy the example file to .env.local (gitignored)
cp .env.local.example .env.local
```

### Required Configuration Keys

```env
# Shared local test password used to generate Argon2id hashes for loginable accounts (uncommitted)
SEED_DEFAULT_PASSWORD=

# Base32 TOTP secret for local testing of Platform Admin MFA (RFC 4648 Base32: A-Z, 2-7, uncommitted)
# Note: The platform admin user stores mfa_secret_ref = 'env:PLATFORM_ADMIN_MFA_SECRET'.
# The backend API process (apps/api) resolves this via PLATFORM_ADMIN_MFA_SECRET from its environment.
# Configure this in .env.local and .env so both the seed runner and API process share the secret.
SEED_PLATFORM_ADMIN_TOTP_SECRET=
PLATFORM_ADMIN_MFA_SECRET=
```

### Adding Platform Admin MFA to an Authenticator App (Local Development Only)

For engineers testing Platform Admin login flows locally:

1. Open your authenticator application (Google Authenticator, 1Password, Authy, Apple Passwords).
2. Choose **"Enter setup key manually"** / **"Add manual account"**.
3. Account name: `superadmin@hellosmart.ai (Local)`.
4. Key: Copy the exact Base32 string from your `SEED_PLATFORM_ADMIN_TOTP_SECRET` variable in `.env.local`.
5. Key type: **Time-based (TOTP)**, 30-second interval, 6-digit codes.

> [!CAUTION] > **Zero Plaintext Secrets Policy**:
>
> - Never print the TOTP secret, QR code, or `otpauth://` URI to terminal console output, logs, or documentation.
> - Never commit `.env.local` to git version control.
> - When S0-T14-3 (AES-256-GCM vault encryption helper) and S0-T17 (shared password policy) are implemented, the seed engine will automatically bind to those components.
