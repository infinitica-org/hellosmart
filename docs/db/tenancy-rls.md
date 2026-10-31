# HelloSmart.ai — PostgreSQL RLS Policies & Tenant Scoping Specification (BR-01)

> **Audience:** Backend Engineers, Database Architects, DevOps, Security Engineers  
> **Status:** Active Specification (Stream 4: Task 4.1)  
> **Authority:** In accordance with [AGENTS.md](../../AGENTS.md) §8 (Business Rule BR-01: Tenant Isolation) and §4 (Roles and RBAC).

---

## 1. Executive Summary & Multi-Tenancy Principles

HelloSmart.ai is a multi-tenant platform. Business Rule **BR-01** mandates:

> **BR-01 Tenant Isolation:** Every query, cache key, file path, job, and log is scoped by `org_id`. Cross-org reads must return 404. Automated cross-tenant tests are required for every endpoint.

In HelloSmart.ai, multi-tenancy is enforced **at the PostgreSQL kernel level** using native **Row-Level Security (RLS)**. Even if an application service or developer forgets a `WHERE org_id = $1` clause in a SQL query, the database query planner automatically injects the tenant boundary, preventing data leakage across tenant boundaries.

---

## 2. How Multi-Tenant Isolation Works

### 2.1 The Core Invariants

For any table containing customer tenant data, four invariants are enforced:

1. **Tenant Anchor:** The table contains `org_id uuid NOT NULL REFERENCES app.organizations(id)` (or joins directly to an entity containing `org_id`).
2. **Leading Index:** An index leading with `org_id` exists to ensure optimal query planner performance and fast RLS filter evaluation.
3. **RLS Enabled & Forced:**
   ```sql
   ALTER TABLE app.<table_name> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE app.<table_name> FORCE ROW LEVEL SECURITY;
   ```
   _Note:_ `FORCE ROW LEVEL SECURITY` ensures that table owners (`hs_migrator`) and background tasks cannot accidentally bypass RLS unless an explicit policy grants it.
4. **Tenant Isolation Policy:**
   ```sql
   CREATE POLICY tenant_isolation ON app.<table_name>
     USING (org_id = app.current_org_id() OR app.is_platform())
     WITH CHECK (org_id = app.current_org_id() OR app.is_platform());
   ```

### 2.2 Context Resolution Functions

PostgreSQL determines the current tenant via helper SQL routines:

1. **`app.current_org_id()`**:

   ```sql
   CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
   LANGUAGE sql STABLE AS $$
     SELECT nullif(current_setting('app.org_id', true), '')::uuid
   $$;
   ```

   - Reads the transaction-local runtime setting `app.org_id`.
   - Returns `uuid` when configured.
   - **Fail-Closed:** Returns `NULL` when unset or empty. Any evaluation against `org_id = app.current_org_id()` yields `NULL`, resulting in zero rows returned.
   - If an invalid (non-UUID) string is injected, PostgreSQL raises a controlled `22P02` (`invalid input syntax for type uuid`) and aborts the transaction immediately.

2. **`app.is_platform()`**:

   ```sql
   CREATE OR REPLACE FUNCTION app.is_platform() RETURNS boolean
   LANGUAGE plpgsql STABLE AS $$
   BEGIN
     IF coalesce(nullif(trim(current_setting('app.is_platform', true)), ''), 'false')::boolean IS NOT TRUE THEN
       RETURN false;
     END IF;

     RETURN SESSION_USER IN ('hs_platform', 'hs_migrator');
   END;
   $$;
   ```

   - **Dual-Factor Enforcement:** Requires **both** `current_setting('app.is_platform', true) = 'true'` **and** authenticated database role `SESSION_USER IN ('hs_platform', 'hs_migrator')`.
   - Application connections authenticated as `hs_app` evaluate to `false` even if an attacker manages to set `app.is_platform = true` via SQL injection or custom GUC manipulation.

---

## 3. Application Request Context Injection & Pool Safety

### 3.1 Transaction-Local Scope Rule (`is_local = true`)

When setting PostgreSQL configuration variables in a pooled connection architecture, **session-level parameters (`SET app.org_id = ...`) must never be used**. If a connection is returned to the pool with session-level settings active, subsequent requests handled by that connection could leak the previous tenant's data.

All HelloSmart API helpers enforce transaction-local settings:

```sql
SELECT set_config('app.org_id', $1, true);
```

Passing `true` as the third parameter (`is_local = true`) guarantees:

- The setting is active **only** within the current `BEGIN ... COMMIT / ROLLBACK` block.
- Once the transaction completes (committed or rolled back), PostgreSQL automatically discards the setting.
- An unscoped probe on the same connection outside a transaction returns `NULL`.

### 3.2 Canonical Application Helpers

1. **`withOrg(client, orgId, fn)`** (`apps/api/src/modules/tenancy/with-org.ts`):
   ```typescript
   export async function withOrg<T>(
     client: PoolClient,
     orgId: string,
     fn: (tx: PoolClient) => Promise<T>,
   ): Promise<T> {
     await client.query('BEGIN');
     try {
       await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
       const result = await fn(client);
       await client.query('COMMIT');
       return result;
     } catch (err) {
       await client.query('ROLLBACK');
       throw err;
     }
   }
   ```
2. **`TenantContextService` & `TenantContextInterceptor`** (`apps/api/src/common/database/tenant-context.service.ts`):
   - Uses Node.js `AsyncLocalStorage` to propagate tenant context across asynchronous service boundaries.
   - Throws `TENANT_REQUIRED` (403) before acquiring a database client if a non-platform request lacks `orgId`.
   - Automatically wraps authenticated requests in `BEGIN ... COMMIT` and sets `app.org_id`.

---

## 4. Platform Administration & Role Boundaries

| Database Role     | LOGIN Allowed?         | BYPASSRLS?             | Purpose                                          | Schema Grants                                                            |
| ----------------- | ---------------------- | ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| **`hs_owner`**    | No (AWS) / Yes (Local) | Yes                    | Object ownership and disaster recovery           | Full DDL/DML                                                             |
| **`hs_migrator`** | Yes (Dedicated task)   | No (`migrator_policy`) | Schema migration execution and fixture seeding   | DDL on `app`, `audit`                                                    |
| **`hs_app`**      | Yes                    | **NO** (`NOBYPASSRLS`) | Application runtime (API & Workers)              | DML (SELECT, INSERT, UPDATE, DELETE on `app`; SELECT, INSERT on `audit`) |
| **`hs_platform`** | Yes (Admin portal)     | **NO** (`NOBYPASSRLS`) | Platform administration and cross-tenant support | DML on `app`, SELECT/INSERT on `audit`                                   |
| **`hs_readonly`** | Yes                    | **NO** (`NOBYPASSRLS`) | Analytics / reporting read access                | SELECT on `app`, `audit`                                                 |

**Security Guarantees:**

- `hs_app` is explicitly revoked from inheriting or assuming `hs_platform` (`0005_platform_role.sql:23`).
- `hs_platform` does NOT possess `BYPASSRLS`. To inspect cross-tenant data, it must execute within a transaction setting `app.is_platform = true`, and every cross-tenant action must be written to `audit.events` (BR-31).

---

## 5. Table-by-Table Status Matrix

Every table in schemas `app` and `audit` adheres to the following verification audit:

| Table Name             | Schema  | Tenant Column                  | Index on Tenant                      | RLS Enabled?     | RLS Forced?      | Policies Defined                                                               | Isolation Mechanism                                                                                                                                                 |
| ---------------------- | ------- | ------------------------------ | ------------------------------------ | ---------------- | ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`organizations`**    | `app`   | `id` (PK)                      | PK (`id`)                            | **YES**          | **YES**          | `tenant_isolation`, `migrator_policy`                                          | `id = app.current_org_id() OR app.is_platform()`                                                                                                                    |
| **`entitlements`**     | `app`   | `org_id` (PK, FK)              | PK (`org_id`)                        | **YES**          | **YES**          | `tenant_isolation`, `migrator_policy`                                          | `org_id = app.current_org_id() OR app.is_platform()`; WITH CHECK `app.is_platform()`                                                                                |
| **`users`**            | `app`   | `org_id` (FK, nullable for PA) | `users_org_idx`                      | **YES**          | **YES**          | `tenant_isolation`, `migrator_policy`                                          | `org_id = app.current_org_id() OR app.is_platform()`                                                                                                                |
| **`invitations`**      | `app`   | `org_id` (FK, NOT NULL)        | `invitations_org_idx`                | **YES**          | **YES**          | `tenant_isolation`, `migrator_policy`                                          | `org_id = app.current_org_id() OR app.is_platform()`                                                                                                                |
| **`events`**           | `audit` | `org_id` (nullable for PA)     | `audit_org_at_idx`                   | **YES**          | **YES**          | `tenant_isolation` (SELECT), `audit_insert_policy` (INSERT), `migrator_policy` | SELECT: `org_id = app.current_org_id() OR app.is_platform()`; INSERT: `WITH CHECK (true)`                                                                           |
| **`password_history`** | `app`   | Indirect via `user_id`         | `password_history_user_idx`          | **YES**          | **YES**          | `tenant_isolation`, `migrator_policy`                                          | `EXISTS (SELECT 1 FROM app.users WHERE id = user_id AND (org_id = current_org_id() OR is_platform()))`                                                              |
| **`mfa_backup_codes`** | `app`   | Indirect via `user_id`         | `mfa_backup_codes_user_idx` _(0010)_ | **YES** _(0010)_ | **YES** _(0010)_ | `tenant_isolation`, `migrator_policy` _(0010)_                                 | `EXISTS (SELECT 1 FROM app.users WHERE id = user_id AND (org_id = current_org_id() OR is_platform()))`; direct table privileges revoked from `hs_app`/`hs_platform` |

---

## 6. Standard Blueprint for Future Tenant Tables

The business tables below are referenced in the Product Requirements Document ([AGENTS.md](../../AGENTS.md)) but **do not yet exist in migrations**:

- **`app.assessments`**: Created from template (Requirement **CO-020**, `AGENTS.md:450`).
- **`app.assignments`**: Candidate task assignment (Requirements **CO-025**, **CO-026**, `AGENTS.md:463, 465`).
- **`app.submissions`**: Candidate submission artifacts and progress (Requirements **CO-041**, **CO-042**, `AGENTS.md:509, 511`).

### 6.1 Copy-Paste SQL Migration Template

When introducing any new tenant-owned table, copy and apply this exact template:

```sql
-- Migration: Add app.<table_name> with strict tenant scoping (BR-01)

CREATE TABLE app.<table_name> (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  -- Business fields go here
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 1. Create index LEADING with org_id for fast RLS filtering
CREATE INDEX <table_name>_org_idx ON app.<table_name> (org_id);

-- 2. Enable and FORCE Row-Level Security
ALTER TABLE app.<table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.<table_name> FORCE ROW LEVEL SECURITY;

-- 3. Define Migrator Policy (allows seed and migration tasks full access)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    DROP POLICY IF EXISTS migrator_policy ON app.<table_name>;
    CREATE POLICY migrator_policy ON app.<table_name>
      FOR ALL TO hs_migrator
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Define Strict Tenant Isolation Policy
DROP POLICY IF EXISTS tenant_isolation ON app.<table_name>;
CREATE POLICY tenant_isolation ON app.<table_name>
  FOR ALL
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- 5. Grant explicit least-privilege permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON app.<table_name> TO hs_app;
GRANT SELECT ON app.<table_name> TO hs_readonly;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.<table_name> TO hs_platform;
  END IF;
END $$;
```

### 6.2 Reviewer Checklist for New Migrations

- [ ] Does the table include `org_id uuid NOT NULL REFERENCES app.organizations(id)`?
- [ ] Does an index exist that **leads** with `org_id`?
- [ ] Are both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` invoked?
- [ ] Is policy `tenant_isolation` defined using `(org_id = app.current_org_id() OR app.is_platform())` for both `USING` and `WITH CHECK`?
- [ ] Is `migrator_policy` defined for role `hs_migrator`?
- [ ] Are permissions explicitly granted to `hs_app`, `hs_platform`, and `hs_readonly`?
- [ ] Has an automated cross-tenant test been added to `apps/api/test/cross-tenant.test.ts`?

---

## 7. Automated Testing & Verification

Automated RLS verification is executed via Vitest in the `@hs/api` package:

```bash
# Run tenancy RLS verification test suite
pnpm test:tenancy
```

### Verified Test Cases (`apps/api/test/cross-tenant.test.ts`)

All 24 test cases are automated and verified against live PostgreSQL:

1. **Physical Role Verification:** Confirms `hs_app` connection has `rolsuper = false` and `rolbypassrls = false`.
2. **Catalog RLS Attributes:** Asserts `relrowsecurity = true` and `relforcerowsecurity = true` across all tenant tables and `audit.events`.
3. **Direct Unauthenticated Read Isolation:** Confirms unscoped `SELECT` without tenant context returns 0 rows across all tables.
4. **Pre-Login Identity Resolution:** Verifies SECURITY DEFINER routine `app.find_user_for_login` resolves users without exposing other tenants.
5. **Soft-Deleted Exclusion:** Verifies deleted accounts are invisible to login resolution.
6. **User Lookup by ID:** Verifies `app.find_user_by_id` resolves UUID without tenant context pre-login.
7. **Pre-Login Invitation Lookup:** Verifies `app.find_invitation_by_token_hash` only resolves valid, unexpired, unused invitations.
8. **Org A Scoping:** Tests Org A context strictly sees only its own records and 0 rows for Org B.
9. **Org B Scoping:** Tests Org B context strictly sees only its own records and 0 rows for Org A.
   10a. **Attack Test (Forged Platform Setting):** `hs_app` setting `app.is_platform = true` evaluates `app.is_platform()` to `false` and yields 0 rows.
   10b. **Attack Test (Forged Cross-Tenant Insert):** `hs_app` setting `app.is_platform = true` cannot insert cross-tenant records.
   10c. **Attack Test (Privilege Escalation):** `hs_app` cannot execute `SET ROLE hs_platform` (denied at database kernel level).
   10d. **Platform Connection without Setting:** Legitimate `hs_platform` connection without `app.is_platform` setting returns 0 rows.
   10e. **Platform Dual-Factor Bypass:** Legitimate `hs_platform` connection with `app.is_platform = true` can query across all tenants.
10. **Audit Immutability:** Confirms direct `UPDATE` and `DELETE` on `audit.events` are strictly rejected by trigger and privilege grants.
11. **Routine Privilege Hardening:** Verifies execution privileges are granted to `hs_app` & `hs_platform`, and revoked from `PUBLIC`.
12. **Multi-Table Scoping:** Verifies multi-table queries strictly isolate all tenant tables under `hs_app`.
13. **Fail-Closed NULL Context:** Without tenant context (`app.org_id` NULL), all tenant tables return 0 rows under `hs_app`, and unauthenticated `INSERT` fails closed.
14. **Savepoint Write Isolation:** Cross-tenant `INSERT` and `UPDATE` fail `WITH CHECK`; `UPDATE` and `DELETE` on another tenant affect 0 rows.
15. **Pool Leakage Prevention:** Reused pooled connection (`max: 1`) does not leak tenant context across consecutive transactions.
16. **Credential Table Isolation & Privilege Revocation:** Direct queries to `app.mfa_backup_codes` by `hs_app` are rejected with `permission denied` (least privilege); `app.password_history` is strictly isolated.
17. **MFA Backup Code Pre-Login Execution:** SECURITY DEFINER functions (`insert_mfa_backup_code_hash`, `consume_mfa_backup_code`, `count_unused_mfa_backup_codes`, `delete_mfa_backup_codes_for_user`) execute pre-login without tenant context and enforce cross-user isolation.
18. **Audit Insert Policy Scoping:** Policy `audit_insert_policy` allows cross-org inserts with `WITH CHECK (true)` for platform/pre-login logging, while `SELECT` strictly enforces tenant scoping.
19. **Dual-Factor Admin Bypass:** Platform admin RLS bypass strictly requires both authenticated role `hs_platform` and transaction setting `app.is_platform = true`.

---

## 8. Known Limitations & Next Steps

1. **Uncreated Business Tables:** Tables for assessments, assignments, and submissions are not yet created in the schema. When authored in Stream 6/8, they must follow the blueprint in §6.1.
2. **Cross-Tenant 404 vs 403 Response Codes:** As specified in BR-01, API endpoints querying resources across tenant boundaries must return HTTP 404 (Not Found) rather than HTTP 403 (Forbidden) to prevent confirming the existence of another tenant's entity.

---

## 9. Architectural Decisions & Scope Notes

### Decision A: Child Credential Tables (`password_history`, `mfa_backup_codes`)

- **Status:** Confirmed from the code; to be confirmed by Vishal V.
- **Specification:** `app.password_history` and `app.mfa_backup_codes` do **NOT** carry their own `org_id` column.
- **Rationale:**
  1. Platform administrators have `org_id NULL` enforced by the `platform_has_no_org` database constraint. If these child credential tables required `org_id uuid NOT NULL`, platform admin password history and MFA backup codes could not be stored.
  2. Both tables have a foreign key `user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE`. Tenant isolation is fully resolved through the parent user via:
     ```sql
     EXISTS (
       SELECT 1 FROM app.users u
       WHERE u.id = <table>.user_id
         AND (u.org_id = app.current_org_id() OR app.is_platform())
     )
     ```
  3. Indexes on `user_id` (`password_history_user_idx`, `mfa_backup_codes_user_idx`) ensure sub-millisecond subquery resolution under RLS.

### Decision B: Audit Event Append Decoupling (`audit.events`)

- **Status:** Confirmed from the code; to be confirmed by Vishal V.
- **Specification:** `audit.events` retains policy `audit_insert_policy` with `WITH CHECK (true)`.
- **Rationale:**
  1. Pre-login events (failed login attempts, rate-limiting violations, lockout triggers) and background system jobs operate without an active `app.org_id` session context.
  2. While `SELECT` queries are strictly isolated to the caller's tenant (`org_id = app.current_org_id() OR app.is_platform()`), `INSERT` must be permitted without tenant context.
  3. An `hs_app` connection can insert an audit record carrying another tenant's `org_id` (verified in test 19); however, it cannot read back that record (an `INSERT ... RETURNING` fails under RLS).
  4. Immutability and tamper-evidence are guaranteed by the append-only trigger (`audit_no_update`), revocation of `UPDATE`/`DELETE` grants, and cryptographic SHA-256 hash chaining (`prev_hash` sequence).

### Decision C: Least-Privilege Table Grants on `app.mfa_backup_codes`

- **Status:** Confirmed from backend review.
- **Specification:** Direct table access (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) is completely revoked from `hs_app` and `hs_platform`.
- **Rationale:**
  1. Backup codes represent highly sensitive cryptographic credentials and should never be queried directly by application services.
  2. All operations (insertion during enrollment, single-use consumption, count check, deletion upon reset) are executed exclusively through `SECURITY DEFINER` routines owned by `hs_migrator`:
     - `app.insert_mfa_backup_code_hash(user_id, code_hash)`
     - `app.consume_mfa_backup_code(user_id, code_hash)`
     - `app.count_unused_mfa_backup_codes(user_id)`
     - `app.delete_mfa_backup_codes_for_user(user_id)`
     - `app.confirm_mfa_enrollment(user_id, code_hash)`
     - `app.get_mfa_enrollment_pending(user_id)`
  3. Under `FORCE ROW LEVEL SECURITY`, `hs_migrator` satisfies `migrator_policy` (`USING (true) WITH CHECK (true)`), enabling reliable pre-login operation.
  4. Direct queries by `hs_app` fail closed with PostgreSQL error `42501` (`permission denied for table mfa_backup_codes`).
