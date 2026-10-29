import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticator } from 'otplib';
import { MfaService } from '../src/modules/auth/mfa.service.js';
import { CryptoService } from '../src/common/services/crypto.service.js';
import type { Config } from '../src/config/config.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PreAuthService } from '../src/modules/auth/pre-auth.service.js';
import { LoginLockoutService } from '../src/modules/auth/login-lockout.service.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { toMeDto } from '../src/modules/auth/auth.mapper.js';
import { DEFAULT_REDACT_PATHS } from '../src/modules/observability/logger.config.js';

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
    PLATFORM_ADMIN_MFA_SECRET: 'JBSWY3DPEHPK3PXP',
    MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    MFA_ENCRYPTION_KEY_ID: 'k1',
    ...overrides,
  } as Config;
}

describe('MFA Hardening: AES-256-GCM Encryption & Replay Protection (S0-T14-3)', () => {
  let config: Config;
  let cryptoService: CryptoService;
  let mfaService: MfaService;

  beforeEach(() => {
    config = createMockConfig();
    cryptoService = new CryptoService(config);
    mfaService = new MfaService(config, cryptoService);
    mfaService.resetInMemorySteps();
  });

  describe('1. Secret Resolution, Envelope Decryption & Migration Safety', () => {
    it('resolves AES-256-GCM encrypted envelope (enc:v1:...)', () => {
      const rawSecret = authenticator.generateSecret();
      const encrypted = mfaService.encryptSecret(rawSecret);

      expect(encrypted.startsWith('enc:v1:k1:')).toBe(true);
      expect(mfaService.resolveSecret(encrypted)).toBe(rawSecret);
    });

    it('resolves environment reference (env:PLATFORM_ADMIN_MFA_SECRET)', () => {
      const secret = mfaService.resolveSecret('env:PLATFORM_ADMIN_MFA_SECRET');
      expect(secret).toBe(config.PLATFORM_ADMIN_MFA_SECRET);
    });

    it('resolves legacy raw Base32 secret without dropping user access', () => {
      const legacySecret = 'JBSWY3DPEHPK3PXP';
      const resolved = mfaService.resolveSecret(legacySecret);
      expect(resolved).toBe(legacySecret);
    });

    it('rejects missing or empty secret reference', () => {
      expect(() => mfaService.resolveSecret(null)).toThrow();
      try {
        mfaService.resolveSecret(null);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'MFA_NOT_CONFIGURED',
          detail: 'MFA is not configured for this account',
        });
      }
      expect(() => mfaService.resolveSecret('')).toThrow();
      expect(() => mfaService.resolveSecret('   ')).toThrow();
    });

    it('rejects corrupt or tampered encrypted envelope', () => {
      const encrypted = mfaService.encryptSecret('JBSWY3DPEHPK3PXP');
      const tampered = encrypted.slice(0, -4) + 'AAAA';
      expect(() => mfaService.resolveSecret(tampered)).toThrow();
      try {
        mfaService.resolveSecret(tampered);
      } catch (err: any) {
        expect(err.getResponse()).toMatchObject({
          code: 'MFA_NOT_CONFIGURED',
          detail: 'MFA secret unavailable or invalid',
        });
      }
    });
  });

  describe('2. Key Rotation with Encrypted Secrets', () => {
    it('decrypts historical records encrypted with previous keys after rotation', () => {
      const keyOld = '1111111111111111111111111111111111111111111111111111111111111111';
      const keyNew = '2222222222222222222222222222222222222222222222222222222222222222';

      // Secret encrypted with old key 'k1'
      const oldCrypto = new CryptoService(
        createMockConfig({ MFA_ENCRYPTION_KEY: keyOld, MFA_ENCRYPTION_KEY_ID: 'k1' }),
      );
      const oldMfa = new MfaService(config, oldCrypto);
      const originalSecret = authenticator.generateSecret();
      const envelopeK1 = oldMfa.encryptSecret(originalSecret);
      expect(envelopeK1.startsWith('enc:v1:k1:')).toBe(true);

      // New service rotated to active key 'k2' with previous key 'k1'
      const rotatedCrypto = new CryptoService(
        createMockConfig({
          MFA_ENCRYPTION_KEY: keyNew,
          MFA_ENCRYPTION_KEY_ID: 'k2',
          MFA_PREVIOUS_ENCRYPTION_KEYS: JSON.stringify({ k1: keyOld }),
        }),
      );
      const rotatedMfa = new MfaService(config, rotatedCrypto);

      // Successfully resolves old secret
      expect(rotatedMfa.resolveSecret(envelopeK1)).toBe(originalSecret);

      // New enrollments use active key 'k2'
      const newSecret = authenticator.generateSecret();
      const envelopeK2 = rotatedMfa.encryptSecret(newSecret);
      expect(envelopeK2.startsWith('enc:v1:k2:')).toBe(true);
      expect(rotatedMfa.resolveSecret(envelopeK2)).toBe(newSecret);
    });

    it('detects when an MFA secret needs opportunistic re-encryption', () => {
      const keyOld = '1111111111111111111111111111111111111111111111111111111111111111';
      const keyNew = '2222222222222222222222222222222222222222222222222222222222222222';

      const oldCrypto = new CryptoService(
        createMockConfig({ MFA_ENCRYPTION_KEY: keyOld, MFA_ENCRYPTION_KEY_ID: 'k1' }),
      );
      const oldEnvelope = oldCrypto.encrypt('JBSWY3DPEHPK3PXP');

      const rotatedCrypto = new CryptoService(
        createMockConfig({
          MFA_ENCRYPTION_KEY: keyNew,
          MFA_ENCRYPTION_KEY_ID: 'k2',
          MFA_PREVIOUS_ENCRYPTION_KEYS: JSON.stringify({ k1: keyOld }),
        }),
      );
      const rotatedMfa = new MfaService(config, rotatedCrypto);

      // Legacy Base32 needs re-encryption
      expect(rotatedMfa.needsReencryption('JBSWY3DPEHPK3PXP')).toBe(true);
      // Secret encrypted with old key k1 needs re-encryption under active key k2
      expect(rotatedMfa.needsReencryption(oldEnvelope)).toBe(true);
      // Secret encrypted with active key k2 does NOT need re-encryption
      const newEnvelope = rotatedCrypto.encrypt('JBSWY3DPEHPK3PXP');
      expect(rotatedMfa.needsReencryption(newEnvelope)).toBe(false);
      // Environment seed references do NOT need re-encryption
      expect(rotatedMfa.needsReencryption('env:PLATFORM_ADMIN_MFA_SECRET')).toBe(false);
      expect(rotatedMfa.needsReencryption(null)).toBe(false);
    });
  });

  describe('3. TOTP Step Verification & Clock Window', () => {
    it('accepts valid TOTP code and returns exact time-step', () => {
      const secret = authenticator.generateSecret();
      const code = authenticator.generate(secret);

      const result = mfaService.verifyTotpWithStep(secret, code);
      expect(result.valid).toBe(true);
      expect(typeof result.step).toBe('number');
      const expectedStep = Math.floor(Date.now() / 1000 / 30);
      expect(Math.abs((result.step ?? 0) - expectedStep)).toBeLessThanOrEqual(1);
    });

    it('rejects invalid TOTP code without calculating step', () => {
      const secret = authenticator.generateSecret();
      const result = mfaService.verifyTotpWithStep(secret, '000000');
      expect(result.valid).toBe(false);
      expect(result.step).toBeUndefined();
    });

    it('rejects malformed code formats (non-6-digits)', () => {
      const secret = authenticator.generateSecret();
      expect(mfaService.verifyTotpWithStep(secret, '').valid).toBe(false);
      expect(mfaService.verifyTotpWithStep(secret, '12345').valid).toBe(false);
      expect(mfaService.verifyTotpWithStep(secret, '1234567').valid).toBe(false);
      expect(mfaService.verifyTotpWithStep(secret, 'abcdef').valid).toBe(false);
    });
  });

  describe('4. Atomic TOTP Replay Protection', () => {
    it('consumes a step once and rejects subsequent reuse within the same window', async () => {
      const userId = 'usr_test_user_01';
      const secret = authenticator.generateSecret();
      const code = authenticator.generate(secret);

      const { valid, step } = mfaService.verifyTotpWithStep(secret, code);
      expect(valid).toBe(true);
      expect(step).toBeDefined();

      // First consumption succeeds
      const firstConsume = await mfaService.consumeStep(userId, step!);
      expect(firstConsume).toBe(true);

      // Immediate reuse of the exact same code/step is REJECTED
      const secondConsume = await mfaService.consumeStep(userId, step!);
      expect(secondConsume).toBe(false);

      // Even older step is also rejected
      const olderConsume = await mfaService.consumeStep(userId, step! - 1);
      expect(olderConsume).toBe(false);

      // Next step in the future succeeds
      const nextConsume = await mfaService.consumeStep(userId, step! + 1);
      expect(nextConsume).toBe(true);
    });

    it('concurrent requests presenting the same valid code: exactly ONE succeeds', async () => {
      const userId = 'usr_concurrent_user_02';
      const secret = authenticator.generateSecret();
      const code = authenticator.generate(secret);

      const { valid, step } = mfaService.verifyTotpWithStep(secret, code);
      expect(valid).toBe(true);

      // Fire 5 concurrent consumption attempts for the exact same step
      const results = await Promise.all([
        mfaService.consumeStep(userId, step!),
        mfaService.consumeStep(userId, step!),
        mfaService.consumeStep(userId, step!),
        mfaService.consumeStep(userId, step!),
        mfaService.consumeStep(userId, step!),
      ]);

      const successCount = results.filter((r) => r === true).length;
      const failureCount = results.filter((r) => r === false).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(4);
    });

    it('a failed TOTP attempt does not consume the valid step', async () => {
      const userId = 'usr_failed_attempt_03';
      const secret = authenticator.generateSecret();

      // Bad attempt: verifyTotpWithStep returns false
      const badResult = mfaService.verifyTotpWithStep(secret, '999999');
      expect(badResult.valid).toBe(false);
      // Consume is not invoked on failed verification

      // Legitimate attempt with valid code succeeds
      const goodCode = authenticator.generate(secret);
      const goodResult = mfaService.verifyTotpWithStep(secret, goodCode);
      expect(goodResult.valid).toBe(true);

      const consumed = await mfaService.consumeStep(userId, goodResult.step!);
      expect(consumed).toBe(true);
    });
  });

  describe('5. AuthService Integration with Replay Defense', () => {
    it('throws MFA_REPLAY_DETECTED when user attempts to reuse a valid code in login', async () => {
      const userId = 'usr_platform_admin_01';
      const userSecret = authenticator.generateSecret();
      const encryptedSecret = mfaService.encryptSecret(userSecret);

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('find_user_for_login')) {
            return Promise.resolve({
              rows: [
                {
                  id: userId,
                  org_id: null,
                  email: 'admin@hellosmart.ai',
                  name: 'Admin',
                  role: 'platform_admin',
                  password_hash:
                    '$argon2id$v=19$m=65536,t=3,p=4$anJhd251bGxidWZmZXI$GZp3a9856n4E/b6+G4VbEg', // dummy hash
                  status: 'active',
                  must_reset_password: false,
                  mfa_secret_ref: encryptedSecret,
                  org_status: null,
                  org_name: null,
                  logo_key: null,
                },
              ],
            });
          }
          if (sql.includes('consume_totp_step')) {
            // First call returns true, second call returns false (simulating atomic replay rejection)
            if (!mockPool._stepConsumed) {
              mockPool._stepConsumed = true;
              return Promise.resolve({ rows: [{ consumed: true }] });
            }
            return Promise.resolve({ rows: [{ consumed: false }] });
          }
          if (sql.includes('record_login_success')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('append_audit_event')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
        _stepConsumed: false,
      };

      const lockout = {
        assertNotLocked: vi.fn().mockResolvedValue(undefined),
        recordFailure: vi.fn().mockResolvedValue(undefined),
        clearFailures: vi.fn().mockResolvedValue(undefined),
      } as unknown as LoginLockoutService;

      const sessions = {
        createSession: vi.fn().mockResolvedValue({ sessionId: 'sess_123' }),
        destroySession: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionService;

      const preAuth = {
        issue: vi.fn().mockResolvedValue('pre_token_123'),
        get: vi.fn(),
        recordFailedAttempt: vi.fn(),
        delete: vi.fn(),
      } as unknown as PreAuthService;

      // Real MfaService backed by the mockPool
      const realMfaService = new MfaService(config, cryptoService, mockPool as any);

      const authService = new AuthService(
        mockPool as any,
        sessions,
        lockout,
        preAuth,
        realMfaService,
      );

      // Mock password verification to succeed
      vi.spyOn(await import('../src/modules/auth/password.js'), 'verifyPassword').mockResolvedValue(
        true,
      );

      const validCode = authenticator.generate(userSecret);

      // Attempt 1: First login with valid TOTP succeeds
      const result1 = await authService.login(
        { email: 'admin@hellosmart.ai', password: 'password', mfaCode: validCode },
        { ip: '127.0.0.1' },
      );
      expect('id' in result1).toBe(true);

      // Attempt 2: Replay of exact same valid code is REJECTED with MFA_REPLAY_DETECTED
      try {
        await authService.login(
          { email: 'admin@hellosmart.ai', password: 'password', mfaCode: validCode },
          { ip: '127.0.0.1' },
        );
        expect.unreachable('Should have rejected replay');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(401);
        expect(err.getResponse?.()).toMatchObject({
          code: 'MFA_REPLAY_DETECTED',
          detail: expect.stringMatching(/MFA code already used/),
        });
      }
    });
  });

  describe('6. Zero Secret Leakage In DTOs, Logs, and Responses', () => {
    it('toMeDto never leaks mfa_secret_ref, passwords, or tokens', () => {
      const me = toMeDto({
        id: 'usr_001',
        email: 'user@example.com',
        name: 'User',
        role: 'platform_admin',
        mustResetPassword: false,
        org: null,
      });

      expect((me as any).mfa_secret_ref).toBeUndefined();
      expect((me as any).password_hash).toBeUndefined();
      expect((me as any).mfaSecret).toBeUndefined();
      expect((me as any).mfaCode).toBeUndefined();
    });

    it('logger redaction rules redact MFA encryption keys, secrets, and TOTP codes', () => {
      const sensitiveKeys = [
        'mfaSecret',
        'mfa_secret',
        'mfaCode',
        'mfa_code',
        'totpCode',
        'totp_code',
        'mfa_secret_ref',
        'mfaSecretRef',
        'MFA_ENCRYPTION_KEY',
        'MFA_PREVIOUS_ENCRYPTION_KEYS',
        'encryptionKey',
      ];

      for (const key of sensitiveKeys) {
        expect(
          DEFAULT_REDACT_PATHS.includes(key),
          `Expected ${key} to be included in DEFAULT_REDACT_PATHS`,
        ).toBe(true);
      }
    });

    it('newly generated secrets return encryptedSecret envelope, never plain in storage', () => {
      const generated = mfaService.generateMfaSecret('admin@hellosmart.ai');
      expect(generated.secret).toBeDefined();
      expect(generated.encryptedSecret.startsWith('enc:v1:')).toBe(true);
      expect(generated.encryptedSecret).not.toBe(generated.secret);
      expect(generated.uri).toContain('otpauth://totp/');
    });
  });
});
