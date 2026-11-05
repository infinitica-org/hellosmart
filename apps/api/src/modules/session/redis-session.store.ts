import type { RedisLike } from '../redis/redis.tokens.js';
import type {
  IdempotencyRecord,
  IdempotencyStore,
  SessionRecord,
  SessionStore,
} from './session.types.js';

/** Token-hash tagged so a single-key GET stays cluster-local. */
function sessionKey(tokenHash: string): string {
  return `hs:session:{${tokenHash}}`;
}

/** User-tagged index. Cap Lua stays standalone-safe; cluster needs a later split. */
function userIndexKey(userId: string): string {
  return `hs:user-sessions:{${userId}}`;
}

const IDEM_PREFIX = 'hs:idem:';

const REGISTER_AND_ENFORCE_CAP_LUA = `
pcall(cjson.encode_empty_table_as_object, false)
local userKey = KEYS[1]
local now = tonumber(ARGV[1])
local maxSessions = tonumber(ARGV[2])
local newTokenHash = ARGV[3]
local newRecordJson = ARGV[4]
local newTtlSeconds = tonumber(ARGV[5])

local hashes = redis.call('SMEMBERS', userKey)
local valid = {}

for _, hash in ipairs(hashes) do
  local key = 'hs:session:{' .. hash .. '}'
  local raw = redis.call('GET', key)
  if not raw then
    redis.call('SREM', userKey, hash)
  else
    local ok, rec = pcall(cjson.decode, raw)
    if not ok or not rec then
      redis.call('DEL', key)
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
      local absExpired = (rec.absoluteExpiresAt and now >= rec.absoluteExpiresAt)
      local idleExpired = (rec.lastSeenAt and (now - rec.lastSeenAt) >= idleTimeoutMs)
      if absExpired or idleExpired or not rec.absoluteExpiresAt or not rec.lastSeenAt then
        redis.call('DEL', key)
        redis.call('SREM', userKey, hash)
      else
        table.insert(valid, { hash = hash, createdAt = rec.createdAt or 0, raw = raw })
      end
    end
  end
end

table.sort(valid, function(a, b) return (a.createdAt or 0) < (b.createdAt or 0) end)

local evicted = {}
if #valid >= maxSessions then
  local toEvictCount = #valid - maxSessions + 1
  for i = 1, toEvictCount do
    local item = valid[i]
    redis.call('DEL', 'hs:session:{' .. item.hash .. '}')
    redis.call('SREM', userKey, item.hash)
    table.insert(evicted, item.raw)
  end
end

redis.call('SET', 'hs:session:{' .. newTokenHash .. '}', newRecordJson, 'EX', newTtlSeconds)
redis.call('SADD', userKey, newTokenHash)
local setTtl = math.max(newTtlSeconds, 86400)
redis.call('EXPIRE', userKey, setTtl)

return cjson.encode(evicted)
`;

const DELETE_SESSION_LUA = `
local sessionKey = KEYS[1]
local userKey = KEYS[2]
local hash = ARGV[1]
local raw = redis.call('GET', sessionKey)
if raw then
  redis.call('SREM', userKey, hash)
end
redis.call('DEL', sessionKey)
return raw or ''
`;

const TOUCH_SESSION_LUA = `
local sessionKey = KEYS[1]
local userKey = KEYS[2]
local payload = ARGV[1]
local ttl = tonumber(ARGV[2])
redis.call('SET', sessionKey, payload, 'EX', ttl)
redis.call('EXPIRE', userKey, math.max(ttl, 86400))
return 1
`;

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: RedisLike) {}

  async get(tokenHash: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(sessionKey(tokenHash));
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
    await this.redis.set(sessionKey(tokenHash), JSON.stringify(record), {
      EX: ttlSeconds,
    });
  }

  async touch(tokenHash: string, record: SessionRecord, ttlSeconds: number): Promise<void> {
    await this.redis.eval(TOUCH_SESSION_LUA, {
      keys: [sessionKey(tokenHash), userIndexKey(record.userId)],
      arguments: [JSON.stringify(record), String(ttlSeconds)],
    });
  }

  async delete(tokenHash: string): Promise<void> {
    const record = await this.get(tokenHash);
    if (!record?.userId) {
      await this.redis.del(sessionKey(tokenHash));
      return;
    }
    await this.redis.eval(DELETE_SESSION_LUA, {
      keys: [sessionKey(tokenHash), userIndexKey(record.userId)],
      arguments: [tokenHash],
    });
  }

  async registerAndEnforceCap(
    userId: string,
    tokenHash: string,
    record: SessionRecord,
    maxSessions: number,
    ttlSeconds: number,
  ): Promise<{ evictedRecords: SessionRecord[] }> {
    const resultJson = await this.redis.eval(REGISTER_AND_ENFORCE_CAP_LUA, {
      keys: [userIndexKey(userId)],
      arguments: [
        String(Date.now()),
        String(maxSessions),
        tokenHash,
        JSON.stringify(record),
        String(ttlSeconds),
      ],
    });
    let evictedRawList: unknown[] = [];
    if (resultJson) {
      try {
        const parsed = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        if (Array.isArray(parsed)) {
          evictedRawList = parsed;
        }
      } catch {
        evictedRawList = [];
      }
    }
    const evictedRecords: SessionRecord[] = evictedRawList
      .map((raw) => {
        try {
          return typeof raw === 'string' ? (JSON.parse(raw) as SessionRecord) : (raw as SessionRecord);
        } catch {
          return null;
        }
      })
      .filter((rec): rec is SessionRecord => Boolean(rec));
    return { evictedRecords };
  }

  async getUserSessions(
    userId: string,
  ): Promise<Array<{ tokenHash: string; record: SessionRecord }>> {
    const userKey = userIndexKey(userId);
    const tokenHashes = await this.redis.sMembers(userKey);
    if (tokenHashes.length === 0) {
      return [];
    }
    const now = Date.now();
    const keys = tokenHashes.map((hash) => sessionKey(hash));
    const raws = this.redis.mGet
      ? await this.redis.mGet(keys)
      : await Promise.all(keys.map((key) => this.redis.get(key)));

    const result: Array<{ tokenHash: string; record: SessionRecord }> = [];
    const stale: string[] = [];

    for (let i = 0; i < tokenHashes.length; i += 1) {
      const hash = tokenHashes[i];
      const raw = raws[i];
      if (!hash || !raw) {
        if (hash) stale.push(hash);
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
          stale.push(hash);
          await this.redis.del(sessionKey(hash));
        } else {
          result.push({ tokenHash: hash, record });
        }
      } catch {
        stale.push(hash);
        await this.redis.del(sessionKey(hash));
      }
    }

    if (stale.length > 0) {
      await this.redis.sRem(userKey, stale);
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
    await this.delete(target.tokenHash);
    return target.record;
  }

  async revokeAllForUser(userId: string): Promise<SessionRecord[]> {
    const userKey = userIndexKey(userId);
    const tokenHashes = await this.redis.sMembers(userKey);
    const revoked: SessionRecord[] = [];
    const keys = tokenHashes.map((hash) => sessionKey(hash));
    const raws = this.redis.mGet
      ? await this.redis.mGet(keys)
      : await Promise.all(keys.map((key) => this.redis.get(key)));

    for (let i = 0; i < tokenHashes.length; i += 1) {
      const raw = raws[i];
      if (raw) {
        try {
          revoked.push(JSON.parse(raw) as SessionRecord);
        } catch {
          // ignore
        }
      }
    }
    if (keys.length > 0) {
      await this.redis.del([...keys, userKey]);
    } else {
      await this.redis.del(userKey);
    }
    return revoked;
  }

  async revokeOtherSessionsForUser(
    userId: string,
    exceptTokenHash: string,
  ): Promise<SessionRecord[]> {
    const userKey = userIndexKey(userId);
    const tokenHashes = await this.redis.sMembers(userKey);
    const revoked: SessionRecord[] = [];

    for (const hash of tokenHashes) {
      if (hash === exceptTokenHash) {
        continue;
      }
      const raw = await this.redis.get(sessionKey(hash));
      if (raw) {
        try {
          revoked.push(JSON.parse(raw) as SessionRecord);
        } catch {
          // ignore
        }
      }
      await this.redis.del(sessionKey(hash));
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

  async setNx(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(IDEM_PREFIX + key, JSON.stringify(record), {
      EX: ttlSeconds,
      NX: true,
    });
    return result === 'OK' || result === true;
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(IDEM_PREFIX + key);
  }
}
