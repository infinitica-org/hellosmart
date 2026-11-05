-- 0005 platform role & forged context regression hardening (S0-T10-2, BR-01, BR-31)
-- 1. Create isolated hs_platform role with NOBYPASSRLS and no superuser / DDL privileges
-- 2. Explicitly prevent hs_app from inheriting or assuming hs_platform
-- 3. Refactor app.is_platform() to verify authenticated physical role membership (SESSION_USER = 'hs_platform' or 'hs_migrator')
--    preventing tenant-scoped hs_app from forging platform access via custom GUC
-- 4. Grant schema and table access to hs_platform
-- 5. Define migrator_policy for hs_migrator
-- 6. Implement app.record_login_success as SECURITY DEFINER routine

-- 1. Create hs_platform role idempotently
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    BEGIN
      CREATE ROLE hs_platform LOGIN PASSWORD 'hs_platform_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Role hs_platform must be created by admin or init script';
    END;
  END IF;
END $$;

-- 2. Ensure hs_app cannot assume or inherit hs_platform
DO $$ BEGIN
  REVOKE hs_platform FROM hs_app;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Schema & Table Grants for hs_platform
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO hs_platform', current_database());
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT USAGE ON SCHEMA app, audit, public TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hs_platform;
    GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO hs_platform;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app, audit TO hs_platform;
    REVOKE TRUNCATE ON ALL TABLES IN SCHEMA app, audit FROM hs_platform;
  END IF;
END $$;

-- Default privileges for future tables created by hs_migrator
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA app
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hs_platform;
    ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA audit
      GRANT SELECT, INSERT ON TABLES TO hs_platform;
    ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA app
      GRANT USAGE, SELECT ON SEQUENCES TO hs_platform;
    ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA audit
      GRANT USAGE, SELECT ON SEQUENCES TO hs_platform;
  END IF;
END $$;

-- 4. Hardened app.is_platform() function
-- Requires BOTH the application-level GUC ('app.is_platform' = 'true')
-- AND verified database session role identity (SESSION_USER IN ('hs_platform', 'hs_migrator')).
-- Tenant connections authenticated as hs_app evaluate to FALSE even inside SECURITY DEFINER routines,
-- preventing privilege elevation via definer execution context or forged GUCs.
CREATE OR REPLACE FUNCTION app.is_platform() RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF coalesce(nullif(trim(current_setting('app.is_platform', true)), ''), 'false')::boolean IS NOT TRUE THEN
    RETURN false;
  END IF;

  RETURN SESSION_USER IN ('hs_platform', 'hs_migrator');
END;
$$;

ALTER FUNCTION app.is_platform() OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.is_platform() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_platform() TO hs_app, hs_readonly;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.is_platform() TO hs_platform;
  END IF;
END $$;

-- 5. Explicit migrator policies on all tenant tables
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    DROP POLICY IF EXISTS migrator_policy ON app.organizations;
    CREATE POLICY migrator_policy ON app.organizations FOR ALL TO hs_migrator USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS migrator_policy ON app.entitlements;
    CREATE POLICY migrator_policy ON app.entitlements FOR ALL TO hs_migrator USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS migrator_policy ON app.users;
    CREATE POLICY migrator_policy ON app.users FOR ALL TO hs_migrator USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS migrator_policy ON app.invitations;
    CREATE POLICY migrator_policy ON app.invitations FOR ALL TO hs_migrator USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS migrator_policy ON audit.events;
    CREATE POLICY migrator_policy ON audit.events FOR ALL TO hs_migrator USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Audit Events Tenant Isolation Policy (read-scoped to tenant/platform; append permitted)
DROP POLICY IF EXISTS tenant_isolation ON audit.events;
DROP POLICY IF EXISTS audit_insert_policy ON audit.events;

CREATE POLICY tenant_isolation ON audit.events
  FOR SELECT
  USING (org_id = app.current_org_id() OR app.is_platform());

CREATE POLICY audit_insert_policy ON audit.events
  FOR INSERT
  WITH CHECK (true);

-- 7. Audit hash chain helper (SECURITY DEFINER, returns only latest 32-byte digest, no sensitive data)
CREATE OR REPLACE FUNCTION audit.latest_event_hash()
RETURNS bytea
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, audit, public
AS $$
  SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1;
$$;

ALTER FUNCTION audit.latest_event_hash() OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION audit.latest_event_hash() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit.latest_event_hash() TO hs_app, hs_platform;

-- 8. Grant routine execution privileges to hs_platform
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.find_user_for_login(citext) TO hs_platform;
    GRANT EXECUTE ON FUNCTION app.find_user_by_id(uuid) TO hs_platform;
    GRANT EXECUTE ON FUNCTION app.find_invitation_by_token_hash(bytea) TO hs_platform;
    GRANT EXECUTE ON FUNCTION app.lookup_invitation(bytea) TO hs_platform;
    GRANT EXECUTE ON FUNCTION app.accept_invitation(bytea, text, text, text, text) TO hs_platform;
  END IF;
END $$;

-- 8. Secure Login Success Recorder Routine (avoids cross-tenant elevation in auth.service)
CREATE OR REPLACE FUNCTION app.record_login_success(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
BEGIN
  UPDATE app.users
  SET failed_logins = 0,
      locked_until = NULL,
      last_login_at = now()
  WHERE id = p_user_id;
END;
$$;

ALTER FUNCTION app.record_login_success(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.record_login_success(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_login_success(uuid) TO hs_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.record_login_success(uuid) TO hs_platform;
  END IF;
END $$;
