import crypto from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  evaluatePassword,
  normalizePassword,
  type PasswordEvaluationResult,
  type PasswordPolicyContext,
} from '@hs/contracts';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_POOL, type PgPool } from '../database/database.tokens.js';
import { verifyPassword } from './password.js';

export interface BreachCheckResult {
  breached: boolean;
  count?: number;
  error?: string;
}

export interface PasswordHistoryResult {
  reused: boolean;
}

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: PgPool,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  /**
   * Deterministic local evaluation of password length, character constraints,
   * dictionary words, personal information containment, and zxcvbn entropy.
   */
  evaluateLocal(
    password: string,
    context?: PasswordPolicyContext,
  ): PasswordEvaluationResult {
    return evaluatePassword(password, context);
  }

  /**
   * Check whether a password appears in Have I Been Pwned breach corpus via k-anonymity.
   * Only the 5-character prefix of the SHA-1 hash is sent externally.
   * Uses a strict 2-second timeout and honors HIBP_FAIL_OPEN configuration.
   */
  async checkBreached(password: string): Promise<BreachCheckResult> {
    const normalized = normalizePassword(password);
    const sha1Hex = crypto
      .createHash('sha1')
      .update(normalized, 'utf8')
      .digest('hex')
      .toUpperCase();

    const prefix = sha1Hex.slice(0, 5);
    const suffix = sha1Hex.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'hellosmart-security',
          'Add-Padding': 'true',
        },
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        throw new Error(`HIBP API returned status ${response.status}`);
      }

      const body = await response.text();
      const lines = body.split(/\r?\n/);

      for (const line of lines) {
        const [candidateSuffix, countStr] = line.split(':');
        if (candidateSuffix && candidateSuffix.trim() === suffix) {
          const count = parseInt(countStr?.trim() || '1', 10);
          return { breached: true, count: isNaN(count) ? 1 : count };
        }
      }

      return { breached: false };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.config.HIBP_FAIL_OPEN) {
        this.logger.warn('HIBP breach check failed or timed out; failing open per policy', {
          error: message,
        });
        return { breached: false, error: message };
      }

      this.logger.error('HIBP breach check failed and HIBP_FAIL_OPEN is false', {
        error: message,
      });
      return { breached: true, error: message };
    }
  }

  /**
   * Checks whether the candidate password matches the user's current password
   * or any of their retained password history records (last 5).
   */
  async checkHistory(
    userId: string,
    candidatePassword: string,
    client?: PoolClient | Pool,
  ): Promise<PasswordHistoryResult> {
    const db = client ?? this.pool;

    // 1. Fetch current user password hash
    const userRes = await db.query<{ password_hash: string | null }>(
      'SELECT password_hash FROM app.users WHERE id = $1',
      [userId],
    );

    // 2. Fetch last 5 history records
    const historyRes = await db.query<{ password_hash: string }>(
      'SELECT password_hash FROM app.password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId],
    );

    const hashesToCheck = new Set<string>();
    const currentHash = userRes.rows[0]?.password_hash;
    if (currentHash) {
      hashesToCheck.add(currentHash);
    }
    for (const row of historyRes.rows) {
      if (row.password_hash) {
        hashesToCheck.add(row.password_hash);
      }
    }

    // 3. Verify against each hash using Argon2id
    for (const hash of hashesToCheck) {
      const match = await verifyPassword(hash, candidatePassword);
      if (match) {
        return { reused: true };
      }
    }

    return { reused: false };
  }

  /**
   * Records a new password hash in app.password_history and prunes older entries
   * beyond the 5 most recent records.
   */
  async recordPasswordHistory(
    userId: string,
    passwordHash: string,
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      'INSERT INTO app.password_history (user_id, password_hash) VALUES ($1, $2)',
      [userId, passwordHash],
    );

    await client.query(
      `DELETE FROM app.password_history
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM app.password_history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 5
         )`,
      [userId],
    );
  }
}
