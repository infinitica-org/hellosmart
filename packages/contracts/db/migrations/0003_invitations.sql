-- 0003 invitations (BR-24, S0-T08-1)
-- Invitations table for candidate and company_admin onboarding.
-- Token is 32 cryptographically random bytes; only SHA-256 hash is stored as bytea.
-- Single-use: used_at is set atomically on acceptance.
-- Expiry is strictly <= 72 hours from creation.

CREATE TABLE app.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES app.organizations(id),
  user_id     uuid NOT NULL REFERENCES app.users(id),
  email       citext NOT NULL,
  role        text NOT NULL CHECK (role IN ('company_admin','candidate')),
  token_hash  bytea NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_expiry_window CHECK (expires_at > created_at AND expires_at <= created_at + interval '72 hours')
);

CREATE INDEX invitations_token_hash_idx ON app.invitations (token_hash);
CREATE INDEX invitations_org_idx ON app.invitations (org_id);
CREATE INDEX invitations_user_idx ON app.invitations (user_id);

ALTER TABLE app.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.invitations
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- Secure pre-login lookup function (SECURITY DEFINER)
-- Allows anonymous/pre-login lookup of a valid, unexpired, unused invitation by token hash
-- without opening app.invitations to unauthenticated or cross-tenant SELECTs.
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

-- Atomic, least-privilege invitation acceptance function
-- Performs single-use consumption, user activation, and tamper-evident audit record in one ACID transaction.
-- Eliminates the need for application code to set app.is_platform = true in unauthenticated flows.
CREATE OR REPLACE FUNCTION app.accept_invitation(
  p_token_hash bytea,
  p_password_hash text,
  p_ip text DEFAULT '127.0.0.1',
  p_user_agent text DEFAULT 'unknown',
  p_request_id text DEFAULT ''
)
RETURNS TABLE (
  success boolean,
  user_id uuid,
  org_id uuid,
  email citext,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, audit, public
AS $$
#variable_conflict use_column
DECLARE
  v_inv app.invitations%ROWTYPE;
  v_user app.users%ROWTYPE;
  v_prior_platform text;
  v_prev_hash bytea;
  v_event_hash bytea;
  v_audit_payload jsonb;
  v_inet_ip inet;
BEGIN
  -- Validate inputs: 32-byte SHA-256 token hash and non-empty password hash required
  IF p_token_hash IS NULL OR octet_length(p_token_hash) != 32 THEN
    RETURN;
  END IF;

  IF p_password_hash IS NULL OR length(trim(p_password_hash)) = 0 THEN
    RETURN;
  END IF;

  -- Parse client IP safely; fallback to 127.0.0.1 if invalid or empty
  BEGIN
    v_inet_ip := nullif(trim(p_ip), '')::inet;
  EXCEPTION WHEN OTHERS THEN
    v_inet_ip := '127.0.0.1'::inet;
  END;

  -- Save prior platform setting and elevate locally within this SECURITY DEFINER function
  v_prior_platform := current_setting('app.is_platform', true);
  PERFORM set_config('app.is_platform', 'true', true);

  -- 1. Atomically consume invitation: single-use, unexpired
  UPDATE app.invitations
  SET used_at = now()
  WHERE app.invitations.token_hash = p_token_hash
    AND app.invitations.used_at IS NULL
    AND app.invitations.expires_at > now()
  RETURNING * INTO v_inv;

  IF NOT FOUND THEN
    PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
    RETURN; -- Returns 0 rows (caller treats as invalid / expired / consumed)
  END IF;

  -- Enforce permitted role boundary (invitations cannot activate platform_admin)
  IF v_inv.role NOT IN ('company_admin', 'candidate') THEN
    PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
    RAISE EXCEPTION 'Invalid invitation role: %', v_inv.role;
  END IF;

  -- 2. Activate user and set password hash (protect suspended/deleted accounts)
  UPDATE app.users
  SET password_hash = p_password_hash,
      must_reset_password = false,
      status = 'active',
      email_verified_at = coalesce(app.users.email_verified_at, now())
  WHERE app.users.id = v_inv.user_id
    AND app.users.org_id = v_inv.org_id
    AND app.users.deleted_at IS NULL
    AND app.users.status NOT IN ('suspended', 'deleted')
  RETURNING * INTO v_user;

  IF NOT FOUND THEN
    PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);
    RAISE EXCEPTION 'Associated user record not found or tenant mismatch';
  END IF;

  -- 3. Append tamper-evident audit record with exclusive advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('audit.events'));

  SELECT hash INTO v_prev_hash
  FROM audit.events
  ORDER BY id DESC
  LIMIT 1;

  v_prev_hash := coalesce(v_prev_hash, ''::bytea);

  v_audit_payload := jsonb_build_object(
    'action', 'invitation.accepted',
    'entity', 'user',
    'entityId', v_inv.user_id,
    'actorId', v_inv.user_id,
    'actorRole', v_inv.role,
    'orgId', v_inv.org_id,
    'before', jsonb_build_object('status', 'invited', 'must_reset_password', true),
    'after', jsonb_build_object('status', 'active', 'must_reset_password', false, 'email_verified', true),
    'ip', host(v_inet_ip),
    'userAgent', p_user_agent,
    'requestId', p_request_id
  );

  v_event_hash := digest(v_prev_hash || convert_to(v_audit_payload::text, 'UTF8'), 'sha256');

  INSERT INTO audit.events (
    actor_id, actor_role, org_id, action, entity, entity_id,
    before, after, ip, user_agent, request_id, prev_hash, hash
  ) VALUES (
    v_inv.user_id,
    v_inv.role,
    v_inv.org_id,
    'invitation.accepted',
    'user',
    v_inv.user_id::text,
    jsonb_build_object('status', 'invited', 'must_reset_password', true),
    jsonb_build_object('status', 'active', 'must_reset_password', false, 'email_verified', true),
    v_inet_ip,
    p_user_agent,
    p_request_id,
    v_prev_hash,
    v_event_hash
  );

  PERFORM set_config('app.is_platform', coalesce(v_prior_platform, ''), true);

  RETURN QUERY SELECT true, v_inv.user_id, v_inv.org_id, v_inv.email, v_inv.role;
END;
$$;
