import fs from 'fs';
import path from 'path';
import pg from 'pg';

export async function runMigrations(): Promise<void> {
  const connectionString =
    process.env.DATABASE_MIGRATOR_URL ||
    process.env.DATABASE_URL ||
    'postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart';

  console.log(`[Migrate] Connecting to database...`);
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log(`[Migrate] Connected successfully.`);

    // Ensure migrations table exists
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS app;
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Locate migrations directory
    const candidates = [
      path.resolve(process.cwd(), '../../packages/contracts/db/migrations'),
      path.resolve(process.cwd(), '../contracts/db/migrations'),
      path.resolve(process.cwd(), 'packages/contracts/db/migrations'),
    ];

    let migrationsDir = candidates.find((dir) => fs.existsSync(dir));
    if (!migrationsDir) {
      console.warn(`[Migrate] Migrations directory not found in: ${candidates.join(', ')}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT version FROM app.schema_migrations');
    const appliedSet = new Set(appliedRows.map((r: { version: string }) => r.version));

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[Migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO app.schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[Migrate] Successfully applied ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrate] Failed applying ${file}: ${(err as Error).message}`);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log(`[Migrate] Database schema is up to date (${files.length} migrations total).`);
    } else {
      console.log(`[Migrate] Successfully executed ${appliedCount} migration(s).`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

// Auto-run if executed directly as a script
runMigrations().catch((err) => {
  console.error(`[Migrate] Fatal migration error:`, err);
  process.exit(1);
});
