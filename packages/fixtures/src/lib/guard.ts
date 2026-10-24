import type { SeedConfig } from '../config.ts';

export function assertEnvironmentSafe(config: SeedConfig): {
  host: string;
  port: string;
  dbName: string;
  user: string;
} {
  // 1. Refuse production environment
  if (config.nodeEnv === 'production' || config.nodeEnv === 'prod') {
    throw new Error(
      'SECURITY VIOLATION: Seeding is strictly prohibited in production environments (NODE_ENV=production).',
    );
  }

  // 2. Parse database URL
  let parsed: URL;
  try {
    parsed = new URL(config.databaseUrl);
  } catch (err: any) {
    throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
  }

  const host = (parsed.hostname || 'localhost').toLowerCase();
  const port = parsed.port || '5432';
  const dbName = parsed.pathname.replace(/^\//, '') || 'hellosmart';
  const user = parsed.username || 'hs_migrator';

  // 3. Prohibit using hs_owner superuser in seed (requirement: hs_migrator or platform context)
  if (user === 'hs_owner' || user === 'postgres') {
    throw new Error(
      `SECURITY RULE: Do not use the superuser role '${user}' in the seed. Use 'hs_migrator' or platform context.`,
    );
  }

  // 4. Host allow-list check
  const isAllowedHost = config.allowedHosts.some((allowed) => allowed === host);
  if (!isAllowedHost) {
    throw new Error(
      `HOST GUARD: Database host '${host}' is not in SEED_ALLOWED_DB_HOSTS (${config.allowedHosts.join(', ')}). Aborting.`,
    );
  }

  // 5. Remote confirmation check
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === 'postgres';
  if (!isLocal && !config.confirmRemote) {
    throw new Error(
      `REMOTE GUARD: Target host '${host}' is a remote host. Pass --confirm-remote to proceed.`,
    );
  }

  return { host, port, dbName, user };
}

/**
 * Validates that a database URL or database name specifically targets a test database (ending in _test).
 * Protects local development and production databases from test runs.
 */
export function assertTestDatabaseName(databaseUrlOrName: string): string {
  let dbName = databaseUrlOrName;
  if (databaseUrlOrName.includes('://')) {
    try {
      const parsed = new URL(databaseUrlOrName);
      dbName = parsed.pathname.replace(/^\//, '');
    } catch {
      // Keep as-is if not valid URL
    }
  }
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `SAFETY ERROR: Test suite refused to run on database '${dbName}'. Target database name must end in '_test' to protect the main development database.`,
    );
  }
  return dbName;
}
