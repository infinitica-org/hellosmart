import type { RedisLike } from '../redis/redis.tokens.js';
import type {
  IdempotencyRecord,
  IdempotencyStore,
  SessionRecord,
  SessionStore,
} from './session.types.js';

const SESSION_PREFIX = 'hs:session:';
const USER_SESSIONS_PREFIX = 'hs:user-sessions:';
const IDEM_PREFIX = 'hs:idem:';

/**
 * Demonstrably atomic Redis Lua script for concurrency cap enforcement.
 * Performs pruning of expired sessions, oldest-session eviction, and index updates atomically.
 */
const REGISTER_AND_ENFORCE_CAP_LUA = `
local userKey = KEYS[1]
local now = tonumber(ARGV[1])
local maxSessions = tonumber(ARGV[2])
local newTokenHash = ARGV[3]
local newRecordJson = ARGV[4]
local newTtlSeconds = tonumber(ARGV[5])
local sessionPrefix = ARGV[6]

local hashes = redis.call('SMEMBERS', userKey)
local valid = {}

for _, hash in ipairs(hashes) do
  local raw = redis.call('GET', sessionPrefix .. hash)
  if not raw then
    redis.call('SREM', userKey, hash)
  else
    local ok, rec = pcall(cjson.decode, raw)
    if not ok or not rec then
      redis.call('DEL', sessionPrefix .. hash)
      redis.call('SREM', userKey, hash)
    else
      local idleTimeoutMs = rec.idleTimeoutMs
      if not idleTimeoutMs then
        if rec.role == 'platform_admin' then
          idleTimeoutMs = 900000
        else
          idleTimeoutMs = 1800000
        end
      end
      local absExpired = (now >= rec.absoluteExpiresAt)
      local idleExpired = ((now - rec.lastSeenAt) >= idleTimeoutMs)
      if absExpired or idleExpired then
        redis.call('DEL', sessionPrefix .. hash)
        redis.call('SREM', userKey, hash)
      else
        table.insert(valid, { hash = hash, createdAt = rec.createdAt, raw = raw })
      end
    end
  end
end

table.sort(valid, function(a, b) return a.createdAt < b.createdAt end)

local evicted = {}
if #valid >= maxSessions then
  local toEvictCount = #valid - maxSessions + 1
  for i = 1, toEvictCount do
    local item = valid[i]
    redis.call('DEL', sessionPrefix .. item.hash)
    redis.call('SREM', userKey, item.hash)
    table.insert(evicted, item.raw)
  end
end

redis.call('SET', sessionPrefix .. newTokenHash, newRecordJson, 'EX', newTtlSeconds)
redis.call('SADD', userKey, newTokenHash)
local setTtl = math.max(newTtlSeconds, 86400)
redis.call('EXPIRE', userKey, setTtl)

return cjson.encode(evicted)
`;

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

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
    const userKey = USER_SESSIONS_PREFIX + userId;
    const now = Date.now();

    // Execute atomic Lua script
    const resultJson = await this.redis.eval(REGISTER_AND_ENFORCE_CAP_LUA, {
      keys: [userKey],
      arguments: [
        String(now),
        String(maxSessions),
        tokenHash,
        JSON.stringify(record),
        String(ttlSeconds),
        SESSION_PREFIX,
      ],
    });

    const evictedRawList: string[] = JSON.parse(resultJson as string);
    const evictedRecords: SessionRecord[] = evictedRawList.map((raw) => JSON.parse(raw));

    return { evictedRecords };
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
        const idleTimeoutMs =
          record.idleTimeoutMs ??
          (record.role === 'platform_admin' ? 15 * 60 * 1000 : 30 * 60 * 1000);
        const absExpired = now >= record.absoluteExpiresAt;
        const idleExpired = now - record.lastSeenAt >= idleTimeoutMs;

        if (absExpired || idleExpired) {
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
