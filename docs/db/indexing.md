# Database Indexing, Query Optimization & Audit Triggers (Subtask 4.2)

> **Traceability**: `BR-01`, `BR-03`, `BR-31`  
> **Migration**: `packages/contracts/db/migrations/0013_indexes_and_triggers.sql`  
> **Benchmark Suite**: `packages/contracts/db/bench/benchmark-queries.sql`  
> **Test Suite**: `apps/api/test/indexing-and-triggers.test.ts`

---

## 1. Query Patterns & Index Decisions

### 1.1 Candidate Listing by Tenant and Status

- **Real Query Site**: `apps/api/src/modules/candidates/candidates.service.ts`
  ```sql
  SELECT id, email, name, role, status, created_at
  FROM app.users
  WHERE org_id = $1 AND role = 'candidate' AND status = $2
  ORDER BY created_at DESC
  LIMIT 50;
  ```
- **Index Added**: `idx_users_org_status` on `app.users (org_id, status)`
- **Rationale & Benchmark Findings**:
  - Baseline (no status index, relying on `users_org_idx (org_id)`): `4.75ms` median execution time (Bitmap Heap Scan over tenant rows).
  - Ticket Candidate Index `(org_id, status)`: `1.16ms` median execution time (**4.1x faster**). Filters out non-matching status values directly in the btree.
  - Wider Covering Index `(org_id, role, status, created_at DESC)`: `0.076ms` median (**62x faster**, Index Scan).
  - **Decision**: Implemented `(org_id, status)` in migration `0013` as specified by the ticket; both variants easily achieve the sub-10ms target. The wider covering index remains documented for future optimization if candidate volume demands an Index Scan over Bitmap Heap Scan.

### 1.2 Tenant User Lookup by Email

- **Evaluation**: Skipped in migration `0013` because `users_org_id_email_key UNIQUE (org_id, email)` already exists from migration `0001_tenancy_foundation.sql`. Adding a non-unique duplicate index would waste storage and write throughput with zero query performance benefit.

### 1.3 Assessment Listing by Organization (Representative Query)

- **Query**: `SELECT ... FROM app.assessments WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC`
- **Representative Benchmark**: Note that this query is a representative benchmark anticipating upcoming Stream 6 endpoints; it is not yet called by active application code in `apps/api/src/`.
- **Status**: `idx_assessments_status` on `app.assessments (org_id, status)` already exists from migration `0011_assessments.sql`.
- **Benchmark Result**: `4.48ms` median execution time on 50,000 synthetic rows (sub-10ms target met).

### 1.4 Deferred Candidate Assessment Indexes (`app.assignments`)

The following two compound indexes from ticket `4.2` target the candidate assessment lifecycle:

- `(assessment_id, status)`
- `(status, deadline_at)`

These fields belong to the `app.assignments` table, which is slated for creation in **Stream 2 (Candidate Experience & Assessment Run)**. They have been intentionally deferred to Stream 2 to prevent dead-index schema bloat ahead of table definition.

---

## 2. Note on `CONCURRENTLY` vs Migration Transactions

PostgreSQL prohibits `CREATE INDEX CONCURRENTLY` inside an explicit transaction block (`BEGIN ... COMMIT`).

Because the HelloSmart migration runner (`apps/api/src/db/migrate.ts`) executes each migration file inside a single transaction to guarantee atomic rollbacks on failure, migration `0013_indexes_and_triggers.sql` uses standard `CREATE INDEX IF NOT EXISTS`.

### Production Deployment Guidance

On small-to-medium databases or during pre-launch migrations, table-level share locks are held momentarily during index creation. For high-volume production databases requiring zero table locking:

1. Out-of-band maintenance scripts should be run manually with `CREATE INDEX CONCURRENTLY` prior to the migration.
2. The migration runner will subsequently observe that the index already exists (`IF NOT EXISTS`) and complete instantaneously without locking.

---

## 3. 50,000-Row Benchmark Methodology & Empirical Results

Benchmarking was conducted on a dedicated scratch database (`hellosmart_perf_check`) seeded with:

- 3 test organizations
- 50,000 synthetic candidate rows across active, inactive, and invited statuses
- 50,000 synthetic assessment rows with JSONB briefs and configurations
- Fully populated statistics via `ANALYZE`

### 3.1 Benchmark Environment & Constraints

- **Hardware & Runtime**: Local development workstation running Ubuntu 22.04 LTS under WSL2, hosting PostgreSQL 16.4 inside Docker container `hellosmart-postgres-1`.
- **Measurement Protocol**: 5 consecutive warm-cache execution iterations (`EXPLAIN (ANALYZE, BUFFERS)`) per scenario; reported figures represent the median execution time.
- **Approximation Notice**: Measurements reflect single-client local testing without concurrent query load, connection pooling contention, or network RTT. Production performance on AWS RDS will vary based on instance sizing and IOPS.

### 3.2 Results Summary (Median of 5 Iterations)

| Query Scenario                                                        | Execution Time (Median) | Target  | Target Met            | Query Plan                                   |
| --------------------------------------------------------------------- | ----------------------- | ------- | --------------------- | -------------------------------------------- |
| **Candidate List (org_id, status)**                                   | **1.16 ms**             | < 10 ms | **YES (4.1x faster)** | Bitmap Heap Scan on `idx_users_org_status`   |
| **Assessment List (org_id, status)** [Representative, not in app yet] | **4.48 ms**             | < 10 ms | **YES**               | Bitmap Heap Scan on `idx_assessments_status` |
| **Template Version Fetch (BR-03)**                                    | **0.071 ms**            | < 10 ms | **YES**               | Index Scan on `template_versions_pkey`       |
| **Audit Append Event (BR-31)**                                        | **3.199 ms**            | < 10 ms | **YES**               | Insert on `audit.events` + hash computation  |

All core queries execute comfortably in under 5ms, surpassing the 10ms acceptance criteria.

---

## 4. Audit Log Append-Only Guarantees & Residual Risks (`BR-31`)

Per `BR-31`, audit logs are strictly append-only.

### 4.1 Layered Protections in Migration 0013

1. **Row-Level Mutation Trigger (`audit.block_mutation`)**: Existing trigger from migration `0004` intercepts and aborts any `UPDATE` or `DELETE` attempt for all normal database roles.
2. **Statement-Level Truncate Trigger (`audit.block_truncate`)**: Row-level triggers do not fire on `TRUNCATE TABLE`. Migration `0013` adds `audit_no_truncate` on `audit.events` executing `audit.block_truncate()` to block statement-level truncations.
3. **Privilege Hardening**:
   - `hs_app`: `INSERT` and `SELECT` granted; `UPDATE, DELETE, TRUNCATE` revoked.
   - `hs_platform`: `INSERT` and `SELECT` granted; `UPDATE, DELETE, TRUNCATE` revoked.
   - `hs_readonly`: `INSERT, UPDATE, DELETE, TRUNCATE` revoked.
   - `hs_migrator`: `TRUNCATE` revoked.

### 4.2 Residual Operational Risks & Mitigations

PostgreSQL architecture retains two known pathways by which modifications could theoretically occur:

1. **Superuser Bypass (`hs_owner`)**: A database superuser can execute `SET session_replication_role = 'replica';`, bypassing triggers.
2. **DDL Tampering by Table Owner or Superuser**: The table owner (`hs_migrator`) or superuser can execute `ALTER TABLE audit.events DISABLE TRIGGER ALL;` or `DROP TABLE audit.events;`.

**Mitigations**:

- Application runtime services connect strictly via `hs_app` and `hs_platform` (NOBYPASSRLS, non-superusers).
- Cryptographic hash chaining (`hash = sha256(prev_hash || row_data)`) ensures any out-of-band manipulation breaks the hash chain and is immediately detectable.

---

## 5. BR-03 Template Version Immutability: Gap Analysis & Deferral

### 5.1 Observed Behavior

Trigger `app.prevent_published_template_mutation()` protects published templates:

```sql
IF OLD.status = 'published' AND (NEW.manifest != OLD.manifest OR NEW.version != OLD.version) THEN
  RAISE EXCEPTION 'Published template manifests are immutable and cannot be modified (BR-03)';
END IF;
```

- **Protected**: Updating `manifest` or `version` on a published version is blocked.
- **Protected**: Deleting a published version is blocked.
- **Current Gap**: Updating `status` from `'published'` to `'draft'` or `'tested'` is permitted by the current logic because `manifest` and `version` are unchanged.

### 5.2 Proposed Trigger Rewrite

```sql
CREATE OR REPLACE FUNCTION app.prevent_published_template_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published template versions are immutable and cannot be deleted (BR-03)';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status != 'published' OR NEW.manifest != OLD.manifest OR NEW.version != OLD.version THEN
      RAISE EXCEPTION 'Published template versions are immutable and cannot be modified or demoted (BR-03)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

### 5.3 Deferral Rationale

Modifying `app.prevent_published_template_mutation()` in migration `0013` was intentionally deferred awaiting product decision by Vishal V (specifically whether transitions such as `'published'` -> `'archived'` should be permitted in Phase 2). The gap is captured via skipped tests in `apps/api/test/indexing-and-triggers.test.ts`.

---

## 6. Stream 2 Future Table Checklist (`app.assignments`)

When `app.assignments` is authored during Stream 2:

1. Add compound index: `CREATE INDEX idx_assignments_assessment_status ON app.assignments (assessment_id, status);`
2. Add compound index: `CREATE INDEX idx_assignments_status_deadline ON app.assignments (status, deadline_at);`
3. Verify RLS tenant scoping policy on `app.assignments` matches `org_id` isolation.

---

## 7. Fresh-Database Provisioning & Role Grant Invariants

During test environment setup and verification on `hellosmart_test`, the following database role grant invariants were identified:

1. **Per-Database `ALTER DEFAULT PRIVILEGES` Scope**:
   In PostgreSQL, default privilege alterations are scoped strictly per database. When creating a fresh database (such as `hellosmart_test` or an ephemeral CI runner), default privileges configured on the primary database do not automatically apply.
2. **Migration Grant Scope**:
   Core tables (`app.users`, `app.organizations`, `app.entitlements`, `app.invitations`, `audit.events`) were created in early migrations without explicit `GRANT` statements, relying on `001_roles.sql`. When initializing a new database:
   - Run migrations: `pnpm db:migrate`
   - Apply table-level grants from `packages/contracts/db/init/001_roles.sql` as `hs_owner`.
   - Enforce least-privilege on sensitive credentials: explicitly ensure `REVOKE ALL ON app.mfa_backup_codes FROM hs_app, hs_platform;` (Decision C) and verify `audit.events` has `UPDATE, DELETE, TRUNCATE` revoked.
