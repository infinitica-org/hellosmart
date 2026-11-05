import type { ThrottlerStorage } from '@nestjs/throttler';
import type { HelloRedisClient, RedisLike } from './redis.tokens.js';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Shared rate-limit counters for multi-replica API processes.
 * Falls back to in-memory maps when Redis is not configured (unit tests).
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly memory = new Map<string, { hits: number; expiresAt: number }>();

  constructor(private readonly redis: HelloRedisClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis) {
      return this.incrementRedis(this.redis, key, ttl, limit, blockDuration);
    }
    return this.incrementMemory(key, ttl, limit, blockDuration);
  }

  private async incrementRedis(
    redis: RedisLike,
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const hits = await redis.incr(key);
    if (hits === 1) {
      await redis.expire(key, ttlSeconds);
    }
    const blocked = hits > limit;
    return {
      totalHits: hits,
      timeToExpire: ttlSeconds,
      isBlocked: blocked,
      timeToBlockExpire: blocked ? Math.max(1, Math.ceil(blockDuration / 1000)) : 0,
    };
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const current = this.memory.get(key);
    if (!current || current.expiresAt <= now) {
      this.memory.set(key, { hits: 1, expiresAt: now + ttl });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: 1 > limit,
        timeToBlockExpire: 0,
      };
    }
    current.hits += 1;
    const blocked = current.hits > limit;
    return {
      totalHits: current.hits,
      timeToExpire: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
      isBlocked: blocked,
      timeToBlockExpire: blocked ? Math.max(1, Math.ceil(blockDuration / 1000)) : 0,
    };
  }
}
