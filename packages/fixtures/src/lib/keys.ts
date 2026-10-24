import crypto from 'node:crypto';

// Fixed namespace UUID for HelloSmart deterministic seed IDs
export const HELLOSMART_SEED_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Normalises an email address: trim whitespace and lowercase.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates that an email belongs to the reserved seed domain.
 */
export function isSeedEmail(email: string): boolean {
  const norm = normaliseEmail(email);
  return norm.endsWith('@seed.example.test') || norm.endsWith('.seed.example.test');
}

/**
 * Computes a deterministic UUIDv5 from a fixed namespace and a string identifier.
 */
export function deterministicUuid(category: string, identifier: string): string {
  const combined = `${category}:${identifier}`;
  const cleanNs = HELLOSMART_SEED_NAMESPACE.replace(/-/g, '');
  const nsBuffer = Buffer.from(cleanNs, 'hex');
  const nameBuffer = Buffer.from(combined, 'utf8');

  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([nsBuffer, nameBuffer]))
    .digest();

  // Set version to 5
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  // Set variant to RFC 4122
  hash[8] = (hash[8]! & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

/**
 * Computes a deterministic Date offset in days from the reference date.
 */
export function relativeDate(
  refDate: Date,
  offsetDays: number,
  hour: number = 10,
  minute: number = 0,
): Date {
  const d = new Date(refDate.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}
