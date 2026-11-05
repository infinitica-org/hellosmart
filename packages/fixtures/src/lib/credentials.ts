import argon2 from '@node-rs/argon2';

/**
 * Argon2id hasher configuration required by HelloSmart security specifications:
 * - 64 MB memory (65,536 KB)
 * - 3 iterations (timeCost)
 * - 1 parallelism lane
 * - Argon2id algorithm
 */
export const ARGON2_CONFIG = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
} as const;

export const ARGON2ID_PREFIX = `$argon2id$v=19$m=${ARGON2_CONFIG.memoryCost},t=${ARGON2_CONFIG.timeCost},p=${ARGON2_CONFIG.parallelism}$`;

export const SEED_PASSWORD_ENV_VAR = 'SEED_DEFAULT_PASSWORD';
export const SEED_TOTP_SECRET_ENV_VAR = 'SEED_PLATFORM_ADMIN_TOTP_SECRET';
export const PLATFORM_ADMIN_MFA_SECRET_ENV_VAR = 'PLATFORM_ADMIN_MFA_SECRET';

/**
 * Checks if a password hash string starts with the expected Argon2id prefix and parameters.
 */
export function isArgon2idHashWithSettings(hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return hash.startsWith(ARGON2ID_PREFIX);
}

/**
 * Hashes a plaintext password using Argon2id with 64 MB memory, 3 iterations, and parallelism 1.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    memoryCost: ARGON2_CONFIG.memoryCost,
    timeCost: ARGON2_CONFIG.timeCost,
    parallelism: ARGON2_CONFIG.parallelism,
    algorithm: argon2.Algorithm.Argon2id,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Validates password against the shared password policy (S0-T17).
 *
 * NOTE: S0-T17 shared password policy does not exist yet in the repository.
 * Per requirement: Do not invent a custom policy scheme; validate presence only
 * and report S0-T17 as missing.
 */
export function validatePasswordPolicy(password: string): void {
  if (!password || password.trim().length === 0) {
    throw new Error('Password validation failed: password cannot be empty.');
  }
}

/**
 * Reads the seed default password from the environment.
 * Aborts with a clear, non-leaking error if the variable is missing or empty.
 */
export function getSeedDefaultPassword(): string {
  const pwd = process.env[SEED_PASSWORD_ENV_VAR];
  if (!pwd || pwd.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${SEED_PASSWORD_ENV_VAR}. ` +
        `Configure it in .env.local before running the seed.`,
    );
  }
  validatePasswordPolicy(pwd);
  return pwd;
}

/**
 * Resolves a password hash with idempotency:
 * If an existing hash is provided and matches the expected Argon2id parameters
 * and verifies against the target password, the existing hash is reused to avoid re-hashing.
 */
export async function resolveSeedPasswordHash(
  existingHash: string | null | undefined,
  password: string,
): Promise<string> {
  if (isArgon2idHashWithSettings(existingHash)) {
    const matches = await verifyPassword(existingHash!, password);
    if (matches) {
      return existingHash!;
    }
  }
  return hashPassword(password);
}

/**
 * Reads the Platform Admin TOTP Base32 secret from the environment.
 * Returns null if not set. Validates Base32 formatting when present.
 */
export function getPlatformAdminTotpSecret(): string | null {
  const secret =
    process.env[PLATFORM_ADMIN_MFA_SECRET_ENV_VAR] || process.env[SEED_TOTP_SECRET_ENV_VAR];
  if (!secret || !secret.trim()) {
    return null;
  }
  const cleaned = secret.trim().replace(/\s+/g, '').toUpperCase();
  // Standard Base32 validation (RFC 4648: A-Z, 2-7, optional padding)
  if (!/^[A-Z2-7]+=*$/.test(cleaned)) {
    throw new Error(
      `Invalid format for ${PLATFORM_ADMIN_MFA_SECRET_ENV_VAR} / ${SEED_TOTP_SECRET_ENV_VAR}: secret must be a valid Base32 string.`,
    );
  }
  return cleaned;
}

/**
 * Encrypts TOTP secret using AES-256-GCM (S0-T14-3).
 *
 * NOTE: S0-T14-3 (AES-256-GCM encryption helper, key env var, and ciphertext format)
 * does not exist yet in the repository.
 * Per requirement: Do NOT invent a custom encryption scheme when S0-T14-3 is missing.
 */
export function encryptTotpSecret(secret: string): string {
  throw new Error('S0-T14-3 AES-256-GCM encryption helper is missing. Cannot encrypt TOTP secret.');
}
