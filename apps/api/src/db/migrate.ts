import fs from 'fs';
import path from 'path';
import pg from 'pg';

/**
 * Unique advisory lock ID to prevent concurrent migration executions (e.g. multi-replica deploy).
 */
const MIGRATION_LOCK_ID = 84729104;

/**
 * Traverses upward to locate the repository root by validating the existence
 * of the expected packages/contracts/db/migrations directory.
 */
function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    const candidateMigrationsDir = path.join(
      current,
      'packages',
      'contracts',
      'db',
      'migrations',
    );
    if (
      fs.existsSync(candidateMigrationsDir) &&
      fs.statSync(candidateMigrationsDir).isDirectory()
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir);
}

/**
 * Loads .env file safely without overriding environment variables already supplied
 * by the shell, CI pipeline, or Docker container.
 */
function loadEnvFile(): void {
  const repoRoot = findRepoRoot();
  const envCandidates = [
    path.join(repoRoot, '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  const envPath = envCandidates.find((p) => fs.existsSync(p));
  if (envPath) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // Safe assignment: do not overwrite variables already provided by shell/Docker
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  }
}

export async function runMigrations(): Promise<void> {
  loadEnvFile();

  // Fix 1: Require DATABASE_MIGRATOR_URL or DATABASE_URL without hardcoded fallback
  const connectionString =
    process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_MIGRATOR_URL or DATABASE_URL must be configured.',
    );
  }

 // Fix 4: Locate migrations directory via reliable repo root
  const repoRoot = findRepoRoot();
  const migrationsDir = path.join(
    repoRoot,
    'packages',
    'contracts',
    'db',
    'migrations',
  );

  // Fix 3: Validate migrations directory exists, is directory, and contains SQL files
  if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
    throw new Error(
      `[Migrate] Migrations directory does not exist or is not a directory: ${migrationsDir}`,

  const { initRolesSql } = repoPaths();
  const bootstrapSql = await fs.readFile(initRolesSql, 'utf8');
  const adminPool = new pg.Pool({ connectionString: adminUrl });
  const adminClient = await adminPool.connect();
  try {
    await adminClient.query(bootstrapSql);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('already exists')) {
      throw err;
    }
    // Roles may already exist; ensure schemas at minimum.
    await adminClient.query(`
      CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION hs_migrator;
      CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION hs_migrator;
      GRANT USAGE ON SCHEMA app, audit TO hs_app, hs_readonly, hs_platform;
    `);
  } finally {
    adminClient.release();
    await adminPool.end();
  }
}

async function ensureExtensions(adminUrl: string): Promise<void> {
  const adminPool = new pg.Pool({ connectionString: adminUrl });
  const adminClient = await adminPool.connect();
  try {
    await adminClient.query('SET search_path TO public');
    await adminClient.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await adminClient.query('CREATE EXTENSION IF NOT EXISTS citext');
    await adminClient.query(
      'GRANT USAGE ON SCHEMA public TO hs_migrator, hs_app, hs_readonly, hs_platform',

    );
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `[Migrate] No .sql migration files found in migrations directory: ${migrationsDir}`,
    );
  }

  console.log(`[Migrate] Connecting to database...`);
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log(`[Migrate] Connected successfully.`);

    // Fix 2: Acquire session-level advisory lock to serialize concurrent migrations
    console.log(`[Migrate] Acquiring advisory lock (${MIGRATION_LOCK_ID})...`);
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    console.log(`[Migrate] Advisory lock acquired.`);

    // Ensure schema_migrations table exists in app schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows: appliedRows } = await client.query(
      'SELECT version FROM app.schema_migrations',
    );
    const appliedSet = new Set(appliedRows.map((r: { version: string }) => r.version));

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[Migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // Keep migration execution and tracking strictly transactional
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO app.schema_migrations (version) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`[Migrate] Successfully applied ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(
          `[Migrate] Failed applying ${file}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log(
        `[Migrate] Database schema is up to date (${files.length} migrations total).`,
      );
    } else {
      console.log(`[Migrate] Successfully executed ${appliedCount} migration(s).`);
    }
  } finally {
    // Release advisory lock before closing
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } catch {
      // Ignore unlock failure if client already disconnected
    }
    // Fix 5: Guarantee client is always closed even on error
    await client.end().catch((err) => {
      console.error(`[Migrate] Error closing connection:`, (err as Error).message);
    });
  }
}

// Auto-run if executed directly as a script
runMigrations().catch((err) => {
  console.error(`[Migrate] Fatal migration error:`, err);
  process.exit(1);
});
