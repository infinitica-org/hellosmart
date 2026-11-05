-- Migration 0006: Password History (S0-T17-1, BR-01)
-- Stores Argon2id hashes of previous passwords to prevent reuse across the last 5 passwords.

CREATE TABLE IF NOT EXISTS app.password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_history_user_idx ON app.password_history (user_id, created_at DESC);

ALTER TABLE app.password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.password_history FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_migrator') THEN
    DROP POLICY IF EXISTS migrator_policy ON app.password_history;
    CREATE POLICY migrator_policy ON app.password_history FOR ALL TO hs_migrator USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP POLICY IF EXISTS tenant_isolation ON app.password_history;
CREATE POLICY tenant_isolation ON app.password_history
  USING (EXISTS (SELECT 1 FROM app.users u WHERE u.id = password_history.user_id AND (u.org_id = app.current_org_id() OR app.is_platform())))
  WITH CHECK (EXISTS (SELECT 1 FROM app.users u WHERE u.id = password_history.user_id AND (u.org_id = app.current_org_id() OR app.is_platform())));

GRANT SELECT, INSERT, DELETE ON app.password_history TO hs_app;
GRANT SELECT ON app.password_history TO hs_readonly;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hs_platform') THEN
    GRANT SELECT, INSERT, DELETE ON app.password_history TO hs_platform;
  END IF;
END $$;
