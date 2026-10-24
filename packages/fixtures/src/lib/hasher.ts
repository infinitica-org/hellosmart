import * as argon2 from '@node-rs/argon2';

const hashCache = new Map<string, string>();

/**
 * Hashes a plaintext password with argon2id matching HelloSmart API security spec.
 * Parameters: m=19456, t=2, p=1.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (hashCache.has(plain)) {
    return hashCache.get(plain)!;
  }
  const hash = await argon2.hash(plain, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  hashCache.set(plain, hash);
  return hash;
}

/**
 * Verifies if an existing hash matches the given plaintext password.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
