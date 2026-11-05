/**
 * Environment Safety Guards for HelloSmart Database Seeding.
 *
 * Ensures that seed operations:
 * 1. Never execute in production (NODE_ENV === 'production' or 'prod') with no bypass allowed.
 * 2. Only execute against verified local database hosts (localhost, 127.0.0.1, ::1, or docker service 'postgres').
 * 3. Fail closed if DATABASE_URL is missing, empty, or unparseable.
 * 4. Never leak raw passwords or database credentials in error messages or logs.
 */

export const LOCAL_ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'postgres', // Service name defined in docker-compose.yml
]);

export interface SafetyCheckResult {
  safe: boolean;
  hostname?: string;
  error?: string;
}

/**
 * Pure function that validates environment safety without side effects or DB connections.
 *
 * @param nodeEnv The current NODE_ENV string (e.g. 'development', 'test', 'production').
 * @param databaseUrl The target database connection string.
 * @param allowedHosts Set of permitted local hostnames (defaults to LOCAL_ALLOWED_HOSTS).
 */
export function checkEnvironmentSafety(
  nodeEnv: string | undefined,
  databaseUrl: string | undefined,
  allowedHosts: Set<string> = LOCAL_ALLOWED_HOSTS,
): SafetyCheckResult {
  // 1. Production check (Fail closed, no bypass flag permitted)
  const envNorm = (nodeEnv || '').trim().toLowerCase();
  if (envNorm === 'production' || envNorm === 'prod') {
    return {
      safe: false,
      error: `SECURITY FATAL: Database seed script execution is strictly forbidden when NODE_ENV is '${nodeEnv}'.`,
    };
  }

  // 2. Missing or empty DATABASE_URL
  if (!databaseUrl || typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    return {
      safe: false,
      error: 'SECURITY FATAL: DATABASE_URL is missing or empty. Execution blocked.',
    };
  }

  // 3. Parse hostname strictly via WHATWG URL API (no regex or substring matching)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl.trim());
  } catch {
    return {
      safe: false,
      error: 'SECURITY FATAL: DATABASE_URL is malformed or unparseable. Execution blocked.',
    };
  }

  const rawHostname = parsedUrl.hostname.toLowerCase();
  if (!rawHostname) {
    return {
      safe: false,
      error: 'SECURITY FATAL: Unable to parse hostname from DATABASE_URL. Execution blocked.',
    };
  }

  const hostname = rawHostname.replace(/^\[|\]$/g, '');

  // 4. Exact host match against allowlist (prevents 'localhost.evil.com' spoofing)
  if (!allowedHosts.has(hostname) && !allowedHosts.has(rawHostname)) {
    return {
      safe: false,
      hostname,
      error: `SECURITY FATAL: Database host '${hostname}' is non-local and not in the approved local host allowlist. Execution blocked.`,
    };
  }

  return {
    safe: true,
    hostname,
  };
}

/**
 * Asserts environment safety. Throws a fatal Error if safety checks fail.
 * Never outputs credentials in the error message.
 */
export function assertEnvironmentSafe(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  allowedHosts: Set<string> = LOCAL_ALLOWED_HOSTS,
): { hostname: string } {
  const result = checkEnvironmentSafety(nodeEnv, databaseUrl, allowedHosts);
  if (!result.safe) {
    throw new Error(result.error);
  }
  return { hostname: result.hostname! };
}

/**
 * Top-level process guard. Logs sanitized error and terminates with exit code 1 if unsafe.
 */
export function enforceSafetyOrExit(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): { hostname: string } {
  try {
    return assertEnvironmentSafe(nodeEnv, databaseUrl);
  } catch (err: any) {
    console.error(err.message || 'Fatal safety guard validation failure');
    process.exit(1);
  }
}
