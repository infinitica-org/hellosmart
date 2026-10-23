# PRD: Seed Data for HelloSmart.ai Testing & Local Development

|                  |                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Status**       | Approved v0.2 (Aligned with Real Architecture)                                            |
| **Owner**        | Data Ops (`@hs/fixtures`)                                                                 |
| **Deliverables** | (1) Documented seed-data structure (2) Working, idempotent seed scripts in `@hs/fixtures` |
| **Data policy**  | Fictional data only. No real people, companies, emails, phone numbers, or credentials.    |

---

## 1. Background and Problem

HelloSmart.ai is an AI-native hiring assessment platform where candidates complete real work tasks inside secure, monitored workspaces (Cloud VM and Chat), scored by independent AI reviewer agents.

The platform has three roles: **Platform Admin**, **Company Admin**, and **Candidate**. Testing today (manual, automated tenancy suites, E2E, demo) requires a shared, repeatable, deterministic dataset. Without it:

- Testers create ad-hoc accounts with inconsistent states.
- Duplicate or polluted data occurs when setup scripts are rerun.
- Tenancy isolation rules (`BR-01`) cannot be reliably proven across test runs.
- Risk of real-looking or real PII leaking into non-production environments.

We need a **single, documented, deterministic, idempotent seed dataset** that any developer or QA can load in one command and get the exact same result every time.

## 2. Goals

| ID  | Goal                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | Provide 2 fictional organizations (`aster` and `brindle`) with distinct profiles and entitlements to exercise multi-tenant behavior and isolation (`BR-01`). |
| G2  | Provide representative users for all three platform roles: `platform_admin`, `company_admin`, and `candidate`.                                               |
| G3  | Cover realistic **account states** (`provisioned`, `trial_active`, `paid_active`, `suspended`, `active`, `invited`, `deleted`, `locked`).                    |
| G4  | Cover realistic **assessment and assignment pipeline states** (assessments: draft to archived; assignments: invited to submitted, expired, revoked).         |
| G5  | Make the seed **strictly idempotent**: rerunning never creates duplicates, produces zero new rows on a second run, and restores modified seed records.       |
| G6  | Document the structure so every team member can find and use specific fixtures by stable key name.                                                           |
| G7  | Strictly align the schema, tables (`app.organizations`, `app.entitlements`, `app.users`), enums, and constraints with the codebase.                          |

## 3. Non-Goals

- Performance or load-test volumes (separate k6/bulk generator; see Future Work).
- Anonymized copies of production data.
- Seeding production environments (hard blocked by environment guards).
- Real email delivery, real LLM calls, or real external payment transactions (stubs/fakes only).
- Replacing unit-test factories. The seed dataset is for integration, tenancy validation, E2E, QA, and demos.

## 4. Assumptions & Technical Constraints

- A1. Multi-tenant: Every tenant table carries `org_id` and enforces PostgreSQL Row Level Security (RLS) via `app.current_org_id()` or `app.is_platform()` (`0001_tenancy_foundation.sql`, `BR-01`).
- A2. Platform admins have no organization (`(role = 'platform_admin') = (org_id IS NULL)`). Company admins and candidates must belong to an organization (`org_id NOT NULL`).
- A3. Authentication uses argon2id password hashing (`@node-rs/argon2`, `m=19456, t=2, p=1`). Passwords come from `SEED_DEFAULT_PASSWORD` in the environment; no plain text or secrets in the repository.
- A4. Platform admins have MFA configured (`mfa_secret_ref`, non-prod mock).
- A5. Candidate workflow is: Template → Assessment (pinned version) → Candidate Assignment → Workspace Session (Cloud/Chat) → Submission → Reviewer Agent Scoring & Final Review.
- A6. The seed runs with platform/administrative context as the migrator role (`hs_migrator`), ensuring RLS is respected without weakening it.
- A7. Audit log (`audit.events`) is append-only and cryptographically chained. The seed never mutates or deletes existing audit rows, and does not churn audit entries on reruns.

## 5. Entities and Roles

### 5.1 Organizations (`app.organizations` & `app.entitlements`)

Two fictional companies with distinct profiles:

| Key       | Name (fictional)         | Status         | Profile & Entitlements                                                              | Purpose                                                  |
| --------- | ------------------------ | -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `aster`   | Aster Ridge Technologies | `paid_active`  | Mature, retention 90d, max_templates: 5, max_candidates: 25, flags: `cloud`, `chat` | Happy path, full feature coverage                        |
| `brindle` | Brindle & Co. Logistics  | `trial_active` | Newly onboarded, retention 30d, max_templates: 1, max_candidates: 5, flags: `chat`  | Edge states, trial limits, tenant-isolation verification |

### 5.2 Users by Role (`app.users`)

**Platform Admin** (`role = 'platform_admin'`, `org_id IS NULL`)

- `admin_super`: Full access platform administrator; creator of organizations (`created_by`).
- `admin_support`: Support admin.
- `admin_suspended`: Suspended admin to verify authentication is blocked.

**Company Admin** (`role = 'company_admin'`, scoped to `org_id`)

- `aster_owner` / `brindle_owner`: Primary company admin.
- `aster_admin2` / `brindle_admin2`: Secondary company admin for cross-user tests.
- `aster_invited` / `brindle_invited_expired`: Invited admins awaiting initial password reset.
- `aster_suspended`: Suspended company admin.
- `aster_deactivated`: Soft-deleted user (`status = 'deleted'`, `deleted_at: now()`).
- `aster_unverified`: Email unverified (`email_verified_at: null`).
- `aster_locked`: Account locked out after repeated failed logins (`failed_logins: 10`, `locked_until > now()`).

**Candidate** (`role = 'candidate'`, scoped to `org_id`)

- `cand_complete`: Active, verified candidate.
- `cand_incomplete`: Invited candidate with `must_reset_password: true`.
- `cand_unverified`: Unverified email (`email_verified_at: null`).
- `cand_suspended`: Suspended candidate (session start blocked).
- `cand_deactivated`: Soft-deleted candidate.
- `cand_locked`: Locked account.
- `cand_reset_pending`: Outstanding password reset state.
- `cand_no_apps`: Candidate with no assigned assessments.
- `cand_unicode`: Unicode / special characters name handling.
- `cand_multi_aster` & `cand_multi_brindle`: Same candidate email (`multi@seed.example.test`) under both organizations to test multi-tenant cross-org candidate behavior.
- Pipeline candidates: One candidate per assignment state (`cand_p_invited`, `cand_p_window_wait`, `cand_p_ready`, `cand_p_in_progress`, `cand_p_disconnected`, `cand_p_submitted`, `cand_p_expired`, `cand_p_revoked`).

### 5.3 Assessment & Assignment States

**Assessments** (pins a Template Version):

- States: `draft` → `dry_run_passed` → `published` → `closed` → `archived`.
- Variants: Cloud VM vs Chat, duration-bound vs window-bound, AI ON vs AI OFF.

**Assignments** (candidate assigned to an assessment):

- States: `invited` → `window_not_open` → `ready` → `in_progress` → `disconnected` → `submitted`.
- Side / Terminal exits: `expired`, `revoked`.

**Reviews**:

- States: `pending` → `agents_running` → `agent_report_ready` → `human_review` → `finalized` → `released`.

## 6. Seed Script Requirements

| ID  | Requirement                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------- |
| S1  | Run via `pnpm db:seed` or `pnpm --filter @hs/fixtures seed`.                                                    |
| S2  | **Strictly Idempotent**: matching by natural key; second run produces 0 new rows.                               |
| S3  | Deterministic IDs using UUIDv5 with a fixed namespace.                                                          |
| S4  | Dependency-ordered: Platform Admin → Organizations (`created_by`) → Entitlements → Company Admins & Candidates. |
| S5  | Environment-guarded: refuses production (`NODE_ENV === 'production'`) and unknown DB hosts.                     |
| S6  | Non-seed collision guard: if a seed email exists as a non-seed account, abort immediately with an error.        |
| S7  | Reporting: logs summary of created / updated / unchanged counts per entity.                                     |
| S8  | Supports `--dry-run` to preview operations without writing to DB.                                               |
| S9  | Passwords hashed at runtime using `@node-rs/argon2` argon2id from `SEED_DEFAULT_PASSWORD`.                      |
| S10 | Declarative fixture files separated from the loader code.                                                       |

## 7. Acceptance Criteria

- [ ] AC1. Running `pnpm db:seed` on a clean DB creates the platform admins, 2 organizations, entitlements, and users.
- [ ] AC2. Running `pnpm db:seed` a second time produces 0 new rows and reports all records as unchanged.
- [ ] AC3. Seed refuses to run when `NODE_ENV=production` or against non-allowlisted hosts.
- [ ] AC4. No secrets or plain text passwords in repository; dev password read from environment.
- [ ] AC5. RLS policies and constraints in PostgreSQL are completely satisfied without bypasses.
- [ ] AC6. `--dry-run` reports planned actions without writing to the database.
