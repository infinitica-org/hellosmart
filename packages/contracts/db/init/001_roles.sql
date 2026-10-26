-- Local/dev bootstrap only. In AWS, roles are created by Terraform with passwords from Secrets Manager
-- and IAM DB auth for the migrator.
-- hs_owner    : owns schema objects; never used by apps.
-- hs_migrator : runs migrations (DDL); used only by the migration task.
-- hs_app      : runtime role for api/worker. DML only. Subject to RLS (NOT BYPASSRLS).
-- hs_readonly : analytics / support read access. Subject to RLS.

CREATE ROLE hs_migrator LOGIN PASSWORD 'hs_migrator_local';
CREATE ROLE hs_app LOGIN PASSWORD 'hs_app_local' NOBYPASSRLS;
CREATE ROLE hs_readonly LOGIN PASSWORD 'hs_readonly_local' NOBYPASSRLS;

GRANT CONNECT ON DATABASE hellosmart TO hs_migrator, hs_app, hs_readonly;
GRANT CREATE ON DATABASE hellosmart TO hs_migrator;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION hs_migrator;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION hs_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO hs_migrator;
GRANT USAGE ON SCHEMA public TO hs_app, hs_readonly;

GRANT USAGE ON SCHEMA app, audit TO hs_app, hs_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hs_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA app
  GRANT SELECT ON TABLES TO hs_readonly;
-- audit is append-only for the app: INSERT + SELECT, never UPDATE/DELETE.
ALTER DEFAULT PRIVILEGES FOR ROLE hs_migrator IN SCHEMA audit
  GRANT SELECT, INSERT ON TABLES TO hs_app;
