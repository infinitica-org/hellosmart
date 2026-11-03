-- 0012 Candidate Assessment Lifecycle, Consent, Workspace, Draft, and Submission (Stream 7.5, CA-008, BR-01, BR-08, BR-09, BR-11, BR-12, BR-20)
-- 1. Ensure composite unique constraints on app.assessments and app.users for strict co-tenancy enforcement
-- 2. Create app.assignments with composite foreign keys (org_id, assessment_id) and (org_id, candidate_id)
-- 3. Create app.consents with ON DELETE RESTRICT, composite foreign keys, and UPDATE/DELETE immutability trigger
-- 4. Create app.workspaces with composite foreign keys and status checks
-- 5. Create app.drafts with 30s autosave persistence and candidate isolation
-- 6. Create app.submissions with ON DELETE RESTRICT, composite foreign keys, and UPDATE/DELETE immutability trigger
-- 7. Add kernel-level timer integrity trigger protecting first_connect_at and deadline_at
-- 8. Add hardened Row-Level Security (RLS) policies with fail-closed missing context and explicit WITH CHECK
-- 9. Grant segregated least-privilege permissions to hs_app and hs_platform (revoking DELETE on consents/submissions)

-- Prerequisites: Composite uniqueness on referenced tenant tables to support composite foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessments_org_id_id') THEN
    ALTER TABLE app.assessments ADD CONSTRAINT uq_assessments_org_id_id UNIQUE (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_org_id_id') THEN
    ALTER TABLE app.users ADD CONSTRAINT uq_users_org_id_id UNIQUE (org_id, id);
  END IF;
END $$;

-- Session context helper functions
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_role text;
  v_uid uuid;
  v_oid uuid;
BEGIN
  v_role := nullif(trim(current_setting('app.user_role', true)), '');
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  v_uid := app.current_user_id();
  v_oid := app.current_org_id();
  IF v_uid IS NULL OR v_oid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM app.users WHERE id = v_uid AND org_id = v_oid;
  RETURN v_role;
END;
$$;

ALTER FUNCTION app.current_user_role() OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_role() TO hs_app, hs_platform, hs_readonly;

-- 1. Candidate Assignments
CREATE TABLE IF NOT EXISTS app.assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assessment_id       uuid NOT NULL,
  candidate_id        uuid NOT NULL,
  status              text NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'window_not_open', 'ready', 'in_progress', 'disconnected', 'submitted', 'expired', 'revoked')),
  invited_at          timestamptz NOT NULL DEFAULT now(),
  first_connect_at    timestamptz,
  deadline_at         timestamptz,
  extended_minutes    int NOT NULL DEFAULT 0 CHECK (extended_minutes >= 0),
  submitted_at        timestamptz,
  auto_submitted      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_candidate_assessment_assignment UNIQUE (assessment_id, candidate_id),
  CONSTRAINT uq_assignments_org_id_id UNIQUE (org_id, id),
  CONSTRAINT fk_assignments_org_assessment FOREIGN KEY (org_id, assessment_id)
    REFERENCES app.assessments(org_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_org_candidate FOREIGN KEY (org_id, candidate_id)
    REFERENCES app.users(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_org_id ON app.assignments (org_id);
CREATE INDEX IF NOT EXISTS idx_assignments_candidate_id ON app.assignments (candidate_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assessment_id ON app.assignments (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON app.assignments (org_id, status);

-- Timer Integrity Trigger (BR-08, BR-09)
CREATE OR REPLACE FUNCTION app.enforce_assignment_timer_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Immutable first_connect_at: once established, reconnects can never reset or modify it
  IF OLD.first_connect_at IS NOT NULL THEN
    IF NEW.first_connect_at IS DISTINCT FROM OLD.first_connect_at THEN
      RAISE EXCEPTION 'Timer integrity violation: first_connect_at is immutable once started (BR-08)';
    END IF;
  END IF;

  -- 2. Candidates cannot modify deadline_at or extended_minutes directly
  IF app.current_user_role() = 'candidate' OR (NOT app.is_platform() AND app.current_user_id() = OLD.candidate_id) THEN
    IF OLD.deadline_at IS NOT NULL AND NEW.deadline_at IS DISTINCT FROM OLD.deadline_at THEN
      RAISE EXCEPTION 'Timer integrity violation: candidates cannot alter deadline_at (BR-08)';
    END IF;
    IF NEW.extended_minutes IS DISTINCT FROM OLD.extended_minutes THEN
      RAISE EXCEPTION 'Timer integrity violation: candidates cannot modify extended_minutes (BR-08)';
    END IF;
  END IF;

  -- 3. Authorized administrative extension: when extended_minutes increases, adjust deadline_at
  IF NEW.extended_minutes > OLD.extended_minutes AND OLD.deadline_at IS NOT NULL THEN
    NEW.deadline_at := OLD.deadline_at + ((NEW.extended_minutes - OLD.extended_minutes) || ' minutes')::interval;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignment_timer_integrity ON app.assignments;
CREATE TRIGGER trg_assignment_timer_integrity
  BEFORE UPDATE ON app.assignments
  FOR EACH ROW
  EXECUTE FUNCTION app.enforce_assignment_timer_integrity();

-- 2. Legal Consent Records (BR-12)
CREATE TABLE IF NOT EXISTS app.consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
  assignment_id   uuid NOT NULL,
  candidate_id    uuid NOT NULL,
  mode            text NOT NULL CHECK (mode IN ('cloud', 'chat')),
  text_version    text NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip_address      text NOT NULL,
  user_agent      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_consent UNIQUE (assignment_id),
  CONSTRAINT fk_consents_org_assignment FOREIGN KEY (org_id, assignment_id)
    REFERENCES app.assignments(org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_consents_org_candidate FOREIGN KEY (org_id, candidate_id)
    REFERENCES app.users(org_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_consents_assignment_id ON app.consents (assignment_id);
CREATE INDEX IF NOT EXISTS idx_consents_candidate_id ON app.consents (candidate_id);

-- Consent Immutability Trigger (UPDATE and DELETE both strictly blocked)
CREATE OR REPLACE FUNCTION app.prevent_consent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Consent records are immutable and cannot be updated or deleted (BR-12)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_consent ON app.consents;
CREATE TRIGGER trg_immutable_consent
  BEFORE UPDATE OR DELETE ON app.consents
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_consent_mutation();

-- 3. Workspaces (Sessions)
CREATE TABLE IF NOT EXISTS app.workspaces (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assignment_id     uuid NOT NULL,
  candidate_id      uuid NOT NULL,
  mode              text NOT NULL CHECK (mode IN ('cloud', 'chat')),
  status            text NOT NULL DEFAULT 'provisioning'
                    CHECK (status IN ('queued', 'provisioning', 'not_connected', 'connected', 'disconnected', 'ended', 'destroyed', 'failed')),
  runtime_ref       text,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  snapshot_ref      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_workspace UNIQUE (assignment_id),
  CONSTRAINT fk_workspaces_org_assignment FOREIGN KEY (org_id, assignment_id)
    REFERENCES app.assignments(org_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_workspaces_org_candidate FOREIGN KEY (org_id, candidate_id)
    REFERENCES app.users(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_assignment_id ON app.workspaces (assignment_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_org_status ON app.workspaces (org_id, status);

-- 4. Drafts (Continuous Autosave per BR-11)
CREATE TABLE IF NOT EXISTS app.drafts (
  assignment_id       uuid PRIMARY KEY,
  org_id              uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  candidate_id        uuid NOT NULL,
  repository_url      text NOT NULL DEFAULT '',
  branch_name         text NOT NULL DEFAULT 'main',
  uploaded_artifact   jsonb,
  architecture_notes  text NOT NULL DEFAULT '',
  version             int NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_drafts_org_assignment FOREIGN KEY (org_id, assignment_id)
    REFERENCES app.assignments(org_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_drafts_org_candidate FOREIGN KEY (org_id, candidate_id)
    REFERENCES app.users(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drafts_candidate_id ON app.drafts (candidate_id);

-- 5. Submissions (Final Deliverables & Receipts per BR-20)
CREATE TABLE IF NOT EXISTS app.submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
  assignment_id       uuid NOT NULL,
  candidate_id        uuid NOT NULL,
  repository_url      text NOT NULL,
  branch_name         text NOT NULL,
  uploaded_artifact   jsonb,
  architecture_notes  text NOT NULL,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  auto_submitted      boolean NOT NULL DEFAULT false,
  receipt_id          text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_submission UNIQUE (assignment_id),
  CONSTRAINT fk_submissions_org_assignment FOREIGN KEY (org_id, assignment_id)
    REFERENCES app.assignments(org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_submissions_org_candidate FOREIGN KEY (org_id, candidate_id)
    REFERENCES app.users(org_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_submissions_org_id ON app.submissions (org_id);
CREATE INDEX IF NOT EXISTS idx_submissions_candidate_id ON app.submissions (candidate_id);
CREATE INDEX IF NOT EXISTS idx_submissions_receipt_id ON app.submissions (receipt_id);

-- Submission Immutability Trigger (UPDATE and DELETE both strictly blocked)
CREATE OR REPLACE FUNCTION app.prevent_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Final submissions are immutable and cannot be modified or deleted (BR-20)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_submission ON app.submissions;
CREATE TRIGGER trg_immutable_submission
  BEFORE UPDATE OR DELETE ON app.submissions
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_submission_mutation();

-- 6. Hardened Row-Level Security (RLS) (BR-01, BR-12, BR-25)
ALTER TABLE app.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_isolation ON app.assignments;
DROP POLICY IF EXISTS assignment_select ON app.assignments;
DROP POLICY IF EXISTS assignment_insert ON app.assignments;
DROP POLICY IF EXISTS assignment_update ON app.assignments;
DROP POLICY IF EXISTS assignment_delete ON app.assignments;

CREATE POLICY assignment_select ON app.assignments
  FOR SELECT
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY assignment_insert ON app.assignments
  FOR INSERT
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_role() = 'company_admin'
    )
  );

CREATE POLICY assignment_update ON app.assignments
  FOR UPDATE
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  )
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY assignment_delete ON app.assignments
  FOR DELETE
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_role() = 'company_admin'
    )
  );

ALTER TABLE app.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_isolation ON app.consents;
DROP POLICY IF EXISTS consent_select ON app.consents;
DROP POLICY IF EXISTS consent_insert ON app.consents;

CREATE POLICY consent_select ON app.consents
  FOR SELECT
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY consent_insert ON app.consents
  FOR INSERT
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_id() IS NOT NULL
      AND candidate_id = app.current_user_id()
    )
  );

ALTER TABLE app.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workspaces FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation ON app.workspaces;
DROP POLICY IF EXISTS workspace_select ON app.workspaces;
DROP POLICY IF EXISTS workspace_insert ON app.workspaces;
DROP POLICY IF EXISTS workspace_update ON app.workspaces;
DROP POLICY IF EXISTS workspace_delete ON app.workspaces;

CREATE POLICY workspace_select ON app.workspaces
  FOR SELECT
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY workspace_insert ON app.workspaces
  FOR INSERT
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_id() IS NOT NULL
      AND candidate_id = app.current_user_id()
    )
  );

CREATE POLICY workspace_update ON app.workspaces
  FOR UPDATE
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  )
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY workspace_delete ON app.workspaces
  FOR DELETE
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_role() = 'company_admin'
    )
  );

ALTER TABLE app.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.drafts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_isolation ON app.drafts;
CREATE POLICY draft_isolation ON app.drafts
  FOR ALL
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_id() IS NOT NULL
      AND candidate_id = app.current_user_id()
    )
  )
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_id() IS NOT NULL
      AND candidate_id = app.current_user_id()
    )
  );

ALTER TABLE app.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submission_isolation ON app.submissions;
DROP POLICY IF EXISTS submission_select ON app.submissions;
DROP POLICY IF EXISTS submission_insert ON app.submissions;

CREATE POLICY submission_select ON app.submissions
  FOR SELECT
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND (
        app.current_user_role() = 'company_admin'
        OR (app.current_user_id() IS NOT NULL AND candidate_id = app.current_user_id())
      )
    )
  );

CREATE POLICY submission_insert ON app.submissions
  FOR INSERT
  WITH CHECK (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_id() IS NOT NULL
      AND candidate_id = app.current_user_id()
    )
  );

-- 7. Grant Permissions to Application Roles with Least Privilege
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assignments, app.workspaces, app.drafts TO hs_app;
    GRANT SELECT, INSERT ON app.consents, app.submissions TO hs_app;
    REVOKE UPDATE, DELETE ON app.consents, app.submissions FROM hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assignments, app.workspaces, app.drafts TO hs_platform;
    GRANT SELECT, INSERT ON app.consents, app.submissions TO hs_platform;
    REVOKE UPDATE, DELETE ON app.consents, app.submissions FROM hs_platform;
  END IF;
END $$;
