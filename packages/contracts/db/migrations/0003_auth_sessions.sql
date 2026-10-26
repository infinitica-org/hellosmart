-- 0003 auth sessions (S0-T10, CO-001, CA-002, CA-003, NF-006)
-- Pre-login user lookup, login security tracking, and password reset helpers.
-- All functions are SECURITY DEFINER with fixed search_path to bypass RLS safely
-- without exposing app.users table to unauthenticated cross-tenant queries.

-- Harden is_platform() helper so uninitialized or empty session GUC does not fail boolean cast
CREATE OR REPLACE FUNCTION app.is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.is_platform', true), ''), 'false')::boolean
$$;

CREATE OR REPLACE FUNCTION app.lookup_user_for_login(p_email citext)
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
  org_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
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
    o.status AS org_status
  FROM app.users u
  LEFT JOIN app.organizations o ON o.id = u.org_id
  WHERE u.email = p_email
    AND u.status IN ('active', 'invited')
    AND u.deleted_at IS NULL;

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
END;
$$;

ALTER FUNCTION app.lookup_user_for_login(citext) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.lookup_user_for_login(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_user_for_login(citext) TO hs_app;

-- Records a failed login attempt and conditionally locks the account
CREATE OR REPLACE FUNCTION app.record_login_failure(
  p_user_id uuid,
  p_max_attempts int DEFAULT 5,
  p_lockout_seconds int DEFAULT 900
)
RETURNS TABLE (
  new_failed_logins int,
  is_locked boolean,
  locked_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_failed int;
  v_locked timestamptz := NULL;
  v_prior_platform text;
BEGIN
  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  UPDATE app.users
  SET failed_logins = app.users.failed_logins + 1,
      locked_until = CASE
        WHEN (app.users.failed_logins + 1) >= p_max_attempts THEN now() + (p_lockout_seconds || ' seconds')::interval
        ELSE app.users.locked_until
      END
  WHERE id = p_user_id
  RETURNING app.users.failed_logins, app.users.locked_until INTO v_failed, v_locked;

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
  RETURN QUERY SELECT v_failed, (v_locked IS NOT NULL AND v_locked > now()), v_locked;
END;
$$;

ALTER FUNCTION app.record_login_failure(uuid, int, int) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.record_login_failure(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_login_failure(uuid, int, int) TO hs_app;

-- Resets failed logins on successful authentication
CREATE OR REPLACE FUNCTION app.record_login_success(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  UPDATE app.users
  SET failed_logins = 0,
      locked_until = NULL,
      last_login_at = now()
  WHERE id = p_user_id;

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
END;
$$;

ALTER FUNCTION app.record_login_success(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.record_login_success(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_login_success(uuid) TO hs_app;

-- Re-create invitation lookup with platform context and restrict to hs_app
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_prior_platform text;
BEGIN
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

ALTER FUNCTION app.lookup_invitation(bytea) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.lookup_invitation(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_invitation(bytea) TO hs_app;

