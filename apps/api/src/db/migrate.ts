import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadMigratorDatabaseUrl } from '../config/migrate-config.js';

async function listMigrations(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

function repoPaths() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '../../../..');
  return {
    migrationsDir: path.join(repoRoot, 'packages/contracts/db/migrations'),
    initRolesSql: path.join(repoRoot, 'packages/contracts/db/init/001_roles.sql'),
  };
}

async function appSchemaExists(client: pg.PoolClient): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app'`,
  );
  return Boolean(r.rowCount && r.rowCount > 0);
}

/** Local Docker init runs on first volume create; older volumes may lack app/audit schemas. */
async function ensureAppSchemas(migratorUrl: string): Promise<void> {
  const probe = new pg.Pool({ connectionString: migratorUrl });
  const probeClient = await probe.connect();
  try {
    if (await appSchemaExists(probeClient)) {
      return;
    }
  } finally {
    probeClient.release();
    await probe.end();
  }

  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    throw new Error(
      'Postgres is missing the app schema. Set DATABASE_ADMIN_URL in .env (see .env.example), or reset the DB volume: pnpm infra:down, docker volume rm hellosmart_pgdata, pnpm infra:up.',
    );
  }

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
      GRANT USAGE ON SCHEMA app, audit TO hs_app, hs_readonly;
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
      'GRANT USAGE ON SCHEMA public TO hs_migrator, hs_app, hs_readonly',
    );
  } finally {
    adminClient.release();
    await adminPool.end();
  }
}

async function main(): Promise<void> {
  const url = loadMigratorDatabaseUrl();
  await ensureAppSchemas(url);

  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    throw new Error(
      'DATABASE_ADMIN_URL is required for local migrations (creates pgcrypto/citext). See .env.example.',
    );
  }
  await ensureExtensions(adminUrl);

  const { migrationsDir: dir } = repoPaths();
  const files = await listMigrations(dir);

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const file of files) {
      const id = file;
      const existing = await client.query(
        'SELECT 1 FROM app.schema_migrations WHERE id = $1',
        [id],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        continue;
      }
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        // Init revokes PUBLIC on public; extensions must install into public.
        await client.query('SET LOCAL search_path TO public, app, audit');
        await client.query(sql);
        await client.query('INSERT INTO app.schema_migrations (id) VALUES ($1)', [id]);
        await client.query('COMMIT');
        console.log(`Applied migration ${id}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('Migrations up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
