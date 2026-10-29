-- 0007 MFA Hardening: Atomic TOTP replay protection, step tracking, and opportunistic migration (S0-T14-3, BR-20, BR-31)
-- 1. Add mfa_last_step column to app.users to track the last consumed TOTP time-step
-- 2. Create app.consume_totp_step SECURITY DEFINER routine for atomic conditional time-step consumption
-- 3. Create app.get_user_mfa_last_step helper for inspection and testing
-- 4. Grant execution permissions to hs_app and hs_platform

-- 1. Add mfa_last_step column to app.users
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS mfa_last_step bigint;

-- 2. Atomic TOTP Step Consumer Routine (S0-T14-3)
-- Guarantees atomic compare-and-swap behavior at the database engine level.
-- If two concurrent requests arrive with the same TOTP step for a user:
-- PostgreSQL row-level lock ensures the first transaction updates the row and sets mfa_last_step = p_step.
-- The second transaction evaluates (mfa_last_step < p_step) against the newly updated value,
-- finds it false, updates 0 rows, and returns false.
CREATE OR REPLACE FUNCTION app.consume_totp_step(p_user_id uuid, p_step bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_user_id IS NULL OR p_step IS NULL THEN
    RETURN false;
  END IF;

  UPDATE app.users
  SET mfa_last_step = p_step
  WHERE id = p_user_id
    AND (mfa_last_step IS NULL OR mfa_last_step < p_step);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

ALTER FUNCTION app.consume_totp_step(uuid, bigint) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.consume_totp_step(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.consume_totp_step(uuid, bigint) TO hs_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.consume_totp_step(uuid, bigint) TO hs_platform;
  END IF;
END $$;

-- 3. MFA Last Step Getter Routine (for inspection and test verification)
CREATE OR REPLACE FUNCTION app.get_user_mfa_last_step(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, app, public
AS $$
  SELECT mfa_last_step FROM app.users WHERE id = p_user_id;
$$;

ALTER FUNCTION app.get_user_mfa_last_step(uuid) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.get_user_mfa_last_step(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_user_mfa_last_step(uuid) TO hs_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.get_user_mfa_last_step(uuid) TO hs_platform;
  END IF;
END $$;

-- 4. Opportunistic MFA Secret Upgrader Routine (S0-T14-3)
-- Allows upgrading legacy plaintext Base32 secrets or rotated key envelopes
-- to the active AES-256-GCM encryption key on successful login.
CREATE OR REPLACE FUNCTION app.upgrade_user_mfa_secret(p_user_id uuid, p_encrypted_secret text)
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
  SET mfa_secret_ref = p_encrypted_secret
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

ALTER FUNCTION app.upgrade_user_mfa_secret(uuid, text) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.upgrade_user_mfa_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.upgrade_user_mfa_secret(uuid, text) TO hs_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT EXECUTE ON FUNCTION app.upgrade_user_mfa_secret(uuid, text) TO hs_platform;
  END IF;
END $$;

