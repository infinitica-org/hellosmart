-- HelloSmart 4.2 Query Benchmark Suite (T-036, T-037, BR-01, BR-31)
--
-- This script benchmarks key high-throughput candidate assessment and integrity queries
-- against PostgreSQL with EXPLAIN (ANALYZE, BUFFERS).
-- Target latency for all primary queries: < 10ms.
--
-- Usage:
--   psql -U hs_app -d <database> -v org_id="'00000000-0000-4000-8000-000000000001'" \
--        -v candidate_role="'candidate'" -v status="'active'" \
--        -v version_id="'00000000-0000-4000-8000-000000000002'" \
--        -f packages/contracts/db/bench/benchmark-queries.sql

\set ON_ERROR_STOP on

-- Default parameters if not supplied externally
\if :{?org_id}
\else
  \set org_id '\'00000000-0000-4000-8000-000000000001\''
\endif

\if :{?candidate_role}
\else
  \set candidate_role '\'candidate\''
\endif

\if :{?status}
\else
  \set status '\'active\''
\endif

\if :{?version_id}
\else
  \set version_id '\'00000000-0000-4000-8000-000000000002\''
\endif

--------------------------------------------------------------------------------
-- Query 1: Candidate Listing by Tenant and Status
-- Application site: apps/api/src/modules/candidates/candidates.service.ts
-- Expected Plan: Bitmap Heap Scan using idx_users_org_status (or Index Scan)
-- Target Execution Time: < 10ms (Observed with 50,000 synthetic rows: ~1.16ms)
--------------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, email, name, role, status, created_at
FROM app.users
WHERE org_id = :org_id
  AND role = :candidate_role
  AND status = :status
ORDER BY created_at DESC
LIMIT 50;

--------------------------------------------------------------------------------
-- Query 2: Assessment Listing by Organization
-- Application site: Assessment queries filtered by tenant and lifecycle status
-- Index used: idx_assessments_status on app.assessments (org_id, status)
-- Expected Plan: Index Scan / Bitmap Index Scan on idx_assessments_status
-- Target Execution Time: < 10ms (Observed with 50,000 synthetic rows: ~4.48ms)
--------------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, org_id, template_version_id, name, workspace_mode, status, created_at
FROM app.assessments
WHERE org_id = :org_id
  AND status = :status
ORDER BY created_at DESC
LIMIT 50;

--------------------------------------------------------------------------------
-- Query 3: Template Version Lookup & Status Check (BR-03)
-- Application site: Workspace orchestrator & assessment launch checks
-- Index used: template_versions_pkey (PRIMARY KEY on id)
-- Expected Plan: Index Scan using template_versions_pkey
-- Target Execution Time: < 1ms (Single row indexed fetch)
--------------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, template_id, version, status, manifest
FROM app.template_versions
WHERE id = :version_id;

--------------------------------------------------------------------------------
-- Query 4: Audit Event Insertion (Append-Only Integrity)
-- Application site: apps/api/src/common/audit/audit-writer.ts
-- Triggers evaluated: audit_append_only (row-level), audit_no_truncate (statement-level)
-- Expected: Fast INSERT execution with zero mutation ability
-- Target Execution Time: < 5ms
--------------------------------------------------------------------------------
EXPLAIN (ANALYZE, BUFFERS)
INSERT INTO audit.events (
  actor_id,
  actor_role,
  org_id,
  action,
  entity,
  entity_id,
  hash
) VALUES (
  :org_id,
  'company_admin',
  :org_id,
  'BENCHMARK_PROBE',
  'benchmark',
  gen_random_uuid()::text,
  '\x0123456789abcdef'::bytea
);
