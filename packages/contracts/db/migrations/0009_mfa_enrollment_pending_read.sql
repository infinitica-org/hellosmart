-- 0009 MFA enrollment read helper (platform admin rows are invisible under RLS without app.is_platform)
CREATE OR REPLACE FUNCTION app.get_mfa_enrollment_pending(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
  SELECT mfa_enrollment_pending_ref
  FROM app.users
  WHERE id = p_user_id
    AND deleted_at IS NULL;
$$;

ALTER FUNCTION app.get_mfa_enrollment_pending(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.get_mfa_enrollment_pending(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_mfa_enrollment_pending(uuid) TO hs_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.get_mfa_enrollment_pending(uuid) TO hs_platform;
  END IF;
END $$;
