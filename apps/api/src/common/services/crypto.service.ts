import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { parseCryptoKey } from '../../config/config.js';

export const ENVELOPE_PREFIX = 'enc:v1';
export const GCM_IV_LENGTH_BYTES = 12;
export const GCM_TAG_LENGTH_BYTES = 16;
export const AES_KEY_LENGTH_BYTES = 32;

export class DecryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * AES-256-GCM authenticated encryption service for HelloSmart.ai (S0-T14-3).
 *
 * Properties:
 * - Cipher: aes-256-gcm authenticated encryption
 * - IV: fresh, cryptographically secure 12-byte nonce per encryption
 * - Tag: 16-byte authentication tag
 * - Key: 32-byte (256-bit) validated key
 * - Envelope: enc:v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>
 * - Key Ring: multi-key support allowing zero-downtime key rotation
 */
@Injectable()
export class CryptoService {
  private readonly keyRing = new Map<string, Buffer>();
  private readonly activeKeyId: string;

  constructor(@Inject(APP_CONFIG) private readonly config: Config) {
    this.activeKeyId = this.config.MFA_ENCRYPTION_KEY_ID || 'k1';

    // 1. Load active key
    if (this.config.MFA_ENCRYPTION_KEY) {
      const activeBuf = parseCryptoKey(this.config.MFA_ENCRYPTION_KEY, this.activeKeyId);
      this.keyRing.set(this.activeKeyId, activeBuf);
    } else {
      // In production/staging, config.ts validation prevents this.
      // In dev/test, fallback to a deterministic 32-byte test key.
      const fallbackKey = Buffer.from(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex',
      );
      this.keyRing.set(this.activeKeyId, fallbackKey);
    }

    // 2. Load previous encryption keys for zero-downtime rotation
    if (this.config.MFA_PREVIOUS_ENCRYPTION_KEYS) {
      const raw = this.config.MFA_PREVIOUS_ENCRYPTION_KEYS.trim();
      if (raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw);
          for (const [kid, kstr] of Object.entries(parsed)) {
            if (typeof kstr === 'string') {
              this.keyRing.set(kid, parseCryptoKey(kstr, kid));
            }
          }
        } catch {
          // config.ts already validates JSON
        }
      } else {
        const pairs = raw.split(',').map((p) => p.trim()).filter(Boolean);
        for (const pair of pairs) {
          const [kid, kstr] = pair.split(':');
          if (kid && kstr) {
            this.keyRing.set(kid.trim(), parseCryptoKey(kstr.trim(), kid.trim()));
          }
        }
      }
    }
  }

  /**
   * Returns whether a given string adheres to the HelloSmart v1 encrypted envelope format.
   */
  isEncrypted(payload: string | null | undefined): boolean {
    return Boolean(payload && typeof payload === 'string' && payload.startsWith(`${ENVELOPE_PREFIX}:`));
  }

  /**
   * Returns the active key identifier used for new encryptions.
   */
  getActiveKeyId(): string {
    return this.activeKeyId;
  }

  /**
   * Returns whether a given key ID exists in the key ring.
   */
  hasKey(keyId: string): boolean {
    return this.keyRing.has(keyId);
  }

  /**
   * Returns the number of keys currently loaded in the key ring.
   */
  getKeyRingSize(): number {
    return this.keyRing.size;
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a fresh 12-byte IV and active key.
   * Returns formatted storage envelope: enc:v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>
   */
  encrypt(plaintext: string): string {
    if (plaintext === null || plaintext === undefined) {
      throw new Error('Plaintext cannot be null or undefined');
    }

    const key = this.keyRing.get(this.activeKeyId);
    if (!key) {
      throw new Error(`Active MFA encryption key '${this.activeKeyId}' not found in key ring`);
    }

    // Fresh, cryptographically secure 12-byte IV per encryption
    const iv = crypto.randomBytes(GCM_IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    if (tag.length !== GCM_TAG_LENGTH_BYTES) {
      throw new Error(`Invalid auth tag length: expected ${GCM_TAG_LENGTH_BYTES} bytes, got ${tag.length}`);
    }

    return `${ENVELOPE_PREFIX}:${this.activeKeyId}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /**
   * Decrypts an envelope of format enc:v1:<keyId>:<iv_b64>:<tag_b64>:<ciphertext_b64>.
   * Authenticates ciphertext and tag using AES-256-GCM.
   * Rejects tampered data fail-closed without leaking plaintext.
   */
  decrypt(envelope: string): string {
    if (!envelope || typeof envelope !== 'string') {
      throw new DecryptionError('Invalid envelope input', 'INVALID_ENVELOPE');
    }

    const parts = envelope.split(':');
    if (parts.length !== 6 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new DecryptionError(
        'Malformed encrypted envelope format. Expected enc:v1:<keyId>:<iv>:<tag>:<ciphertext>',
        'INVALID_ENVELOPE_FORMAT',
      );
    }

    const keyId = parts[2]!;
    const ivB64 = parts[3]!;
    const tagB64 = parts[4]!;
    const ciphertextB64 = parts[5]!;

    const key = this.keyRing.get(keyId);
    if (!key) {
      throw new DecryptionError(
        `Decryption key '${keyId}' not found in configured key ring`,
        'UNKNOWN_KEY_ID',
      );
    }

    let iv: Buffer;
    let tag: Buffer;
    let ciphertext: Buffer;

    try {
      iv = Buffer.from(ivB64, 'base64');
      tag = Buffer.from(tagB64, 'base64');
      ciphertext = Buffer.from(ciphertextB64, 'base64');
    } catch {
      throw new DecryptionError('Base64 decoding failed for envelope components', 'CORRUPT_ENVELOPE');
    }

    if (iv.length !== GCM_IV_LENGTH_BYTES) {
      throw new DecryptionError(
        `Invalid IV length: expected ${GCM_IV_LENGTH_BYTES} bytes, got ${iv.length}`,
        'INVALID_IV_LENGTH',
      );
    }

    if (tag.length !== GCM_TAG_LENGTH_BYTES) {
      throw new DecryptionError(
        `Invalid auth tag length: expected ${GCM_TAG_LENGTH_BYTES} bytes, got ${tag.length}`,
        'INVALID_TAG_LENGTH',
      );
    }

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      // Safe generic error: fail closed on any authentication or integrity violation
      throw new DecryptionError(
        'Decryption failed: authentication tag mismatch or ciphertext corrupted',
        'DECRYPTION_FAILED',
      );
    }
  }
}
