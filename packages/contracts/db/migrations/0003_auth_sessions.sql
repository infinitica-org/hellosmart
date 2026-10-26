-- 0003 auth sessions (S0-T10, CO-001, CA-002, CA-003, NF-006)
-- Pre-login user lookup, login security tracking, and password reset helpers.
-- All functions are SECURITY DEFINER with fixed search_path to bypass RLS safely
-- without exposing app.users table to unauthenticated cross-tenant queries.

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
BEGIN
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
END;
$$;

GRANT EXECUTE ON FUNCTION app.lookup_user_for_login(citext) TO PUBLIC;

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
BEGIN
  UPDATE app.users
  SET failed_logins = failed_logins + 1,
      locked_until = CASE
        WHEN (failed_logins + 1) >= p_max_attempts THEN now() + (p_lockout_seconds || ' seconds')::interval
        ELSE locked_until
      END
  WHERE id = p_user_id
  RETURNING failed_logins, app.users.locked_until INTO v_failed, v_locked;

  RETURN QUERY SELECT v_failed, (v_locked IS NOT NULL AND v_locked > now()), v_locked;
END;
$$;

GRANT EXECUTE ON FUNCTION app.record_login_failure(uuid, int, int) TO PUBLIC;

-- Resets failed logins on successful authentication
CREATE OR REPLACE FUNCTION app.record_login_success(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
  UPDATE app.users
  SET failed_logins = 0,
      locked_until = NULL,
      last_login_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION app.record_login_success(uuid) TO PUBLIC;
