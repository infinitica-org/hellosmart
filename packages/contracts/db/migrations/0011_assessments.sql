-- 0011 assessments table with RLS and version pinning (S1-T02-1, BR-01, BR-03)
-- 1. Create app.assessments table (configured task blueprint pinned to a template version)
-- 2. Enforce Row-Level Security (RLS) for tenant isolation (BR-01)
-- 3. Add foreign keys and performance indexes

CREATE TABLE IF NOT EXISTS app.assessments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  template_version_id     uuid NOT NULL REFERENCES app.template_versions(id),
  name                    text NOT NULL,
  workspace_mode          text NOT NULL CHECK (workspace_mode IN ('cloud', 'chat')),
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dry_run_passed', 'published', 'closed', 'archived')),
  brief_overrides         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_policy               jsonb NOT NULL DEFAULT '{}'::jsonb,
  timing                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  env_refs                jsonb NOT NULL DEFAULT '[]'::jsonb,
  dry_run_passed_at       timestamptz,
  release_results_default boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_org_id ON app.assessments (org_id);
CREATE INDEX IF NOT EXISTS idx_assessments_template_version_id ON app.assessments (template_version_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON app.assessments (org_id, status);

-- Row-Level Security (RLS) (BR-01 Strict Tenant Isolation)
ALTER TABLE app.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assessments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_isolation ON app.assessments;
CREATE POLICY assessment_isolation ON app.assessments
  FOR ALL
  USING (
    current_setting('app.is_platform', true) = 'true'
    OR org_id = nullif(current_setting('app.org_id', true), '')::uuid
  );
