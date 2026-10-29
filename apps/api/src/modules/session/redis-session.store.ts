import type { RedisLike } from '../redis/redis.tokens.js';
import type {
  IdempotencyRecord,
  IdempotencyStore,
  SessionRecord,
  SessionStore,
} from './session.types.js';

const SESSION_PREFIX = 'hs:session:';
const USER_SESSIONS_PREFIX = 'hs:user-sessions:';
const LOCK_PREFIX = 'hs:lock:session:';
const IDEM_PREFIX = 'hs:idem:';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

  private async acquireUserLock(userId: string, timeoutMs = 2500): Promise<boolean> {
    const key = LOCK_PREFIX + userId;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const acquired = await this.redis.set(key, '1', { NX: true, EX: 3 });
      if (acquired) {
        return true;
      }
      await sleep(25 + Math.floor(Math.random() * 25));
    }
    return false;
  }

  private async releaseUserLock(userId: string): Promise<void> {
    try {
      await this.redis.del(LOCK_PREFIX + userId);
    } catch {
      // Best-effort release, lock has short 3s TTL
    }
  }

  async get(tokenHash: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(SESSION_PREFIX + tokenHash);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SessionRecord;
    } catch {
      return null;
    }
  }

  async set(tokenHash: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(SESSION_PREFIX + tokenHash, JSON.stringify(record), {
      EX: ttlSeconds,
    });
  }

  async delete(tokenHash: string): Promise<void> {
    const raw = await this.redis.get(SESSION_PREFIX + tokenHash);
    if (raw) {
      try {
        const record = JSON.parse(raw) as SessionRecord;
        if (record.userId) {
          await this.redis.sRem(USER_SESSIONS_PREFIX + record.userId, tokenHash);
        }
      } catch {
        // Ignore parse error on deletion
      }
    }
    await this.redis.del(SESSION_PREFIX + tokenHash);
  }

  async registerAndEnforceCap(
    userId: string,
    tokenHash: string,
    record: SessionRecord,
    maxSessions: number,
    ttlSeconds: number,
  ): Promise<{ evictedRecords: SessionRecord[] }> {
    await this.acquireUserLock(userId);
    try {
      const userKey = USER_SESSIONS_PREFIX + userId;
      const existingTokenHashes = await this.redis.sMembers(userKey);
      const now = Date.now();
      const validSessions: Array<{ tokenHash: string; record: SessionRecord }> = [];

      for (const hash of existingTokenHashes) {
        const raw = await this.redis.get(SESSION_PREFIX + hash);
        if (!raw) {
          await this.redis.sRem(userKey, hash);
          continue;
        }
        try {
          const existing = JSON.parse(raw) as SessionRecord;
          if (now >= existing.absoluteExpiresAt) {
            await this.redis.del(SESSION_PREFIX + hash);
            await this.redis.sRem(userKey, hash);
          } else {
            validSessions.push({ tokenHash: hash, record: existing });
          }
        } catch {
          await this.redis.del(SESSION_PREFIX + hash);
          await this.redis.sRem(userKey, hash);
        }
      }

      const evictedRecords: SessionRecord[] = [];
      if (validSessions.length >= maxSessions) {
        // Sort oldest first (by createdAt ascending)
        validSessions.sort((a, b) => a.record.createdAt - b.record.createdAt);
        const toEvictCount = validSessions.length - maxSessions + 1;
        const toEvict = validSessions.slice(0, toEvictCount);

        for (const item of toEvict) {
          await this.redis.del(SESSION_PREFIX + item.tokenHash);
          await this.redis.sRem(userKey, item.tokenHash);
          evictedRecords.push(item.record);
        }
      }

      // Store new session
      await this.redis.set(SESSION_PREFIX + tokenHash, JSON.stringify(record), {
        EX: ttlSeconds,
      });
      await this.redis.sAdd(userKey, tokenHash);
      await this.redis.expire(userKey, Math.max(ttlSeconds, 24 * 3600));

      return { evictedRecords };
    } finally {
      await this.releaseUserLock(userId);
    }
  }

  async getUserSessions(
    userId: string,
  ): Promise<Array<{ tokenHash: string; record: SessionRecord }>> {
    const userKey = USER_SESSIONS_PREFIX + userId;
    const tokenHashes = await this.redis.sMembers(userKey);
    const now = Date.now();
    const result: Array<{ tokenHash: string; record: SessionRecord }> = [];

    for (const hash of tokenHashes) {
      const raw = await this.redis.get(SESSION_PREFIX + hash);
      if (!raw) {
        await this.redis.sRem(userKey, hash);
        continue;
      }
      try {
        const record = JSON.parse(raw) as SessionRecord;
        if (now >= record.absoluteExpiresAt) {
          await this.redis.del(SESSION_PREFIX + hash);
          await this.redis.sRem(userKey, hash);
        } else {
          result.push({ tokenHash: hash, record });
        }
      } catch {
        await this.redis.del(SESSION_PREFIX + hash);
        await this.redis.sRem(userKey, hash);
      }
    }

    result.sort((a, b) => b.record.createdAt - a.record.createdAt);
    return result;
  }

  async revokeSessionByPublicId(
    userId: string,
    sessionId: string,
  ): Promise<SessionRecord | null> {
    const sessions = await this.getUserSessions(userId);
    const target = sessions.find(
      (s) => s.record.sessionId === sessionId || s.record.id === sessionId,
    );
    if (!target) {
      return null;
    }
    await this.redis.del(SESSION_PREFIX + target.tokenHash);
    await this.redis.sRem(USER_SESSIONS_PREFIX + userId, target.tokenHash);
    return target.record;
  }

  async revokeAllForUser(userId: string): Promise<SessionRecord[]> {
    const userKey = USER_SESSIONS_PREFIX + userId;
    const tokenHashes = await this.redis.sMembers(userKey);
    const revoked: SessionRecord[] = [];

    for (const hash of tokenHashes) {
      const raw = await this.redis.get(SESSION_PREFIX + hash);
      if (raw) {
        try {
          revoked.push(JSON.parse(raw) as SessionRecord);
        } catch {
          // Ignore parse errors
        }
        await this.redis.del(SESSION_PREFIX + hash);
      }
    }
    await this.redis.del(userKey);
    return revoked;
  }

  async revokeOtherSessionsForUser(
    userId: string,
    exceptTokenHash: string,
  ): Promise<SessionRecord[]> {
    const userKey = USER_SESSIONS_PREFIX + userId;
    const tokenHashes = await this.redis.sMembers(userKey);
    const revoked: SessionRecord[] = [];

    for (const hash of tokenHashes) {
      if (hash === exceptTokenHash) {
        continue;
      }
      const raw = await this.redis.get(SESSION_PREFIX + hash);
      if (raw) {
        try {
          revoked.push(JSON.parse(raw) as SessionRecord);
        } catch {
          // Ignore
        }
        await this.redis.del(SESSION_PREFIX + hash);
      }
      await this.redis.sRem(userKey, hash);
    }
    return revoked;
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
