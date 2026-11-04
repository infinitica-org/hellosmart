import crypto from 'node:crypto';

/**
 * Encrypts a raw customer quote access token using AES-256-GCM.
 * The master key is derived from the application secret key using SHA-256.
 * Returns an authenticated ciphertext in format: "ivHex:authTagHex:encryptedHex".
 */
export function encryptQuoteToken(token: string, secretKey: string): string {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts and authenticates an encrypted quote access token.
 * Returns the raw token string on success, or null if decryption/authentication fails.
 */
export function decryptQuoteToken(encryptedToken: string, secretKey: string): string | null {
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      return null;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) {
      return null;
    }
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Validates a candidate raw token against an expected SHA-256 hex hash using constant-time comparison.
 * Prevents timing-channel side attacks when verifying customer or admin-supplied tokens.
 */
export function timingSafeTokenHashEqual(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false;
  const computedHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const bufA = Buffer.from(computedHash, 'utf8');
  const bufB = Buffer.from(expectedHash.trim(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
