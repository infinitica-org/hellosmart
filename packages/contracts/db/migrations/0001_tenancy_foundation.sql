-- 0001 tenancy foundation (BR-01, BR-04, BR-05, BR-31)
-- Pattern every tenant table must follow:
--   1. org_id uuid NOT NULL REFERENCES app.organizations(id)
--   2. index leading with org_id
--   3. ENABLE + FORCE ROW LEVEL SECURITY
--   4. policy tenant_isolation USING/WITH CHECK org_id = app.current_org_id()
-- The API sets the context per transaction: SELECT set_config('app.org_id', $1, true);
-- Platform-admin cross-org access uses app.is_platform() and is audit-logged.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.is_platform', true), ''), 'false')::boolean
$$;

CREATE TABLE app.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            citext NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'provisioned'
                  CHECK (status IN ('provisioned','trial_active','trial_expired','paid_active','suspended')),
  logo_key        text,
  custom_domain   citext UNIQUE,
  retention_days  int NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 30 AND 730),
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.organizations
  USING (id = app.current_org_id() OR app.is_platform())
  WITH CHECK (app.is_platform());

CREATE TABLE app.entitlements (
  org_id                    uuid PRIMARY KEY REFERENCES app.organizations(id),
  max_templates             int NOT NULL DEFAULT 3,
  max_candidates            int NOT NULL DEFAULT 10,
  trial_ends_at             timestamptz,
  pending_invite_multiplier numeric(4,2) NOT NULL DEFAULT 2.0,
  flags                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at                timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.entitlements
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (app.is_platform());  -- only platform admin sets entitlements (BR-05)

CREATE TABLE app.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid REFERENCES app.organizations(id),  -- NULL only for platform roles
  email               citext NOT NULL,
  email_verified_at   timestamptz,
  name                text NOT NULL,
  role                text NOT NULL CHECK (role IN ('platform_admin','company_admin','candidate')),
  password_hash       text,           -- argon2id; NULL for SSO-only
  must_reset_password boolean NOT NULL DEFAULT false,
  mfa_secret_ref      text,           -- Secrets Manager ref, never the secret
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','deleted')),
  failed_logins       int NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT platform_has_no_org CHECK ((role = 'platform_admin') = (org_id IS NULL)),
  UNIQUE (org_id, email)
);
CREATE INDEX users_org_idx ON app.users (org_id);
CREATE UNIQUE INDEX users_platform_email_uq ON app.users (email) WHERE org_id IS NULL;
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.users
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

-- Append-only audit log (BR-31). hs_app has INSERT + SELECT only (see 001_roles.sql).
CREATE TABLE audit.events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  actor_role  text NOT NULL,
  org_id      uuid,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  user_agent  text,
  request_id  text,
  prev_hash   bytea,
  hash        bytea NOT NULL   -- sha256(prev_hash || row payload): tamper-evident chain
);
CREATE INDEX audit_org_at_idx ON audit.events (org_id, at DESC);

CREATE OR REPLACE FUNCTION audit.block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit.events is append-only'; END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.block_mutation();
