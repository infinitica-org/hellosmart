/**
 * Masking Utility for HelloSmart Console & Log Outputs.
 *
 * Ensures all logged data, error messages, and objects have credentials, passwords,
 * tokens, and secrets redacted before output.
 */

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'password_hash',
  'hash',
  'secret',
  'mfa_secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
];

/**
 * Redacts credentials from a database connection string URL.
 * Example: postgres://hs_owner:secret@localhost:5432/db -> postgres://hs_owner:***@localhost:5432/db
 */
export function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return connectionString.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
  }
}

/**
 * Checks if a key name matches any known sensitive credential pattern (case-insensitive).
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Recursively masks sensitive fields in an object, array, or connection string.
 */
export function maskSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    if (input.includes('://') && input.includes('@')) {
      return maskConnectionString(input) as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => maskSensitiveData(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (isSensitiveKey(key)) {
        masked[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveData(value);
      } else if (typeof value === 'string' && value.includes('://') && value.includes('@')) {
        masked[key] = maskConnectionString(value);
      } else {
        masked[key] = value;
      }
    }
    return masked as T;
  }

  return input;
}

/**
 * Safely stringifies data with all sensitive keys and credentials redacted.
 */
export function safeStringify(input: any, space: number = 2): string {
  return JSON.stringify(maskSensitiveData(input), null, space);
}
