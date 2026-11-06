-- 0020 workspace usage telemetry and spend aggregation (BR-23, CO-035, CO-037, AD-018, NF-014)
-- Records compute duration, storage consumption, and LLM token spend per completed candidate session.
-- Append-only immutable usage ledger for organization billing and platform spend telemetry.

CREATE TABLE IF NOT EXISTS app.workspace_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  org_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  compute_seconds bigint NOT NULL,
  compute_minutes integer NOT NULL,
  storage_mb integer,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_cost_usd numeric(14, 6) NOT NULL DEFAULT 0.000000,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing_version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'complete',
  flags text[] NOT NULL DEFAULT '{}'::text[],
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_workspace_usage_workspace FOREIGN KEY (workspace_id) REFERENCES app.workspaces(id) ON DELETE RESTRICT,
  CONSTRAINT fk_workspace_usage_org FOREIGN KEY (org_id) REFERENCES app.organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_usage_assignment FOREIGN KEY (org_id, assignment_id) REFERENCES app.assignments(org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_workspace_usage_assessment FOREIGN KEY (org_id, assessment_id) REFERENCES app.assessments(org_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_workspace_usage_candidate FOREIGN KEY (org_id, candidate_id) REFERENCES app.users(org_id, id) ON DELETE RESTRICT,

  CONSTRAINT chk_workspace_usage_compute_sec_non_neg CHECK (compute_seconds >= 0),
  CONSTRAINT chk_workspace_usage_compute_min_non_neg CHECK (compute_minutes >= 0),
  CONSTRAINT chk_workspace_usage_storage_non_neg CHECK (storage_mb IS NULL OR storage_mb >= 0),
  CONSTRAINT chk_workspace_usage_tokens_non_neg CHECK (prompt_tokens >= 0 AND completion_tokens >= 0),
  CONSTRAINT chk_workspace_usage_cost_non_neg CHECK (total_cost_usd >= 0),
  CONSTRAINT chk_workspace_usage_timestamps CHECK (ended_at >= started_at),
  CONSTRAINT chk_workspace_usage_status CHECK (status IN ('complete', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_usage_org_created ON app.workspace_usage(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_assessment ON app.workspace_usage(assessment_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_candidate ON app.workspace_usage(candidate_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_workspace ON app.workspace_usage(workspace_id);

ALTER TABLE app.workspace_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workspace_usage FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_usage_select ON app.workspace_usage
  FOR SELECT
  USING (
    app.is_platform()
    OR (
      org_id = app.current_org_id()
      AND app.current_user_role() = 'company_admin'
    )
  );

CREATE POLICY workspace_usage_insert ON app.workspace_usage
  FOR INSERT
  WITH CHECK (
    app.is_platform()
  );

CREATE OR REPLACE FUNCTION app.prevent_workspace_usage_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'app.workspace_usage records are append-only and immutable. Updates are forbidden; use adjustments for billing corrections.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_workspace_usage_update ON app.workspace_usage;
CREATE TRIGGER trg_block_workspace_usage_update
BEFORE UPDATE ON app.workspace_usage
FOR EACH ROW EXECUTE FUNCTION app.prevent_workspace_usage_update();

REVOKE ALL ON app.workspace_usage FROM PUBLIC, hs_app, hs_platform, hs_readonly;
GRANT SELECT, INSERT ON app.workspace_usage TO hs_app, hs_platform;
GRANT SELECT ON app.workspace_usage TO hs_readonly;

