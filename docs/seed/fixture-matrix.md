# HelloSmart Test Data Matrix & Fixture Specification

> [!WARNING] > **DEV / TEST CREDENTIALS ONLY**  
> All credentials, emails, and tokens documented here are strictly intended for local development, integration testing, and CI/CD validation. **Never use these passwords, tokens, or emails in production environments.**

---

## 1. Overview & Architectural Alignment

This document defines the deterministic test data matrix for HelloSmart's core entities, strictly aligned with **Vishal's PostgreSQL schema** ([`packages/contracts/db/migrations/0001_tenancy_foundation.sql`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/packages/contracts/db/migrations/0001_tenancy_foundation.sql)) and the HelloSmart Product Spec ([`AGENTS.md`](file:///c:/Users/Vedika/OneDrive/Infinitica/hellosmart/AGENTS.md)).

### Core Schema & Tenancy Invariants

1. **Tenant Isolation (`BR-01`)**: Every tenant record (`app.organizations`, `app.entitlements`, `app.users`) carries an `org_id` UUID with row-level security enforced.
2. **Platform Role Constraint**: `CONSTRAINT platform_has_no_org CHECK ((role = 'platform_admin') = (org_id IS NULL))` ensures platform administrators have no organization attachment.
3. **Deterministic UUIDv5**: All entity IDs are derived deterministically via UUIDv5 from fixed category namespaces to ensure repeatable test executions without collisions.
4. **Soft-Deletion**: User deletion is tracked non-destructively using `app.users.deleted_at` timestamps.

---

## 2. Organizations & Entitlements Matrix

| Field                         | Aster Ridge Technologies (Paid Active)                 | Brindle & Co (Trial Active)              |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| **Deterministic UUID**        | `03fa0961-c787-51dd-a4f6-d445495111c6`                 | `43598d97-152e-5fe9-95e5-f55db8858a7f`   |
| **Name**                      | Aster Ridge Technologies                               | Brindle & Co                             |
| **Slug (`citext UNIQUE`)**    | `aster-ridge`                                          | `brindle-co`                             |
| **Status**                    | `paid_active`                                          | `trial_active`                           |
| **Custom Domain**             | `hire.asterridge.com`                                  | `null`                                   |
| **Logo Key**                  | `logos/aster.png`                                      | `null`                                   |
| **Retention Window**          | 90 days                                                | 30 days                                  |
| **Created By (`created_by`)** | `superadmin@hellosmart.ai` (UUID)                      | `superadmin@hellosmart.ai` (UUID)        |
| **Max Templates**             | **10**                                                 | **2**                                    |
| **Max Candidates**            | **100**                                                | **10**                                   |
| **Trial Window**              | `null` (Paid Plan)                                     | **14 Days** (`TRIAL_DURATION_DAYS = 14`) |
| **Pending Invite Multiplier** | `2.0`                                                  | `2.0`                                    |
| **Feature Flags**             | `{"cloud": true, "chat": true, "custom_domain": true}` | `{"chat": true}`                         |

---

## 3. Platform & Company Administrators

All admin users have login credentials configured for development.

| Role             | Organization              | Name                | Email                      | Status   | Password (Dev Only) | MFA Config                              | Notes                                                 |
| ---------------- | ------------------------- | ------------------- | -------------------------- | -------- | ------------------- | --------------------------------------- | ----------------------------------------------------- |
| `platform_admin` | _(None - `org_id: null`)_ | Super Admin         | `superadmin@hellosmart.ai` | `active` | `DevPassword123!`   | Enabled (`secrets/seed-superadmin-mfa`) | Full platform admin access; creator of organizations  |
| `company_admin`  | Aster Ridge Technologies  | Aster Ridge Admin   | `admin@asterridge.com`     | `active` | `DevPassword123!`   | Disabled                                | Primary company administrator for mature paid tenant  |
| `company_admin`  | Brindle & Co              | Brindle Trial Admin | `trialadmin@brindle.co`    | `active` | `DevPassword123!`   | Disabled                                | Primary company administrator for active trial tenant |

---

## 4. Candidate State Distribution

Candidates are distributed across all four schema statuses: `active`, `invited`, `suspended`, and `deleted`. Candidate counts total **exactly 100 for Aster Ridge** and **exactly 10 for Brindle & Co**.

| Organization                 | Status      | Count   | Email Pattern                                                | Must Reset Password | Email Verified    | Soft Deleted (`deleted_at`) | Dev Password      |
| ---------------------------- | ----------- | ------- | ------------------------------------------------------------ | ------------------- | ----------------- | --------------------------- | ----------------- |
| **Aster Ridge Technologies** | `active`    | **70**  | `candidate.aster-ridge.001@example.com` … `.070@example.com` | `false`             | Yes (`ref - 10d`) | `null`                      | `DevPassword123!` |
|                              | `invited`   | **15**  | `candidate.aster-ridge.071@example.com` … `.085@example.com` | `true`              | `null`            | `null`                      | _Pending reset_   |
|                              | `suspended` | **10**  | `candidate.aster-ridge.086@example.com` … `.095@example.com` | `false`             | Yes (`ref - 15d`) | `null`                      | `DevPassword123!` |
|                              | `deleted`   | **5**   | `candidate.aster-ridge.096@example.com` … `.100@example.com` | `false`             | Yes (`ref - 20d`) | `ref - 4d`                  | `DevPassword123!` |
| **Aster Ridge Subtotal**     |             | **100** |                                                              |                     |                   |                             |                   |
| **Brindle & Co**             | `active`    | **4**   | `candidate.brindle-co.01@example.com` … `.04@example.com`    | `false`             | Yes (`ref - 5d`)  | `null`                      | `DevPassword123!` |
|                              | `invited`   | **3**   | `candidate.brindle-co.05@example.com` … `.07@example.com`    | `true`              | `null`            | `null`                      | _Pending reset_   |
|                              | `suspended` | **1**   | `candidate.brindle-co.08@example.com`                        | `false`             | Yes (`ref - 7d`)  | `null`                      | `DevPassword123!` |
|                              | `deleted`   | **2**   | `candidate.brindle-co.09@example.com` … `.10@example.com`    | `false`             | Yes (`ref - 10d`) | `ref - 2d`                  | `DevPassword123!` |
| **Brindle & Co Subtotal**    |             | **10**  |                                                              |                     |                   |                             |                   |
| **TOTAL CANDIDATES**         |             | **110** |                                                              |                     |                   |                             |                   |

---

## 5. Sample Candidate Records & Edge Case Details

| Candidate Email                         | Org          | Role        | Status      | Lifecycle Behavior & Verification Goal                                                                      |
| --------------------------------------- | ------------ | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `candidate.aster-ridge.001@example.com` | Aster Ridge  | `candidate` | `active`    | Standard active candidate; connect to Cloud or Chat workspaces permitted.                                   |
| `candidate.aster-ridge.071@example.com` | Aster Ridge  | `candidate` | `invited`   | Newly invited candidate; must perform first-time password reset before accessing workspaces (`BR-24`).      |
| `candidate.aster-ridge.086@example.com` | Aster Ridge  | `candidate` | `suspended` | Suspended candidate; session launch is rejected with account suspended error.                               |
| `candidate.aster-ridge.096@example.com` | Aster Ridge  | `candidate` | `deleted`   | Soft-deleted candidate (`deleted_at` set); hidden from default candidate lists while preserving audit logs. |
| `candidate.brindle-co.01@example.com`   | Brindle & Co | `candidate` | `active`    | Active trial candidate; subject to trial quota caps (max 10 candidates).                                    |
| `candidate.brindle-co.05@example.com`   | Brindle & Co | `candidate` | `invited`   | Invited trial candidate; counts against pending invite multiplier quota (`BR-06`).                          |
| `candidate.brindle-co.08@example.com`   | Brindle & Co | `candidate` | `suspended` | Suspended candidate within a trial tenant.                                                                  |
| `candidate.brindle-co.09@example.com`   | Brindle & Co | `candidate` | `deleted`   | Soft-deleted candidate within a trial tenant.                                                               |

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
                  |
                  +-----> app.entitlements.org_id (2 templates, 10 candidates, 14-day trial)
                  +-----> app.users.org_id (trialadmin@brindle.co, candidate.brindle-co.*)
```

1. `app.organizations.created_by` references `app.users(id)` where `role = 'platform_admin'`.
2. `app.entitlements.org_id` references `app.organizations(id)` as a 1:1 foreign key.
3. `app.users.org_id` references `app.organizations(id)` for all company admins and candidates.
4. `UNIQUE (org_id, email)` guarantees email uniqueness within any individual tenant.
