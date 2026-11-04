import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { problem } from '../../common/errors/app-http.exception.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';
import { hashToken } from '../session/session.service.js';

const PREAUTH_PREFIX = 'hs:preauth:';
const PREAUTH_TTL_SECONDS = 10 * 60;
export const MAX_MFA_ATTEMPTS = 3;

export interface PreAuthPayload {
  userId: string;
  attempts: number;
}

@Injectable()
export class PreAuthService {
  private readonly memory = new Map<string, PreAuthPayload & { expiresAt: number }>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: HelloRedisClient) {}

  async issue(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const payload: PreAuthPayload = { userId, attempts: 0 };
    await this.save(hashToken(rawToken), payload);
    return rawToken;
  }

  async get(token: string): Promise<PreAuthPayload | null> {
    const key = hashToken(token.trim());
    if (this.redis?.isOpen) {
      const raw = await this.redis.get(PREAUTH_PREFIX + key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as PreAuthPayload;
    }
    const row = this.memory.get(key);
    if (!row || row.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return { userId: row.userId, attempts: row.attempts };
  }

  async recordFailedAttempt(token: string): Promise<void> {
    const payload = await this.get(token);
    if (!payload) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Pre-authentication expired or invalid',
        code: 'PREAUTH_INVALID',
      });
    }
    const next: PreAuthPayload = { userId: payload.userId, attempts: payload.attempts + 1 };
    if (next.attempts >= MAX_MFA_ATTEMPTS) {
      await this.delete(token);
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Too many MFA attempts',
        code: 'MFA_LOCKED',
      });
    }
    await this.save(hashToken(token.trim()), next);
  }

  async delete(token: string): Promise<void> {
    const key = hashToken(token.trim());
    if (this.redis?.isOpen) {
      await this.redis.del(PREAUTH_PREFIX + key);
      return;
    }
    this.memory.delete(key);
  }

  private async save(tokenHash: string, payload: PreAuthPayload): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.set(PREAUTH_PREFIX + tokenHash, JSON.stringify(payload), {
        EX: PREAUTH_TTL_SECONDS,
      });
      return;
    }
    this.memory.set(tokenHash, {
      ...payload,
      expiresAt: Date.now() + PREAUTH_TTL_SECONDS * 1000,
    });
  }
}
