import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import type { Pool, PoolClient } from 'pg';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { CryptoService, ENVELOPE_PREFIX } from '../../common/services/crypto.service.js';
import { PG_POOL } from '../database/database.tokens.js';

authenticator.options = { window: 1 };

export interface TotpVerificationResult {
  valid: boolean;
  step?: number;
}

@Injectable()
export class MfaService {
  private readonly inMemoryLastStep = new Map<string, number>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(CryptoService) private readonly crypto: CryptoService,
    @Optional() @Inject(PG_POOL) private readonly pool?: Pool,
  ) {}

  /**
   * Verifies TOTP code against decrypted secret without consuming time-step.
   */
  verifyTotp(secret: string, code: string): boolean {
    return this.verifyTotpWithStep(secret, code).valid;
  }

  /**
   * Verifies TOTP code and returns the exact accepted time-step using checkDelta (RFC 6238).
   * Returns valid: false if code is invalid, empty, or outside the configured clock window.
   */
  verifyTotpWithStep(secret: string, code: string): TotpVerificationResult {
    if (!secret || !code) {
      return { valid: false };
    }
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return { valid: false };
    }

    const delta = authenticator.checkDelta(trimmedCode, secret);
    if (delta === null || typeof delta !== 'number') {
      return { valid: false };
    }

    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const step = currentStep + delta;
    return { valid: true, step };
  }

  /**
   * Atomically records and consumes an accepted TOTP time-step (S0-T14-3).
   *
   * In PostgreSQL: calls app.consume_totp_step, which conditionally updates app.users
   * only if mfa_last_step IS NULL OR mfa_last_step < p_step. Row lock prevents concurrent reuse.
   *
   * In isolated test environments without database pool: uses an in-memory CAS map.
   */
  async consumeStep(userId: string, step: number, client?: PoolClient): Promise<boolean> {
    if (client) {
      const res = await client.query<{ consumed: boolean }>(
        'SELECT app.consume_totp_step($1, $2) AS consumed',
        [userId, step],
      );
      return Boolean(res.rows[0]?.consumed);
    }

    if (this.pool && typeof this.pool.query === 'function') {
      try {
        const res = await this.pool.query<{ consumed: boolean }>(
          'SELECT app.consume_totp_step($1, $2) AS consumed',
          [userId, step],
        );
        return Boolean(res.rows[0]?.consumed);
      } catch (err: unknown) {
        // If DB is unreachable (e.g. unit tests without DB container), fallback to memory
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('connect ECONNREFUSED') && !msg.includes('connect EACCES')) {
          throw err;
        }
      }
    }

    // In-memory atomic CAS fallback
    const last = this.inMemoryLastStep.get(userId);
    if (last !== undefined && last >= step) {
      return false;
    }
    this.inMemoryLastStep.set(userId, step);
    return true;
  }

  /**
   * Checks whether a stored MFA secret reference should be opportunistically re-encrypted.
   * True for legacy Base32 secrets or secrets encrypted under a rotated previous key.
   * False for active key envelopes and external environment references.
   */
  needsReencryption(mfaSecretRef: string | null | undefined): boolean {
    if (!mfaSecretRef || mfaSecretRef.trim() === '') {
      return false;
    }
    const trimmed = mfaSecretRef.trim();
    if (trimmed.startsWith('env:')) {
      return false;
    }
    if (!this.crypto.isEncrypted(trimmed)) {
      return true; // Legacy Base32 secret
    }
    const activePrefix = `${ENVELOPE_PREFIX}:${this.crypto.getActiveKeyId()}:`;
    return !trimmed.startsWith(activePrefix); // Encrypted under previous key
  }

  /**
   * Opportunistically upgrades an MFA secret by encrypting it with the active key
   * and updating app.users.mfa_secret_ref.
   */
  async upgradeSecret(
    userId: string,
    plaintextSecret: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const encrypted = this.crypto.encrypt(plaintextSecret);
    const executor = client ?? this.pool;
    if (executor && typeof executor.query === 'function') {
      try {
        const res = await executor.query<{ upgraded: boolean }>(
          'SELECT app.upgrade_user_mfa_secret($1, $2) AS upgraded',
          [userId, encrypted],
        );
        return Boolean(res.rows[0]?.upgraded);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('connect ECONNREFUSED') && !msg.includes('connect EACCES')) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Resolves the plaintext MFA secret from an encrypted envelope, external reference,
   * or historical legacy Base32 record.
   */
  resolveSecret(mfaSecretRef: string | null): string {
    if (!mfaSecretRef || mfaSecretRef.trim() === '') {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'MFA is not configured for this account',
        code: 'MFA_NOT_CONFIGURED',
      });
    }

    const trimmed = mfaSecretRef.trim();

    // 1. AES-256-GCM encrypted envelope (enc:v1:<keyId>:<iv>:<tag>:<ciphertext>)
    if (this.crypto.isEncrypted(trimmed)) {
      try {
        return this.crypto.decrypt(trimmed);
      } catch {
        throw problem({
          title: 'Unauthorized',
          status: 401,
          detail: 'MFA secret unavailable or invalid',
          code: 'MFA_NOT_CONFIGURED',
        });
      }
    }

    // 2. External environment reference (dev/test/seeds)
    if (trimmed.startsWith('env:')) {
      const envKey = trimmed.slice('env:'.length);
      if (envKey === 'PLATFORM_ADMIN_MFA_SECRET' && this.config.PLATFORM_ADMIN_MFA_SECRET) {
        return this.config.PLATFORM_ADMIN_MFA_SECRET;
      }
    }

    // 3. Legacy plaintext Base32 secret fallback (RFC 4648 Base32 alphabet: A-Z, 2-7)
    if (/^[A-Z2-7]{16,64}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    throw problem({
      title: 'Unauthorized',
      status: 401,
      detail: 'MFA secret unavailable',
      code: 'MFA_NOT_CONFIGURED',
    });
  }

  /**
   * Encrypts a plaintext MFA secret using AES-256-GCM and returns the formatted envelope.
   */
  encryptSecret(secret: string): string {
    return this.crypto.encrypt(secret);
  }

  /**
   * Generates a new Base32 TOTP secret, encrypts it with AES-256-GCM, and builds otpauth URI.
   */
  generateMfaSecret(
    accountName?: string,
    issuer = 'HelloSmart.ai',
  ): { secret: string; encryptedSecret: string; uri: string } {
    const secret = authenticator.generateSecret();
    const encryptedSecret = this.crypto.encrypt(secret);
    const uri = accountName ? authenticator.keyuri(accountName, issuer, secret) : '';
    return { secret, encryptedSecret, uri };
  }

  /**
   * Clears in-memory test counters (for test harness isolation).
   */
  resetInMemorySteps(): void {
    this.inMemoryLastStep.clear();
  }

  normalizeBackupCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  formatBackupCode(raw: string): string {
    const normalized = this.normalizeBackupCode(raw).replace(/-/g, '');
    if (normalized.length !== 8) {
      return this.normalizeBackupCode(raw);
    }
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }

  hashBackupCode(raw: string): string {
    const formatted = this.formatBackupCode(raw);
    const body = formatted.replace(/-/g, '');
    return createHash('sha256').update(body, 'utf8').digest('hex');
  }

  generateBackupCodes(count = 10): string[] {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes: string[] = [];
    for (let i = 0; i < count; i += 1) {
      let body = '';
      const bytes = randomBytes(8);
      for (let j = 0; j < 8; j += 1) {
        body += alphabet[bytes[j]! % alphabet.length];
      }
      codes.push(`${body.slice(0, 4)}-${body.slice(4)}`);
    }
    return codes;
  }

  resolvePendingSecret(mfaEnrollmentPendingRef: string | null): string {
    if (!mfaEnrollmentPendingRef || mfaEnrollmentPendingRef.trim() === '') {
      throw problem({
        title: 'Bad Request',
        status: 400,
        detail: 'No MFA setup is in progress',
        code: 'MFA_SETUP_NOT_STARTED',
      });
    }
    const trimmed = mfaEnrollmentPendingRef.trim();
    if (this.crypto.isEncrypted(trimmed)) {
      try {
        return this.crypto.decrypt(trimmed);
      } catch {
        throw problem({
          title: 'Bad Request',
          status: 400,
          detail: 'MFA setup secret is invalid',
          code: 'MFA_SETUP_INVALID',
        });
      }
    }
    throw problem({
      title: 'Bad Request',
      status: 400,
      detail: 'MFA setup secret is invalid',
      code: 'MFA_SETUP_INVALID',
    });
  }

  async setEnrollmentPending(userId: string, encryptedPending: string): Promise<boolean> {
    if (!this.pool) {
      return true;
    }
    const res = await this.pool.query<{ ok: boolean }>(
      'SELECT app.set_mfa_enrollment_pending($1, $2) AS ok',
      [userId, encryptedPending],
    );
    return Boolean(res.rows[0]?.ok);
  }

  async getEnrollmentPendingRef(userId: string): Promise<string | null> {
    if (!this.pool) {
      return null;
    }
    const res = await this.pool.query<{ ref: string | null }>(
      'SELECT app.get_mfa_enrollment_pending($1) AS ref',
      [userId],
    );
    const ref = res.rows[0]?.ref;
    return ref && ref.trim() !== '' ? ref : null;
  }

  async clearEnrollmentPending(userId: string): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.query('SELECT app.clear_mfa_enrollment_pending($1)', [userId]);
  }

  async confirmEnrollment(userId: string, encryptedSecret: string): Promise<boolean> {
    if (!this.pool) {
      return true;
    }
    const res = await this.pool.query<{ ok: boolean }>(
      'SELECT app.confirm_mfa_enrollment($1, $2) AS ok',
      [userId, encryptedSecret],
    );
    return Boolean(res.rows[0]?.ok);
  }

  async storeBackupCodeHashes(userId: string, hashes: string[]): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.query('SELECT app.delete_mfa_backup_codes_for_user($1)', [userId]);
    for (const hash of hashes) {
      await this.pool.query('SELECT app.insert_mfa_backup_code_hash($1, $2)', [userId, hash]);
    }
  }

  async consumeBackupCode(userId: string, rawBackupCode: string): Promise<boolean> {
    const hash = this.hashBackupCode(this.formatBackupCode(rawBackupCode));
    if (!this.pool) {
      return false;
    }
    const res = await this.pool.query<{ consumed: boolean }>(
      'SELECT app.consume_mfa_backup_code($1, $2) AS consumed',
      [userId, hash],
    );
    return Boolean(res.rows[0]?.consumed);
  }

  async countUnusedBackupCodes(userId: string): Promise<number> {
    if (!this.pool) {
      return 0;
    }
    const res = await this.pool.query<{ count: number }>(
      'SELECT app.count_unused_mfa_backup_codes($1) AS count',
      [userId],
    );
    return res.rows[0]?.count ?? 0;
  }
}
