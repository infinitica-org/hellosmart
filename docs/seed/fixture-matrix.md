# Fixture Matrix (HelloSmart Real Schema Aligned)

Complete list of every seed record, its state in the real schema, and why it exists.

**Status:** Aligned with `packages/contracts/db/migrations/0001_tenancy_foundation.sql`, `AGENTS.md` (Product & Engineering Spec), and `packages/contracts/openapi/openapi.yaml`.

**Conventions**

- All emails end in `seed.example.test` (reserved `.test` TLD, never resolves).
- Fixture `key` is the stable name tests use. Tests refer to fixtures by key or email, never by numeric ID.
- Everyone logs in with the dev password from `SEED_DEFAULT_PASSWORD` (set in `.env`, never committed; hashed using `@node-rs/argon2` argon2id).
- Edge-case IDs (E-...) refer to `PRD.md`, Section 11.

---

## 1. Organizations (`app.organizations` & `app.entitlements`)

In the real schema, "companies" are stored in `app.organizations` with limits in `app.entitlements`.

| Key       | Name                     | Status (`app.organizations.status`) | Retention Days | Entitlements                                                                                           | Purpose                                                           |
| --------- | ------------------------ | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `aster`   | Aster Ridge Technologies | `paid_active`                       | 90             | max_templates: 5, max_candidates: 25, pending_invite_mult: 2.0, flags: `{"cloud": true, "chat": true}` | Mature, full feature coverage, happy path                         |
| `brindle` | Brindle & Co. Logistics  | `trial_active`                      | 30             | max_templates: 1, max_candidates: 5, pending_invite_mult: 1.5, flags: `{"chat": true}`                 | Newly onboarded org, trial active, restricted limits, edge states |

### Real Schema Fields

- `id`: `uuid` (deterministic UUIDv5 derived from `slug`)
- `name`: `text` ("Aster Ridge Technologies", "Brindle & Co. Logistics")
- `slug`: `citext UNIQUE` (`aster-ridge`, `brindle-co`)
- `status`: `text CHECK (status IN ('provisioned','trial_active','trial_expired','paid_active','suspended'))`
- `logo_key`: `text` (S3 object key stub, e.g. `logos/aster.png`)
- `custom_domain`: `citext UNIQUE` (`assess.aster.example.test`, null for brindle)
- `retention_days`: `int CHECK (retention_days BETWEEN 30 AND 730)`
- `created_by`: `uuid` (references `admin_super.id`)
- `app.entitlements`: `(org_id, max_templates, max_candidates, trial_ends_at, pending_invite_multiplier, flags)`

---

## 2. Platform Admin Users (`app.users`, role = `platform_admin`)

Platform admins have `org_id IS NULL` enforced by database check constraint `platform_has_no_org CHECK ((role = 'platform_admin') = (org_id IS NULL))`.

| Key               | Email                             | Status (`status`) | MFA Secret Ref                | Must Reset Password | Purpose                                           |
| ----------------- | --------------------------------- | ----------------- | ----------------------------- | ------------------- | ------------------------------------------------- |
| `admin_super`     | admin.super@seed.example.test     | `active`          | `secrets/admin_super_mfa`     | `false`             | Full platform admin access; creator of seed orgs  |
| `admin_support`   | admin.support@seed.example.test   | `active`          | `secrets/admin_support_mfa`   | `false`             | Support admin (E-ROLE-8)                          |
| `admin_suspended` | admin.suspended@seed.example.test | `suspended`       | `secrets/admin_suspended_mfa` | `false`             | Suspended admin: login must be blocked (E-ROLE-1) |

---

## 3. Company Users (`app.users`, role = `company_admin`)

In MMP (Phase 1), company users have role `company_admin` (`AGENTS.md` §4.1). Reviewer roles are Phase 2. All company users belong to a tenant `org_id`.

### Aster Ridge Technologies (`org_id` = `aster.id`)

| Key                 | Email                                  | Status      | Side State                                       | Purpose                                             |
| ------------------- | -------------------------------------- | ----------- | ------------------------------------------------ | --------------------------------------------------- |
| `aster_owner`       | owner@aster.seed.example.test          | `active`    | `email_verified_at` set                          | Primary company administrator                       |
| `aster_admin2`      | admin2@aster.seed.example.test         | `active`    | `email_verified_at` set                          | Secondary admin for multi-user company tests        |
| `aster_hm`          | hiring.manager@aster.seed.example.test | `active`    | `email_verified_at` set                          | Team manager account                                |
| `aster_invited`     | invited@aster.seed.example.test        | `invited`   | `must_reset_password: true`, unverified          | Invited admin who has not logged in (E-AUTH-11)     |
| `aster_suspended`   | suspended@aster.seed.example.test      | `suspended` | `email_verified_at` set                          | Suspended company user; login blocked               |
| `aster_deactivated` | deactivated@aster.seed.example.test    | `deleted`   | `deleted_at: now()`                              | Soft-deleted user (E-IDEM-12)                       |
| `aster_unverified`  | unverified@aster.seed.example.test     | `active`    | `email_verified_at: null`                        | Email unverified state (E-AUTH-5)                   |
| `aster_locked`      | locked@aster.seed.example.test         | `active`    | `failed_logins: 10`, `locked_until: now() + 15m` | Account locked out after failed attempts (E-AUTH-7) |

### Brindle & Co. Logistics (`org_id` = `brindle.id`)

| Key                       | Email                                     | Status    | Side State                                  | Purpose                                           |
| ------------------------- | ----------------------------------------- | --------- | ------------------------------------------- | ------------------------------------------------- |
| `brindle_owner`           | owner@brindle.seed.example.test           | `active`  | `email_verified_at` set                     | Primary administrator for Brindle                 |
| `brindle_admin2`          | admin2@brindle.seed.example.test          | `active`  | `email_verified_at` set                     | Cross-tenant isolation verification against Aster |
| `brindle_invited_expired` | invited.expired@brindle.seed.example.test | `invited` | `must_reset_password: true`, expired invite | Expired invitation edge case (E-AUTH-11)          |

---

## 4. Candidates (`app.users`, role = `candidate`)

Candidates are users with `role = 'candidate'` scoped to an `org_id`. Under HelloSmart, candidates are invited by a company to complete assessment workspaces.

| Key                   | Email                            | Org       | Status      | Side State                                       | Purpose                                            |
| --------------------- | -------------------------------- | --------- | ----------- | ------------------------------------------------ | -------------------------------------------------- |
| `cand_complete`       | complete@seed.example.test       | `aster`   | `active`    | `email_verified_at` set                          | Happy path candidate                               |
| `cand_incomplete`     | incomplete@seed.example.test     | `aster`   | `invited`   | `must_reset_password: true`                      | Newly created candidate before initial login       |
| `cand_unverified`     | unverified@seed.example.test     | `aster`   | `active`    | `email_verified_at: null`                        | Unverified email (E-AUTH-5)                        |
| `cand_suspended`      | suspended@seed.example.test      | `aster`   | `suspended` | `email_verified_at` set                          | Suspended candidate: workspace connect blocked     |
| `cand_deactivated`    | deactivated@seed.example.test    | `aster`   | `deleted`   | `deleted_at: now()`                              | Soft-deleted candidate (E-FLOW-12)                 |
| `cand_locked`         | locked@seed.example.test         | `aster`   | `active`    | `failed_logins: 10`, `locked_until: now() + 15m` | Locked after failed logins (E-AUTH-7)              |
| `cand_reset_pending`  | reset.pending@seed.example.test  | `aster`   | `active`    | `must_reset_password: true`                      | Outstanding password-reset state (E-AUTH-6)        |
| `cand_no_apps`        | noapps@seed.example.test         | `aster`   | `active`    | `email_verified_at` set                          | Empty state: invited to org, no assignments yet    |
| `cand_unicode`        | unicode@seed.example.test        | `aster`   | `active`    | Special characters: "Renée O'Neil 🚀"            | Unicode, accents, apostrophes test (E-DATA-8, 9)   |
| `cand_multi_aster`    | multi@seed.example.test          | `aster`   | `active`    | `email_verified_at` set                          | Multi-tenant candidate record (Aster side)         |
| `cand_multi_brindle`  | multi@seed.example.test          | `brindle` | `active`    | `email_verified_at` set                          | Multi-tenant candidate record (Brindle side)       |
| `cand_p_invited`      | p.invited@seed.example.test      | `aster`   | `active`    | Assignment state: `invited`                      | Pipeline: invited, not yet connected               |
| `cand_p_window_wait`  | p.window@seed.example.test       | `aster`   | `active`    | Assignment state: `window_not_open`              | Pipeline: scheduled for future date window         |
| `cand_p_ready`        | p.ready@seed.example.test        | `aster`   | `active`    | Assignment state: `ready`                        | Pipeline: within window, ready to connect          |
| `cand_p_in_progress`  | p.inprogress@seed.example.test   | `aster`   | `active`    | Assignment state: `in_progress`                  | Pipeline: currently in workspace session           |
| `cand_p_disconnected` | p.disconnected@seed.example.test | `aster`   | `active`    | Assignment state: `disconnected`                 | Pipeline: disconnected mid-session, resumable      |
| `cand_p_submitted`    | p.submitted@seed.example.test    | `aster`   | `active`    | Assignment state: `submitted`                    | Pipeline: completed and submitted                  |
| `cand_p_expired`      | p.expired@seed.example.test      | `aster`   | `active`    | Assignment state: `expired`                      | Pipeline: window passed without candidate starting |
| `cand_p_revoked`      | p.revoked@seed.example.test      | `aster`   | `active`    | Assignment state: `revoked`                      | Pipeline: assignment revoked by company            |

---

## 5. Assessments (`Assessment`, replaces generic "Jobs")

In HelloSmart, companies do not post generic ATS job ads; they configure **Assessments** from pre-built platform **Templates** (e.g. `backend-incident-debug`).

### Aster Ridge Technologies

| Key                        | Template Ref             | Mode    | Assessment State | Timing / Variant                  | Purpose                                      |
| -------------------------- | ------------------------ | ------- | ---------------- | --------------------------------- | -------------------------------------------- |
| `aster_asmt_draft`         | `backend-incident-debug` | `cloud` | `draft`          | 60 min duration                   | Draft assessment not visible to candidates   |
| `aster_asmt_dryrun`        | `backend-incident-debug` | `cloud` | `dry_run_passed` | 60 min duration                   | Ready to publish                             |
| `aster_asmt_pub_cloud`     | `backend-incident-debug` | `cloud` | `published`      | 90 min duration, AI ON            | Active Cloud VM assessment                   |
| `aster_asmt_pub_chat`      | `backend-incident-debug` | `chat`  | `published`      | 45 min duration, AI ON            | Active Chat assessment                       |
| `aster_asmt_window_future` | `backend-incident-debug` | `cloud` | `published`      | Window: `ref + 7d` to `ref + 14d` | Future scheduled assessment window           |
| `aster_asmt_window_past`   | `backend-incident-debug` | `cloud` | `published`      | Window: `ref - 14d` to `ref - 7d` | Past window, expired assignments             |
| `aster_asmt_ai_off`        | `backend-incident-debug` | `cloud` | `published`      | 60 min duration, AI OFF           | Tests AI proxy blocking & rubric without AI  |
| `aster_asmt_closed`        | `backend-incident-debug` | `cloud` | `closed`         | 60 min duration                   | Closed assessment with completed submissions |
| `aster_asmt_archived`      | `backend-incident-debug` | `cloud` | `archived`       | 60 min duration                   | Hidden from active dashboard                 |

### Brindle & Co. Logistics

| Key                      | Template Ref             | Mode   | Assessment State | Timing / Variant       | Purpose                           |
| ------------------------ | ------------------------ | ------ | ---------------- | ---------------------- | --------------------------------- |
| `brindle_asmt_draft`     | `backend-incident-debug` | `chat` | `draft`          | 30 min duration        | Draft in second tenant            |
| `brindle_asmt_published` | `backend-incident-debug` | `chat` | `published`      | 45 min duration, AI ON | Cross-tenant assessment isolation |
| `brindle_asmt_closed`    | `backend-incident-debug` | `chat` | `closed`         | 30 min duration        | Closed state in second tenant     |

---

## 6. Candidate Assignments & Submissions (replaces "Applications")

Assignments connect a candidate to an assessment in their organization.

| Candidate Key         | Assessment Key             | Assignment Status | Workspace Mode | Review Status  | Notes                                                   |
| --------------------- | -------------------------- | ----------------- | -------------- | -------------- | ------------------------------------------------------- |
| `cand_p_invited`      | `aster_asmt_pub_cloud`     | `invited`         | `cloud`        | -              | Invited, awaiting candidate connect                     |
| `cand_p_window_wait`  | `aster_asmt_window_future` | `window_not_open` | `cloud`        | -              | Blocked until window opens                              |
| `cand_p_ready`        | `aster_asmt_pub_cloud`     | `ready`           | `cloud`        | -              | Inside window/duration, ready to connect                |
| `cand_p_in_progress`  | `aster_asmt_pub_cloud`     | `in_progress`     | `cloud`        | -              | Active session running                                  |
| `cand_p_disconnected` | `aster_asmt_pub_cloud`     | `disconnected`    | `cloud`        | -              | Candidate dropped/exited full screen; timer running     |
| `cand_p_submitted`    | `aster_asmt_pub_cloud`     | `submitted`       | `cloud`        | `human_review` | Submitted, AI agent scored, awaiting human finalization |
| `cand_complete`       | `aster_asmt_pub_chat`      | `submitted`       | `chat`         | `finalized`    | Finalized scores and notes by company admin             |
| `cand_p_expired`      | `aster_asmt_window_past`   | `expired`         | `cloud`        | -              | Never started before window closed                      |
| `cand_p_revoked`      | `aster_asmt_pub_cloud`     | `revoked`         | `cloud`        | -              | Company revoked invite                                  |
| `cand_multi_aster`    | `aster_asmt_pub_cloud`     | `ready`           | `cloud`        | -              | Multi-tenant test (Aster side)                          |
| `cand_multi_brindle`  | `brindle_asmt_published`   | `ready`           | `chat`         | -              | Multi-tenant test (Brindle side)                        |

---

## 7. Seed Dataset Summary & Counts

The seed dataset contains exactly **37 database records** in strict dependency order:

| Entity Table        | Scope / Role           | Seeded Count | Status Breakdown                                                                                                                                    |
| ------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.users`         | `platform_admin`       | **3**        | 2 `active` (`admin_super`, `admin_support`), 1 `suspended` (`admin_suspended`)                                                                      |
| `app.organizations` | Organization Tenants   | **2**        | 1 `paid_active` (`aster-ridge`), 1 `trial_active` (`brindle-co`)                                                                                    |
| `app.entitlements`  | Per-Org Quotas & Flags | **2**        | 1 for `aster-ridge`, 1 for `brindle-co`                                                                                                             |
| `app.users`         | `company_admin`        | **11**       | 8 Aster (`owner`, `admin2`, `hm`, `invited`, `suspended`, `deactivated`, `unverified`, `locked`) + 3 Brindle (`owner`, `admin2`, `invited_expired`) |
| `app.users`         | `candidate`            | **19**       | 10 standalone/edge-case candidates + 2 multi-tenant candidates + 7 pipeline state candidates                                                        |
| **TOTAL**           |                        | **37**       |                                                                                                                                                     |

---

## 8. Not Seeded Yet: Tables Not in Migrations

The following entities and planned states from earlier design drafts are **not seeded in the database**:

| Planned Entity            | Target Tables (Proposed in Spec)                                       | Planned States / Coverage                                                                               | Specification Source             |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Templates**             | `app.templates`, `app.template_versions`, `app.template_assignments`   | Blueprint task `backend-incident-debug` (`draft`, `tested`, `published`)                                | `AGENTS.md` §6.2                 |
| **Assessments**           | `app.assessments`, `app.rubric_items`                                  | `draft`, `dry_run_passed`, `published` (cloud & chat modes), `closed`, `archived`                       | `AGENTS.md` §6.2, `openapi.yaml` |
| **Assignments**           | `app.assignments`, `app.workspaces`, `app.consents`                    | `invited`, `window_not_open`, `ready`, `in_progress`, `disconnected`, `submitted`, `expired`, `revoked` | `AGENTS.md` §6.3, `openapi.yaml` |
| **Submissions & Reviews** | `app.submissions`, `app.reviews`, `app.agent_runs`, `app.agent_scores` | `pending`, `agents_running`, `agent_report_ready`, `human_review`, `finalized`, `released`              | `AGENTS.md` §6.5                 |

> [!NOTE] > **Why these are not seeded:**
> The repository currently contains only a single migration file: [`packages/contracts/db/migrations/0001_tenancy_foundation.sql`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/packages/contracts/db/migrations/0001_tenancy_foundation.sql), which defines `audit.events`, `app.organizations`, `app.entitlements`, and `app.users`.
> No migration files exist yet for templates, assessments, assignments, or reviews. In adherence to rule BR-03 and repository invariants, `@hs/fixtures` only seeds tables that physically exist in database migrations. These entities will be added in Slice 2 once their respective migration files are authored and merged.

---

## 9. Organization Status Coverage & Unseeded Statuses

The `app.organizations.status` column allows five states: `'provisioned'`, `'trial_active'`, `'trial_expired'`, `'paid_active'`, `'suspended'`.

### Seeded Statuses:

- **`paid_active`** (`aster-ridge`): Covers full-featured commercial operation (retention 90 days, 5 templates, 25 candidates, cloud + chat workspaces).
- **`trial_active`** (`brindle-co`): Covers active trial evaluation with restricted quotas (retention 30 days, 1 template, 5 candidates, chat-only workspaces).

### Unseeded Statuses & Rationale:

- **`provisioned`**: The initial onboarding state before payment or trial activation. Seeding an organization in `provisioned` state would prevent developers from exploring active platform features immediately upon logging in. Provisioning flows and gate checks are validated dynamically via unit/API tests rather than static seed tenants.
- **`trial_expired`**: The terminal state when an organization's trial window has elapsed. `brindle-co` is seeded as `trial_active` to test active trial limits and expiration warning banners. Trial expiration and cutoff behaviors are tested dynamically by advancing trial timestamps or simulating expired entitlements.
- **`suspended`**: The administrative lock state when an organization is disabled by a platform admin. Seeding a pre-suspended organization would make that tenant unusable for standard manual testing. Organization suspension behavior is validated dynamically in automated tests via status mutation (e.g. `UPDATE app.organizations SET status = 'suspended'`).
