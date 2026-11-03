import type { PoolClient } from 'pg';

/**
 * BR-01: the only way to run tenant-scoped queries.
 * Sets app.org_id for the current transaction so Postgres RLS enforces isolation even if
 * application code forgets a WHERE clause. orgId always comes from the authenticated session.
 */
export async function withOrg<T>(
  client: PoolClient,
  orgId: string,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Platform-admin cross-org access. Callers must write an audit entry (BR-31).
 */
export async function withPlatform<T>(
  client: PoolClient,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.is_platform', 'true', true)");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * BR-01, BR-12, BR-25: Authenticated user transaction scoped by organization, user ID, and role.
 * Ensures PostgreSQL Row-Level Security filters at the database kernel level for candidates,
 * preventing cross-candidate and cross-tenant leakage.
 */
export async function withUserSession<T>(
  client: PoolClient,
  orgId: string,
  userId: string,
  role: string,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await client.query("SELECT set_config('app.user_role', $1, true)", [role]);
    await client.query("SELECT set_config('app.is_platform', 'false', true)");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
