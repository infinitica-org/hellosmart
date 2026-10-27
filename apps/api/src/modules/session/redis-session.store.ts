import type { RedisLike } from '../redis/redis.tokens.js';
import type { IdempotencyRecord, IdempotencyStore, SessionRecord, SessionStore } from './session.types.js';

const SESSION_PREFIX = 'hs:session:';
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
