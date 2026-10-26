-- 0002 invitations (BR-24, S0-T08-1)
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
SET search_path = app, public
AS $$
BEGIN
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
END;
$$;

ALTER FUNCTION app.lookup_invitation(bytea) OWNER TO hs_migrator;
REVOKE EXECUTE ON FUNCTION app.lookup_invitation(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lookup_invitation(bytea) TO hs_app;

