-- 0012 RLS policies & tenant scoping verification (Stream 4, Task 4.1, BR-01)
-- 1. Enable and FORCE Row-Level Security on app.mfa_backup_codes to close cross-tenant leak gap.
-- 2. Define tenant_isolation policy on app.mfa_backup_codes scoped by parent user org_id or platform.
-- 3. Define migrator_policy on app.mfa_backup_codes for hs_migrator bypass during seeding/maintenance.
-- 4. Create performant user index on app.mfa_backup_codes for RLS subquery evaluation.
-- 5. Ensure explicit least-privilege grants across application and platform roles for mfa_backup_codes.
-- 6. Harden app.assessments RLS policy against forged GUC escalation (replace raw GUC with app.is_platform()).
-- 7. Grant necessary permissions on app.assessments and new template tables to application roles.

-- 1. Enable and FORCE RLS on app.mfa_backup_codes
ALTER TABLE app.mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.mfa_backup_codes FORCE ROW LEVEL SECURITY;

-- 2. Index on user_id for RLS subquery and foreign key lookups
CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_idx ON app.mfa_backup_codes (user_id);

-- 3. Migrator policy for hs_migrator
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    DROP POLICY IF EXISTS migrator_policy ON app.mfa_backup_codes;
    CREATE POLICY migrator_policy ON app.mfa_backup_codes FOR ALL TO hs_migrator USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS migrator_policy ON app.assessments;
    CREATE POLICY migrator_policy ON app.assessments FOR ALL TO hs_migrator USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Tenant isolation policy for app.mfa_backup_codes
-- Evaluates isolation by looking up parent user in app.users.
-- Fails closed: if app.current_org_id() is NULL or empty and app.is_platform() is false, yields 0 rows.
DROP POLICY IF EXISTS tenant_isolation ON app.mfa_backup_codes;
CREATE POLICY tenant_isolation ON app.mfa_backup_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.users u
      WHERE u.id = mfa_backup_codes.user_id
        AND (u.org_id = app.current_org_id() OR app.is_platform())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.users u
      WHERE u.id = mfa_backup_codes.user_id
        AND (u.org_id = app.current_org_id() OR app.is_platform())
    )
  );

-- 5. Least-privilege table grants on app.mfa_backup_codes
-- Direct table access is revoked from hs_app and hs_platform because backup codes
-- must exclusively be accessed via SECURITY DEFINER functions (insert_mfa_backup_code_hash,
-- consume_mfa_backup_code, count_unused_mfa_backup_codes, delete_mfa_backup_codes_for_user)
-- owned by hs_migrator.
REVOKE ALL ON app.mfa_backup_codes FROM hs_app;
GRANT SELECT ON app.mfa_backup_codes TO hs_readonly;
GRANT ALL ON app.mfa_backup_codes TO hs_migrator;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    REVOKE ALL ON app.mfa_backup_codes FROM hs_platform;
  END IF;
END $$;

-- 6. Harden app.assessments RLS policy against forged GUC escalation (BR-01)
-- 0011 used raw current_setting('app.is_platform', true) = 'true' which allows unauthenticated hs_app escalation.
-- Replace with dual-factor app.is_platform() and standard app.current_org_id().
ALTER TABLE app.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.assessments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessment_isolation ON app.assessments;
CREATE POLICY assessment_isolation ON app.assessments
  FOR ALL
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- 7. Role permissions on app.assessments and read-only grants
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assessments TO hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.assessments TO hs_platform;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_readonly') THEN
    GRANT SELECT ON app.assessments TO hs_readonly;
    GRANT SELECT ON app.templates, app.template_versions, app.template_assignments TO hs_readonly;
  END IF;
END $$;
