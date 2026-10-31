-- 0010 templates and private assignments (S1-T01-2, S1-T01-3, BR-01, BR-02, BR-03)
-- 1. Create app.templates table (master catalog owned by platform)
-- 2. Create app.template_versions table (semver manifests)
-- 3. Create app.template_assignments table (private company boundary, BR-02)
-- 4. Enforce Row-Level Security (RLS) across all three tables (BR-01, BR-02)
-- 5. Immutability trigger for published template versions (BR-03)

-- 1. Master Templates
CREATE TABLE IF NOT EXISTS app.templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            citext NOT NULL UNIQUE,
  name            text NOT NULL,
  category        text NOT NULL,
  difficulty      text NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  workspace_mode  text NOT NULL CHECK (workspace_mode IN ('cloud', 'chat')),
  description     text NOT NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Template Versions
CREATE TABLE IF NOT EXISTS app.template_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES app.templates(id) ON DELETE CASCADE,
  version       text NOT NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'tested', 'published')),
  manifest      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  CONSTRAINT uq_template_version UNIQUE (template_id, version)
);

-- 3. Private Template Assignments (The privacy boundary per BR-02)
CREATE TABLE IF NOT EXISTS app.template_assignments (
  template_id   uuid NOT NULL REFERENCES app.templates(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_template_assignments_org_id ON app.template_assignments (org_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON app.template_versions (template_id);

-- 4. Row-Level Security (RLS) Policies (BR-01, BR-02)
ALTER TABLE app.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_isolation ON app.templates;
CREATE POLICY template_isolation ON app.templates
  USING (app.is_platform() OR id IN (SELECT template_id FROM app.template_assignments WHERE org_id = app.current_org_id()))
  WITH CHECK (app.is_platform());

ALTER TABLE app.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.template_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_version_isolation ON app.template_versions;
CREATE POLICY template_version_isolation ON app.template_versions
  USING (app.is_platform() OR template_id IN (SELECT template_id FROM app.template_assignments WHERE org_id = app.current_org_id()))
  WITH CHECK (app.is_platform());

ALTER TABLE app.template_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.template_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_assignment_isolation ON app.template_assignments;
CREATE POLICY template_assignment_isolation ON app.template_assignments
  USING (app.is_platform() OR org_id = app.current_org_id())
  WITH CHECK (app.is_platform());

-- 5. Immutability Trigger for Published Versions (BR-03)
CREATE OR REPLACE FUNCTION app.prevent_published_template_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Published template versions are immutable and cannot be deleted (BR-03)';
    ELSIF TG_OP = 'UPDATE' THEN
      -- Allow no-op or updating status to archived if supported, but forbid altering manifest/version
      IF OLD.manifest IS DISTINCT FROM NEW.manifest OR OLD.version IS DISTINCT FROM NEW.version THEN
        RAISE EXCEPTION 'Published template manifests are immutable and cannot be modified (BR-03)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_template_versions ON app.template_versions;
CREATE TRIGGER trg_immutable_template_versions
  BEFORE UPDATE OR DELETE ON app.template_versions
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_published_template_mutation();

-- 6. Role Permissions
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.templates, app.template_versions, app.template_assignments TO hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.templates, app.template_versions, app.template_assignments TO hs_platform;
  END IF;
END $$;
