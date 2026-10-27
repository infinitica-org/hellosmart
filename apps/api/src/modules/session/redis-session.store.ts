import type { RedisLike } from '../redis/redis.tokens.js';
import type { IdempotencyRecord, IdempotencyStore, SessionRecord, SessionStore } from './session.types.js';

const SESSION_PREFIX = 'hs:session:';
const USER_SESSIONS_PREFIX = 'hs:user-sessions:';
const IDEM_PREFIX = 'hs:idem:';

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

  async get(sessionId: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(SESSION_PREFIX + sessionId);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionRecord;
  }

  async set(sessionId: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(SESSION_PREFIX + sessionId, JSON.stringify(record), { EX: ttlSeconds });
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + sessionId);
  }

  async registerUserSession(userId: string, sessionId: string, ttlSeconds: number): Promise<void> {
    const key = USER_SESSIONS_PREFIX + userId;
    await this.redis.sAdd(key, sessionId);
    await this.redis.expire(key, ttlSeconds);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const key = USER_SESSIONS_PREFIX + userId;
    const sessionIds = await this.redis.sMembers(key);
    if (sessionIds.length === 0) {
      return;
    }
    for (const sessionId of sessionIds) {
      await this.redis.del(SESSION_PREFIX + sessionId);
    }
    await this.redis.del(key);
  }
}

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(private readonly redis: RedisLike) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(IDEM_PREFIX + key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as IdempotencyRecord;
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(IDEM_PREFIX + key, JSON.stringify(record), { EX: ttlSeconds });
  }
}
