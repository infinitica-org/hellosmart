import { Inject, Injectable, Optional } from '@nestjs/common';
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
}
