import pg from 'pg';

const { Pool } = pg;

export interface DbContext {
  pool: pg.Pool;
  client: pg.PoolClient;
}

export async function createDbClient(databaseUrl: string): Promise<pg.PoolClient> {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  // Ensure app schema is in search_path for citext and functions
  await client.query('SET search_path TO app, public;');
  return client;
}

/**
 * Runs a transactional block under the platform-admin context.
 * Sets app.is_platform = true so Postgres RLS allows cross-tenant provisioning.
 */
export async function withPlatformTx<T>(
  client: pg.PoolClient,
  fn: (tx: pg.PoolClient) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.is_platform', 'true', true);");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
