import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARGON2_CONFIG,
  ARGON2ID_PREFIX,
  hashPassword,
  verifyPassword,
  isArgon2idHashWithSettings,
  getSeedDefaultPassword,
  resolveSeedPasswordHash,
  getPlatformAdminTotpSecret,
  encryptTotpSecret,
  SEED_PASSWORD_ENV_VAR,
  SEED_TOTP_SECRET_ENV_VAR,
} from '../dist/lib/credentials.js';

describe('Credentials & Argon2id Password Hasher Tests ([13.1])', () => {
  const TEST_PASSWORD = 'CorrectHorseBatteryStaple123!';

  describe('Argon2id Configuration & Hashing', () => {
    it('uses exact settings: 64 MB memory, 3 iterations, parallelism 1', () => {
      assert.strictEqual(ARGON2_CONFIG.memoryCost, 65536, 'Memory cost must be 65536 (64 MB)');
      assert.strictEqual(ARGON2_CONFIG.timeCost, 3, 'Time cost must be 3 iterations');
      assert.strictEqual(ARGON2_CONFIG.parallelism, 1, 'Parallelism must be 1');
    });

    it('produces valid Argon2id hash with expected parameter prefix', async () => {
      const hash = await hashPassword(TEST_PASSWORD);
      assert.ok(hash.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'));
      assert.strictEqual(isArgon2idHashWithSettings(hash), true);
    });

    it('verifies correctly against matching password and rejects incorrect password', async () => {
      const hash = await hashPassword(TEST_PASSWORD);
      const isMatch = await verifyPassword(hash, TEST_PASSWORD);
      assert.strictEqual(isMatch, true);

      const isMismatch = await verifyPassword(hash, 'WrongPassword123!');
      assert.strictEqual(isMismatch, false);
    });

    it('idempotency: resolveSeedPasswordHash preserves existing matching hash without re-hashing', async () => {
      const initialHash = await hashPassword(TEST_PASSWORD);
      // Resolving with same password should return the exact same hash string
      const resolvedHash = await resolveSeedPasswordHash(initialHash, TEST_PASSWORD);
      assert.strictEqual(resolvedHash, initialHash, 'Matching existing hash must be reused');

      // Resolving with different password should re-hash
      const rehashed = await resolveSeedPasswordHash(initialHash, 'NewDifferentPassword123!');
      assert.notStrictEqual(rehashed, initialHash, 'Mismatched hash must trigger re-hash');
    });
  });

  describe('Environment Variable Loading & Policy Checks', () => {
    it('throws non-secret error when SEED_DEFAULT_PASSWORD is not set', () => {
      const original = process.env[SEED_PASSWORD_ENV_VAR];
      try {
        delete process.env[SEED_PASSWORD_ENV_VAR];
        assert.throws(
          () => getSeedDefaultPassword(),
          /Missing required environment variable SEED_DEFAULT_PASSWORD/,
        );
      } finally {
        if (original !== undefined) {
          process.env[SEED_PASSWORD_ENV_VAR] = original;
        }
      }
    });

    it('reads SEED_DEFAULT_PASSWORD correctly when present', () => {
      const original = process.env[SEED_PASSWORD_ENV_VAR];
      try {
        process.env[SEED_PASSWORD_ENV_VAR] = 'ValidLocalTestPassword123!';
        const read = getSeedDefaultPassword();
        assert.strictEqual(read, 'ValidLocalTestPassword123!');
      } finally {
        if (original !== undefined) {
          process.env[SEED_PASSWORD_ENV_VAR] = original;
        } else {
          delete process.env[SEED_PASSWORD_ENV_VAR];
        }
      }
    });
  });

  describe('Platform Admin TOTP Secret Handling', () => {
    it('returns null when SEED_PLATFORM_ADMIN_TOTP_SECRET is not configured', () => {
      const original = process.env[SEED_TOTP_SECRET_ENV_VAR];
      try {
        delete process.env[SEED_TOTP_SECRET_ENV_VAR];
        assert.strictEqual(getPlatformAdminTotpSecret(), null);
      } finally {
        if (original !== undefined) {
          process.env[SEED_TOTP_SECRET_ENV_VAR] = original;
        }
      }
    });

    it('accepts and cleans valid Base32 secret', () => {
      const original = process.env[SEED_TOTP_SECRET_ENV_VAR];
      try {
        process.env[SEED_TOTP_SECRET_ENV_VAR] = 'jbsw y3dp ehpk 3pxp';
        const secret = getPlatformAdminTotpSecret();
        assert.strictEqual(secret, 'JBSWY3DPEHPK3PXP');
      } finally {
        if (original !== undefined) {
          process.env[SEED_TOTP_SECRET_ENV_VAR] = original;
        } else {
          delete process.env[SEED_TOTP_SECRET_ENV_VAR];
        }
      }
    });

    it('throws descriptive error on invalid Base32 secret', () => {
      const original = process.env[SEED_TOTP_SECRET_ENV_VAR];
      try {
        process.env[SEED_TOTP_SECRET_ENV_VAR] = 'INVALID_SECRET_1890_!#$';
        assert.throws(() => getPlatformAdminTotpSecret(), /Base32/);
      } finally {
        if (original !== undefined) {
          process.env[SEED_TOTP_SECRET_ENV_VAR] = original;
        } else {
          delete process.env[SEED_TOTP_SECRET_ENV_VAR];
        }
      }
    });

    it('encryptTotpSecret throws indicating missing S0-T14-3 component', () => {
      assert.throws(
        () => encryptTotpSecret('JBSWY3DPEHPK3PXP'),
        /S0-T14-3 AES-256-GCM encryption helper is missing/,
      );
    });
  });
});
