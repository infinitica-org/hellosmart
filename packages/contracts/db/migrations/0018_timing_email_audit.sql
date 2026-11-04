-- 0018 timing engine, activity events, submissions, email queue (S1-T03, S1-T06)
-- BR-08 deadlines, BR-09 disconnect events, BR-31 audit already lives in audit.events.
-- BR-01: every tenant table carries org_id and an RLS policy.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_org_id_pair_uq'
  ) THEN
    ALTER TABLE app.assignments
      ADD CONSTRAINT assignments_org_id_pair_uq UNIQUE (org_id, id);
  END IF;
END $$;

ALTER TABLE app.assignments
  ADD COLUMN IF NOT EXISTS draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS artifacts_ref text,
  ADD COLUMN IF NOT EXISTS write_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS assignments_status_deadline_idx
  ON app.assignments (status, deadline_at)
  WHERE status IN ('in_progress', 'disconnected');

CREATE TABLE IF NOT EXISTS app.workspaces (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assignment_id       uuid NOT NULL,
  mode                text NOT NULL DEFAULT 'cloud' CHECK (mode IN ('cloud', 'chat')),
  status              text NOT NULL DEFAULT 'not_connected'
                      CHECK (status IN ('queued','provisioning','not_connected','connected','disconnected','ended','destroyed','failed')),
  disconnected_at     timestamptz,
  snapshot_ref        text,
  write_token_hash    bytea,
  started_at          timestamptz,
  last_activity_at    timestamptz,
  ended_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_workspaces_assignment_org
    FOREIGN KEY (org_id, assignment_id) REFERENCES app.assignments(org_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_assignment_uq ON app.workspaces (org_id, assignment_id);
CREATE INDEX IF NOT EXISTS workspaces_org_idx ON app.workspaces (org_id);

CREATE TABLE IF NOT EXISTS app.activity_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assignment_id   uuid NOT NULL,
  workspace_id    uuid,
  type            text NOT NULL CHECK (type IN ('connect','disconnect','resume','fullscreen_exit','submit')),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip              inet,
  at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_activity_assignment_org
    FOREIGN KEY (org_id, assignment_id) REFERENCES app.assignments(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS activity_events_assignment_idx
  ON app.activity_events (org_id, assignment_id, at DESC);

CREATE TABLE IF NOT EXISTS app.submissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assignment_id         uuid NOT NULL,
  artifacts_ref         text,
  text_answers          jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_snapshot_ref    text,
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  auto_submitted        boolean NOT NULL DEFAULT false,
  results_released      boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT submissions_assignment_uq UNIQUE (org_id, assignment_id),
  CONSTRAINT fk_submissions_assignment_org
    FOREIGN KEY (org_id, assignment_id) REFERENCES app.assignments(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS submissions_org_idx ON app.submissions (org_id);

CREATE TABLE IF NOT EXISTS app.jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES app.organizations(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','sent','failed','dead')),
  attempts      int NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  run_after     timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  locked_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_due_idx
  ON app.jobs (run_after)
  WHERE status IN ('queued', 'failed');

CREATE TABLE IF NOT EXISTS app.email_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid REFERENCES app.organizations(id) ON DELETE CASCADE,
  job_id                uuid REFERENCES app.jobs(id) ON DELETE SET NULL,
  recipient             text NOT NULL,
  template              text NOT NULL,
  status                text NOT NULL CHECK (status IN ('sent','failed','bounced')),
  provider_message_id   text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_org_idx ON app.email_logs (org_id, created_at DESC);

-- RLS
ALTER TABLE app.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE app.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.activity_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON app.workspaces;
CREATE POLICY tenant_isolation ON app.workspaces
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

DROP POLICY IF EXISTS tenant_isolation ON app.activity_events;
CREATE POLICY tenant_isolation ON app.activity_events
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

DROP POLICY IF EXISTS tenant_isolation ON app.submissions;
CREATE POLICY tenant_isolation ON app.submissions
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

DROP POLICY IF EXISTS tenant_isolation ON app.jobs;
CREATE POLICY tenant_isolation ON app.jobs
  USING (org_id IS NULL OR org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id IS NULL OR org_id = app.current_org_id() OR app.is_platform());

DROP POLICY IF EXISTS tenant_isolation ON app.email_logs;
CREATE POLICY tenant_isolation ON app.email_logs
  USING (org_id IS NULL OR org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id IS NULL OR org_id = app.current_org_id() OR app.is_platform());

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    EXECUTE 'DROP POLICY IF EXISTS migrator_policy ON app.workspaces';
    EXECUTE 'CREATE POLICY migrator_policy ON app.workspaces FOR ALL TO hs_migrator USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS migrator_policy ON app.activity_events';
    EXECUTE 'CREATE POLICY migrator_policy ON app.activity_events FOR ALL TO hs_migrator USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS migrator_policy ON app.submissions';
    EXECUTE 'CREATE POLICY migrator_policy ON app.submissions FOR ALL TO hs_migrator USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS migrator_policy ON app.jobs';
    EXECUTE 'CREATE POLICY migrator_policy ON app.jobs FOR ALL TO hs_migrator USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS migrator_policy ON app.email_logs';
    EXECUTE 'CREATE POLICY migrator_policy ON app.email_logs FOR ALL TO hs_migrator USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.workspaces TO hs_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.activity_events TO hs_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.submissions TO hs_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.jobs TO hs_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.email_logs TO hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_readonly') THEN
    GRANT SELECT ON app.workspaces TO hs_readonly;
    GRANT SELECT ON app.activity_events TO hs_readonly;
    GRANT SELECT ON app.submissions TO hs_readonly;
    GRANT SELECT ON app.email_logs TO hs_readonly;
    GRANT SELECT ON app.jobs TO hs_readonly;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.workspaces TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.activity_events TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.submissions TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.jobs TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.email_logs TO hs_platform;
  END IF;
END $$;
