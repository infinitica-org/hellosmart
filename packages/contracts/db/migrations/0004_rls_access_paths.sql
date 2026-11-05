-- 0004 RLS access paths and security hardening (S0-T10-1, S0-T10-2, BR-01, BR-31)
-- 1. Enable and FORCE Row-Level Security on audit.events to prevent cross-tenant audit leakage.
-- 2. Implement SECURITY DEFINER pre-login lookup functions for user and invitation resolution.
-- 3. Revoke default PUBLIC execution privileges and restrict execution strictly to hs_app.
-- 4. Grant sequence privileges on audit.events to hs_app for append-only audit insertion.

-- 1. Enable and FORCE RLS on audit.events
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON audit.events;
CREATE POLICY tenant_isolation ON audit.events
  FOR ALL
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- 2. Secure Pre-Login User Lookup (S0-T10-1)
-- Allows pre-login identity resolution before tenant context exists
-- without requiring application code to elevate to platform context.
DROP FUNCTION IF EXISTS app.find_user_for_login(citext);
CREATE OR REPLACE FUNCTION app.find_user_for_login(p_email citext)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  email citext,
  name text,
  role text,
  password_hash text,
  must_reset_password boolean,
  mfa_secret_ref text,
  status text,
  failed_logins int,
  locked_until timestamptz,
  org_name text,
  org_status text,
  logo_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
  IF p_email IS NULL OR length(trim(p_email::text)) = 0 THEN
    RETURN;
  END IF;

  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  RETURN QUERY
  SELECT
    u.id,
    u.org_id,
    u.email,
    u.name,
    u.role,
    u.password_hash,
    u.must_reset_password,
    u.mfa_secret_ref,
    u.status,
    u.failed_logins,
    u.locked_until,
    o.name AS org_name,
    o.status AS org_status,
    o.logo_key
  FROM app.users u
  LEFT JOIN app.organizations o ON o.id = u.org_id
  WHERE u.email = p_email
    AND u.deleted_at IS NULL
  ORDER BY (u.role = 'platform_admin') DESC, u.created_at ASC;

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
END;
$$;

-- 3. Secure User Lookup by ID (for post-auth profile resolution across tenant boundaries)
DROP FUNCTION IF EXISTS app.find_user_by_id(uuid);
CREATE OR REPLACE FUNCTION app.find_user_by_id(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  email citext,
  name text,
  role text,
  password_hash text,
  must_reset_password boolean,
  mfa_secret_ref text,
  status text,
  failed_logins int,
  locked_until timestamptz,
  org_name text,
  org_status text,
  logo_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  RETURN QUERY
  SELECT
    u.id,
    u.org_id,
    u.email,
    u.name,
    u.role,
    u.password_hash,
    u.must_reset_password,
    u.mfa_secret_ref,
    u.status,
    u.failed_logins,
    u.locked_until,
    o.name AS org_name,
    o.status AS org_status,
    o.logo_key
  FROM app.users u
  LEFT JOIN app.organizations o ON o.id = u.org_id
  WHERE u.id = p_user_id
    AND u.deleted_at IS NULL;

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
END;
$$;

-- 4. Secure Pre-Login Invitation Lookup (S0-T10-1)
CREATE OR REPLACE FUNCTION app.find_invitation_by_token_hash(p_token_hash bytea)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  user_id uuid,
  email citext,
  role text,
  org_name text,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
  IF p_token_hash IS NULL OR octet_length(p_token_hash) != 32 THEN
    RETURN;
  END IF;

  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  RETURN QUERY
  SELECT
    i.id,
    i.org_id,
    i.user_id,
    i.email,
    i.role,
    o.name AS org_name,
    i.expires_at,
    i.used_at
  FROM app.invitations i
  JOIN app.organizations o ON o.id = i.org_id
  WHERE i.token_hash = p_token_hash
    AND i.used_at IS NULL
    AND i.expires_at > now();

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
END;
$$;

-- Backward-compatible alias for existing lookup_invitation callers
CREATE OR REPLACE FUNCTION app.lookup_invitation(p_token_hash bytea)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  user_id uuid,
  email citext,
  role text,
  org_name text,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
  SELECT * FROM app.find_invitation_by_token_hash(p_token_hash);
$$;

-- 5. Restrict Execution Privileges (Principle of Least Privilege)
ALTER FUNCTION app.find_user_for_login(citext) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.find_user_for_login(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.find_user_for_login(citext) TO hs_app;

ALTER FUNCTION app.find_user_by_id(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.find_user_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.find_user_by_id(uuid) TO hs_app;

ALTER FUNCTION app.find_invitation_by_token_hash(bytea) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.find_invitation_by_token_hash(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.find_invitation_by_token_hash(bytea) TO hs_app;

ALTER FUNCTION app.lookup_invitation(bytea) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.lookup_invitation(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_invitation(bytea) TO hs_app;

ALTER FUNCTION app.accept_invitation(bytea, text, text, text, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.accept_invitation(bytea, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.accept_invitation(bytea, text, text, text, text) TO hs_app;

-- 6. Ensure sequence access for audit.events insertion by hs_app
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app, audit TO hs_app;
