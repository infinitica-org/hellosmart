# Database Initialization Notes & Fixes Required

**Date:** 2026-10-23  
**Audience:** Platform / DevOps team managing `packages/contracts/db/init/` and migrations.

During local setup and execution of the initial migration (`0001_tenancy_foundation.sql`), the following bootstrap behaviors were observed that require adjustments in `001_roles.sql` or `0001_tenancy_foundation.sql`:

---

### 1. Extension Creation & Schema Resolution (`pgcrypto`, `citext`)

- **Issue:**  
  `001_roles.sql` revokes all privileges on schema `public` (`REVOKE ALL ON SCHEMA public FROM PUBLIC;`).
  When `0001_tenancy_foundation.sql` runs `CREATE EXTENSION IF NOT EXISTS pgcrypto;` and `CREATE EXTENSION IF NOT EXISTS citext;` as `hs_migrator`, Postgres fails with:

  ```
  ERROR: no schema has been selected to create in
  ```

  Consequently, tables referencing `citext` fail with `ERROR: type "citext" does not exist`.

- **Workaround applied in dev:**  
  Created the extensions explicitly inside schema `app`:

  ```sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA app;
  CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA app;
  ```

- **Recommended permanent fix:**  
  In `001_roles.sql`, grant extension creation or create the extensions during init as the superuser (`hs_owner`) targeting schema `app` (or explicitly set extension schema in `0001_tenancy_foundation.sql`).

---

### 2. Role `search_path` for `hs_migrator` and `hs_app`

- **Issue:**  
  When users connect as `hs_migrator` or `hs_app`, Postgres defaults `search_path` to `"$user", public`. Because `citext` functions and types are in `app`, unqualified references like `slug citext` fail unless `app` is in the `search_path`.

- **Workaround applied in dev:**  
  Set default `search_path` on the roles:

  ```sql
  ALTER ROLE hs_migrator SET search_path TO app, public;
  ALTER ROLE hs_app SET search_path TO app, public;
  ALTER ROLE hs_readonly SET search_path TO app, public;
  ```

- **Recommended permanent fix:**  
  Add these `ALTER ROLE ... SET search_path TO app, public;` statements to `packages/contracts/db/init/001_roles.sql`.

---

### 3. Port Binding in Docker Compose on Windows

- **Issue:**  
  `docker-compose.yml` hardcodes `ports: ["127.0.0.1:5432:5432"]`. On machines running native Windows PostgreSQL services, port 5432 is already bound.
- **Workaround applied in dev:**  
  Used a git-ignored `docker-compose.override.yml` mapping `127.0.0.1:5434:5432`.
- **Recommended permanent fix:**  
  In `docker-compose.yml`, parameterize the host port with an environment variable default:
  ```yaml
  ports: ['127.0.0.1:${POSTGRES_PORT:-5432}:5432']
  ```

---

### 4. Reproducible Test Database Setup (`hellosmart_test`)

The automated fixture test suite requires a dedicated test database whose name ends in `_test` (e.g. `hellosmart_test`). To guarantee isolation, the test suite **refuses to run** against any database not ending in `_test` (such as the main `hellosmart` dev database).

#### Automated Setup Command:

```bash
pnpm --filter @hs/fixtures test:setup
```

#### Manual Reproduction Steps:

If rebuilding the test database from scratch with Docker:

1. **Create the database and grant permissions:**

   ```bash
   docker exec -i hellosmart-postgres-1 psql -U hs_owner -d postgres -c "CREATE DATABASE hellosmart_test;" -c "GRANT ALL PRIVILEGES ON DATABASE hellosmart_test TO hs_migrator;"
   ```

2. **Bootstrap schemas and extensions:**

   ```bash
   docker exec -i hellosmart-postgres-1 psql -U hs_owner -d hellosmart_test \
     -c "CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION hs_migrator;" \
     -c "CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION hs_migrator;" \
     -c "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA app;" \
     -c "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA app;"
   ```

3. **Apply migration 0001:**

   ```powershell
   Get-Content packages/contracts/db/migrations/0001_tenancy_foundation.sql | docker exec -i hellosmart-postgres-1 psql -U hs_migrator -d hellosmart_test
   ```

4. **Run the test suite:**
   ```bash
   pnpm --filter @hs/fixtures test
   ```

#### Final Seeded Dataset Breakdown:

- **Platform Admins:** 3 (`admin_super`, `admin_support`, `admin_suspended`)
- **Organizations:** 2 (`aster-ridge` [paid_active], `brindle-co` [trial_active])
- **Entitlements:** 2 (1 per organization)
- **Company Admins:** 11 (8 Aster, 3 Brindle)
- **Candidates:** 19 (10 standalone, 2 multi-tenant, 7 pipeline)
- **Total Rows:** **37**
