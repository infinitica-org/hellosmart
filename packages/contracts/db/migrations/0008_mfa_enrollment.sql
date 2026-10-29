-- 0008 MFA enrollment: pending secret storage and one-time backup codes (platform admin MFA setup)
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_enrollment_pending_ref text;

CREATE TABLE IF NOT EXISTS app.mfa_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_unused_idx
  ON app.mfa_backup_codes (user_id)
  WHERE used_at IS NULL;

CREATE OR REPLACE FUNCTION app.set_mfa_enrollment_pending(p_user_id uuid, p_encrypted_pending text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_encrypted_pending IS NULL OR length(trim(p_encrypted_pending)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE app.users
  SET mfa_enrollment_pending_ref = p_encrypted_pending
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

ALTER FUNCTION app.set_mfa_enrollment_pending(uuid, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.set_mfa_enrollment_pending(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.set_mfa_enrollment_pending(uuid, text) TO hs_app;

CREATE OR REPLACE FUNCTION app.clear_mfa_enrollment_pending(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
BEGIN
  UPDATE app.users SET mfa_enrollment_pending_ref = NULL WHERE id = p_user_id;
  RETURN FOUND;
END;
$$;

ALTER FUNCTION app.clear_mfa_enrollment_pending(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.clear_mfa_enrollment_pending(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.clear_mfa_enrollment_pending(uuid) TO hs_app;

CREATE OR REPLACE FUNCTION app.confirm_mfa_enrollment(p_user_id uuid, p_encrypted_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_encrypted_secret IS NULL THEN
    RETURN false;
  END IF;

  UPDATE app.users
  SET
    mfa_secret_ref = p_encrypted_secret,
    mfa_enrollment_pending_ref = NULL,
    mfa_last_step = NULL
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

ALTER FUNCTION app.confirm_mfa_enrollment(uuid, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.confirm_mfa_enrollment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.confirm_mfa_enrollment(uuid, text) TO hs_app;

CREATE OR REPLACE FUNCTION app.insert_mfa_backup_code_hash(p_user_id uuid, p_code_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO app.mfa_backup_codes (user_id, code_hash)
  VALUES (p_user_id, p_code_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION app.insert_mfa_backup_code_hash(uuid, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.insert_mfa_backup_code_hash(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.insert_mfa_backup_code_hash(uuid, text) TO hs_app;

CREATE OR REPLACE FUNCTION app.consume_mfa_backup_code(p_user_id uuid, p_code_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE app.mfa_backup_codes
  SET used_at = now()
  WHERE user_id = p_user_id
    AND code_hash = p_code_hash
    AND used_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

ALTER FUNCTION app.consume_mfa_backup_code(uuid, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.consume_mfa_backup_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.consume_mfa_backup_code(uuid, text) TO hs_app;

CREATE OR REPLACE FUNCTION app.count_unused_mfa_backup_codes(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
  SELECT count(*)::integer FROM app.mfa_backup_codes WHERE user_id = p_user_id AND used_at IS NULL;
$$;

ALTER FUNCTION app.count_unused_mfa_backup_codes(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.count_unused_mfa_backup_codes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.count_unused_mfa_backup_codes(uuid) TO hs_app;

CREATE OR REPLACE FUNCTION app.delete_mfa_backup_codes_for_user(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
  DELETE FROM app.mfa_backup_codes WHERE user_id = p_user_id;
$$;

ALTER FUNCTION app.delete_mfa_backup_codes_for_user(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.delete_mfa_backup_codes_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.delete_mfa_backup_codes_for_user(uuid) TO hs_app;
