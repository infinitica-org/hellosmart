-- 0019 Platform AI Keys Vault and Credit Allocations (S1B-T05-2, AD-023, AD-024, BR-16, BR-17)
-- Canonical schema migration for platform-managed AI provider credentials and tenant credit allocations.
-- Keys are encrypted at rest with AES-256-GCM envelope encryption. Credit balances are stored in integer cents.

CREATE TABLE IF NOT EXISTS app.platform_ai_keys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'deepseek')),
  name                text NOT NULL,
  encrypted_key       text NOT NULL,
  key_last4           text NOT NULL,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  is_active           boolean NOT NULL DEFAULT true,
  description         text,
  created_by          uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_tested_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_platform_ai_keys_provider_status
  ON app.platform_ai_keys (provider, status);

CREATE INDEX IF NOT EXISTS idx_platform_ai_keys_created_at
  ON app.platform_ai_keys (created_at DESC);

CREATE TABLE IF NOT EXISTS app.platform_credit_allocations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  platform_key_id         uuid NOT NULL REFERENCES app.platform_ai_keys(id) ON DELETE RESTRICT,
  allocated_amount_cents  int NOT NULL CHECK (allocated_amount_cents >= 0),
  used_amount_cents       int NOT NULL DEFAULT 0 CHECK (used_amount_cents >= 0),
  balance_cents           int NOT NULL CHECK (balance_cents >= 0),
  markup_percentage       numeric(5, 2) NOT NULL DEFAULT 15.00 CHECK (markup_percentage >= 0),
  token_cap               int CHECK (token_cap >= 0 OR token_cap IS NULL),
  spend_cap_cents         int CHECK (spend_cap_cents >= 0 OR spend_cap_cents IS NULL),
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'revoked', 'expired')),
  notes                   text,
  expires_at              timestamptz,
  created_by              uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at              timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_platform_credit_allocations_org_id
  ON app.platform_credit_allocations (org_id);

CREATE INDEX IF NOT EXISTS idx_platform_credit_allocations_platform_key_id
  ON app.platform_credit_allocations (platform_key_id);

CREATE INDEX IF NOT EXISTS idx_platform_credit_allocations_status
  ON app.platform_credit_allocations (status);

CREATE INDEX IF NOT EXISTS idx_platform_credit_allocations_created_at
  ON app.platform_credit_allocations (created_at DESC);

-- Grants
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.platform_ai_keys TO hs_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.platform_credit_allocations TO hs_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_readonly') THEN
    GRANT SELECT ON app.platform_ai_keys TO hs_readonly;
    GRANT SELECT ON app.platform_credit_allocations TO hs_readonly;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.platform_ai_keys TO hs_platform;
    GRANT SELECT, INSERT, UPDATE, DELETE ON app.platform_credit_allocations TO hs_platform;
  END IF;
END $$;
