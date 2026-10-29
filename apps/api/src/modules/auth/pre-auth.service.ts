import { Inject, Injectable } from '@nestjs/common';
import { problem } from '../../common/errors/app-http.exception.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';

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
    const token = crypto.randomUUID();
    const payload: PreAuthPayload = { userId, attempts: 0 };
    await this.save(token, payload);
    return token;
  }

  async get(token: string): Promise<PreAuthPayload | null> {
    if (this.redis?.isOpen) {
      const raw = await this.redis.get(PREAUTH_PREFIX + token);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as PreAuthPayload;
    }
    const row = this.memory.get(token);
    if (!row || row.expiresAt <= Date.now()) {
      this.memory.delete(token);
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
    await this.save(token, next);
  }

  async delete(token: string): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.del(PREAUTH_PREFIX + token);
      return;
    }
    this.memory.delete(token);
  }

  private async save(token: string, payload: PreAuthPayload): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.set(PREAUTH_PREFIX + token, JSON.stringify(payload), {
        EX: PREAUTH_TTL_SECONDS,
      });
      return;
    }
    this.memory.set(token, {
      ...payload,
      expiresAt: Date.now() + PREAUTH_TTL_SECONDS * 1000,
    });
  }
}
