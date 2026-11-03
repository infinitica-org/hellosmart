-- 0012 assignments (S1-T05-1)
-- Candidate assessment assignments with cryptographic invite tokens.
-- Depends on 0010_templates_and_assignments and 0011_assessments.

-- 1. Ensure composite unique constraints on app.assessments and app.users for tenant-relational integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_org_id_uq'
  ) THEN
    ALTER TABLE app.assessments ADD CONSTRAINT assessments_org_id_uq UNIQUE (org_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_org_id_uq'
  ) THEN
    ALTER TABLE app.users ADD CONSTRAINT users_org_id_uq UNIQUE (org_id, id);
  END IF;
END $$;

-- 2. Create app.assignments table
-- Assessment invite tokens:
-- Initial issuance sets invite_issued_at = now() and invite_expires_at <= invite_issued_at + 7 days.
-- Future resend (S1-T05-4): updates invite_token_hash, sets invite_issued_at = now(),
-- sets invite_expires_at = now() + 7 days, and resets invite_used_at = NULL atomically.
-- Anchoring to invite_issued_at (rather than invited_at) guarantees valid 7-day windows upon resend.
CREATE TABLE IF NOT EXISTS app.assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assessment_id       uuid NOT NULL,
  candidate_id        uuid NOT NULL,
  status              text NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited','window_not_open','ready','in_progress','disconnected','submitted','expired','revoked')),
  invite_token_hash   bytea UNIQUE,
  invite_issued_at    timestamptz,
  invite_expires_at   timestamptz,
  invite_used_at      timestamptz,
  invited_at          timestamptz NOT NULL DEFAULT now(),
  first_connect_at    timestamptz,
  deadline_at         timestamptz,
  extended_minutes    int NOT NULL DEFAULT 0,
  submitted_at        timestamptz,
  auto_submitted      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Composite foreign keys enforcing that assessment and candidate belong to the assignment's org
  CONSTRAINT fk_assignments_assessment_org
    FOREIGN KEY (org_id, assessment_id) REFERENCES app.assessments(org_id, id) ON DELETE CASCADE,

  CONSTRAINT fk_assignments_candidate_org
    FOREIGN KEY (org_id, candidate_id) REFERENCES app.users(org_id, id) ON DELETE CASCADE,

  -- Unique constraint: a candidate cannot be assigned to the same assessment in the same org more than once
  CONSTRAINT assignments_org_assessment_candidate_uq
    UNIQUE (org_id, assessment_id, candidate_id),

  -- Seven-day expiry window invariant anchored to token issuance (supports initial issuance & resend)
  CONSTRAINT assignment_invite_expiry_window
    CHECK (invite_expires_at IS NULL OR (invite_issued_at IS NOT NULL AND invite_expires_at > invite_issued_at AND invite_expires_at <= invite_issued_at + interval '7 days'))
);

CREATE INDEX IF NOT EXISTS assignments_org_idx ON app.assignments (org_id);
CREATE INDEX IF NOT EXISTS assignments_assessment_idx ON app.assignments (assessment_id);
CREATE INDEX IF NOT EXISTS assignments_candidate_idx ON app.assignments (candidate_id);
CREATE INDEX IF NOT EXISTS assignments_token_hash_idx ON app.assignments (invite_token_hash) WHERE invite_token_hash IS NOT NULL;

-- Row-Level Security (RLS) (BR-01 Strict Tenant Isolation)
ALTER TABLE app.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON app.assignments;
CREATE POLICY tenant_isolation ON app.assignments
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- 3. Idempotent Migrator Policies and Role Grants (consistent with 0005, 0006, 0010, 0011)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    DROP POLICY IF EXISTS migrator_policy ON app.assignments;
    CREATE POLICY migrator_policy ON app.assignments FOR ALL TO hs_migrator USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assignments TO hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_readonly') THEN
    GRANT SELECT ON app.assignments TO hs_readonly;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assignments TO hs_platform;
  END IF;
END $$;
