import { describe, it, expect } from 'vitest';
import { CryptoService, DecryptionError } from '../src/common/services/crypto.service.js';
import type { Config } from '../src/config/config.js';

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
    DATABASE_MIGRATOR_URL: 'postgres://hs_migrator:hs_migrator_local@127.0.0.1:5432/hellosmart',
    DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
    MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    MFA_ENCRYPTION_KEY_ID: 'k1',
    ...overrides,
  } as Config;
}

describe('CryptoService — AES-256-GCM Envelope Encryption (S0-T14-3)', () => {
  it('encrypts and decrypts Base32 TOTP secret round-trip', () => {
    const service = new CryptoService(createMockConfig());
    const rawSecret = 'JBSWY3DPEHPK3PXP';

    const envelope = service.encrypt(rawSecret);
    expect(service.isEncrypted(envelope)).toBe(true);
    expect(envelope.startsWith('enc:v1:k1:')).toBe(true);

    const decrypted = service.decrypt(envelope);
    expect(decrypted).toBe(rawSecret);
  });

  it('generates a fresh, unique IV for every encryption call with identical plaintext', () => {
    const service = new CryptoService(createMockConfig());
    const rawSecret = 'JBSWY3DPEHPK3PXP';

    const env1 = service.encrypt(rawSecret);
    const env2 = service.encrypt(rawSecret);

    expect(env1).not.toBe(env2);

    const iv1 = env1.split(':')[3];
    const iv2 = env2.split(':')[3];
    expect(iv1).not.toBe(iv2);

    expect(service.decrypt(env1)).toBe(rawSecret);
    expect(service.decrypt(env2)).toBe(rawSecret);
  });

  it('rejects tampered ciphertext fail-closed without leaking plaintext', () => {
    const service = new CryptoService(createMockConfig());
    const rawSecret = 'SUPER_SECRET_KEY_123';
    const envelope = service.encrypt(rawSecret);

    const parts = envelope.split(':');
    // Tamper with ciphertext by corrupting last base64 character
    const ct = parts[5];
    const tamperedCt = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    parts[5] = tamperedCt;
    const tamperedEnvelope = parts.join(':');

    expect(() => service.decrypt(tamperedEnvelope)).toThrow(DecryptionError);
    expect(() => service.decrypt(tamperedEnvelope)).toThrow(/authentication tag mismatch/);
  });

  it('rejects tampered authentication tag', () => {
    const service = new CryptoService(createMockConfig());
    const envelope = service.encrypt('SECRET_DATA');

    const parts = envelope.split(':');
    const tagBuf = Buffer.from(parts[4], 'base64');
    tagBuf[0] ^= 0xff; // flip bits
    parts[4] = tagBuf.toString('base64');
    const tamperedEnvelope = parts.join(':');

    expect(() => service.decrypt(tamperedEnvelope)).toThrow(DecryptionError);
    expect(() => service.decrypt(tamperedEnvelope)).toThrow(/authentication tag mismatch/);
  });

  it('rejects tampered IV', () => {
    const service = new CryptoService(createMockConfig());
    const envelope = service.encrypt('SECRET_DATA');

    const parts = envelope.split(':');
    const iv = parts[3];
    parts[3] = iv.slice(0, -2) + (iv.slice(-2) === 'AA' ? 'BB' : 'AA');
    const tamperedEnvelope = parts.join(':');

    expect(() => service.decrypt(tamperedEnvelope)).toThrow(DecryptionError);
  });

  it('rejects malformed envelope format', () => {
    const service = new CryptoService(createMockConfig());

    expect(() => service.decrypt('not-an-envelope')).toThrow(DecryptionError);
    expect(() => service.decrypt('enc:v2:k1:iv:tag:ct')).toThrow(DecryptionError);
    expect(() => service.decrypt('enc:v1:k1:missing-parts')).toThrow(DecryptionError);
  });

  it('supports zero-downtime key rotation using keyRing', () => {
    const key1 = '1111111111111111111111111111111111111111111111111111111111111111';
    const key2 = '2222222222222222222222222222222222222222222222222222222222222222';

    // 1. Initial service instance with active key 'k1'
    const serviceK1 = new CryptoService(
      createMockConfig({
        MFA_ENCRYPTION_KEY: key1,
        MFA_ENCRYPTION_KEY_ID: 'k1',
      }),
    );

    const ciphertextK1 = serviceK1.encrypt('USER_TOTP_SECRET');
    expect(ciphertextK1.startsWith('enc:v1:k1:')).toBe(true);

    // 2. Rotated service instance with active key 'k2' and previous key 'k1'
    const serviceK2 = new CryptoService(
      createMockConfig({
        MFA_ENCRYPTION_KEY: key2,
        MFA_ENCRYPTION_KEY_ID: 'k2',
        MFA_PREVIOUS_ENCRYPTION_KEYS: JSON.stringify({ k1: key1 }),
      }),
    );

    expect(serviceK2.getActiveKeyId()).toBe('k2');
    expect(serviceK2.getKeyRingSize()).toBe(2);

    // serviceK2 seamlessly decrypts historical ciphertext created with key 'k1'
    expect(serviceK2.decrypt(ciphertextK1)).toBe('USER_TOTP_SECRET');

    // New encryptions under serviceK2 use active key 'k2'
    const ciphertextK2 = serviceK2.encrypt('NEW_USER_SECRET');
    expect(ciphertextK2.startsWith('enc:v1:k2:')).toBe(true);
    expect(serviceK2.decrypt(ciphertextK2)).toBe('NEW_USER_SECRET');
  });

  it('throws UNKNOWN_KEY_ID if ciphertext was encrypted with an unknown key', () => {
    const service = new CryptoService(createMockConfig());
    const validEnvelope = service.encrypt('SECRET');

    // Replace keyId 'k1' with unknown 'k999'
    const parts = validEnvelope.split(':');
    parts[2] = 'k999';
    const unknownKeyEnvelope = parts.join(':');

    expect(() => service.decrypt(unknownKeyEnvelope)).toThrow(
      /Decryption key 'k999' not found/,
    );
  });
});
