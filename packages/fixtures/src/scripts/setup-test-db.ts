import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ||
  process.env['DATABASE_MIGRATOR_URL']?.replace(/\/hellosmart$/, '/hellosmart_test') ||
  'postgres://hs_migrator:hs_migrator_local@localhost:5434/hellosmart_test';

export async function setupTestDatabase(): Promise<void> {
  const parsed = new URL(TEST_DB_URL);
  const dbName = parsed.pathname.replace(/^\//, '');

  if (!dbName.endsWith('_test')) {
    throw new Error(`SAFETY: Test database setup target must end in '_test', got '${dbName}'`);
  }

  console.log(
    `Setting up test database at: ${parsed.username}@${parsed.hostname}:${parsed.port}/${dbName}`,
  );

  const client = new pg.Client({ connectionString: TEST_DB_URL });
  try {
    await client.connect();
  } catch (err: any) {
    console.error(`\nFailed to connect to ${dbName}: ${err.message}`);
    console.error(`If the database does not exist, create it with:`);
    console.error(
      `  docker exec -i hellosmart-postgres-1 psql -U hs_owner -d postgres -c "CREATE DATABASE ${dbName}; GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO hs_migrator;"`,
    );
    throw err;
  }

  try {
    // 1. Ensure schemas and search_path
    await client.query('SET search_path TO app, public;');
    await client.query("SELECT set_config('app.is_platform', 'true', false);");
    await client.query('CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION hs_migrator;');
    await client.query('CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION hs_migrator;');

    // 2. Extensions in app schema
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA app;');
      await client.query('CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA app;');
    } catch {
      // Ignored if extensions already created
    }

    // 3. Read and apply migration 0001 if tables do not exist
    const checkTable = await client.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'users';",
    );
    if (Number(checkTable.rows[0]?.count) === 0) {
      console.log('Applying migration 0001_tenancy_foundation.sql...');
      const migrationPath = path.resolve(
        process.cwd(),
        '../../packages/contracts/db/migrations/0001_tenancy_foundation.sql',
      );
      const fallbackPath = path.resolve(
        process.cwd(),
        'packages/contracts/db/migrations/0001_tenancy_foundation.sql',
      );
      const targetPath = fs.existsSync(migrationPath) ? migrationPath : fallbackPath;
      const sql = fs.readFileSync(targetPath, 'utf8');
      await client.query(sql);
      console.log('Migration 0001 applied successfully.');
    } else {
      console.log('Schema tables already present.');
    }

    // 4. Truncate test data so the test DB starts clean
    await client.query('DELETE FROM app.users;');
    await client.query('DELETE FROM app.entitlements;');
    await client.query('DELETE FROM app.organizations;');
    console.log('Test database cleaned and ready for test suite.\n');
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('setup-test-db.ts') || process.argv[1].endsWith('setup-test-db.js'))
) {
  setupTestDatabase().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });
}
