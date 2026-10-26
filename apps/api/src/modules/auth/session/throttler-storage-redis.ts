import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export interface ThrottlerRedisOptions {
  /**
   * In strict mode (production/staging), failure to reach Redis fails closed
   * (blocks the request) rather than silently downgrading to per-instance memory counters.
   */
  strictMode?: boolean;
}

@Injectable()
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerStorageRedis.name);
  private memoryFallback = new Map<string, { totalHits: number; expiresAt: number; blockedUntil?: number }>();

  constructor(
    @Optional() private readonly redis?: Redis | null,
    private readonly options: ThrottlerRedisOptions = {},
  ) {}

  async increment(
    key: string,
    ttl: number, // in milliseconds
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const isStrict = this.options.strictMode ?? (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging');

    if (!this.redis) {
      if (isStrict) {
        this.logger.error(
          'CRITICAL: Redis client is missing in strict mode for ThrottlerStorageRedis. Failing closed to prevent unthrottled access.',
        );
        return {
          totalHits: limit + 1,
          timeToExpire: 60,
          isBlocked: true,
          timeToBlockExpire: 60,
        };
      }
      return this.incrementMemory(key, ttl, limit, blockDuration, throttlerName);
    }

    try {
      const redisKey = `hs_throttle:${throttlerName}:${key}`;
      const blockKey = `hs_throttle:block:${throttlerName}:${key}`;

      // Check if key is currently blocked
      const isBlockedTtl = await this.redis.pttl(blockKey);
      if (isBlockedTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: Math.ceil(isBlockedTtl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(isBlockedTtl / 1000),
        };
      }

      // Atomic increment and TTL lookup via Redis pipeline
      const results = await this.redis
        .pipeline()
        .incr(redisKey)
        .pttl(redisKey)
        .exec();

      const totalHits = (results?.[0]?.[1] as number) ?? 1;
      let timeToExpireMs = (results?.[1]?.[1] as number) ?? -1;

      // If key had no TTL (-1 or -2), set TTL
      if (timeToExpireMs <= 0) {
        await this.redis.pexpire(redisKey, ttl);
        timeToExpireMs = ttl;
      }

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        await this.redis.psetex(blockKey, blockDuration, '1');
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil(timeToExpireMs / 1000)),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (isStrict) {
        this.logger.error(
          `CRITICAL: Redis throttling failure in strict mode (${errMsg}). Enforcing fail-closed policy (blocking request).`,
        );
        return {
          totalHits: limit + 1,
          timeToExpire: 60,
          isBlocked: true,
          timeToBlockExpire: 60,
        };
      }

      this.logger.warn(`Redis throttling error, falling back to memory in non-strict mode: ${errMsg}`);
      return this.incrementMemory(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const memKey = `${throttlerName}:${key}`;
    const now = Date.now();
    let record = this.memoryFallback.get(memKey);

    if (record && record.blockedUntil && record.blockedUntil > now) {
      const remainingBlock = Math.ceil((record.blockedUntil - now) / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: remainingBlock,
        isBlocked: true,
        timeToBlockExpire: remainingBlock,
      };
    }

    if (!record || record.expiresAt <= now) {
      record = { totalHits: 1, expiresAt: now + ttl };
      this.memoryFallback.set(memKey, record);
    } else {
      record.totalHits += 1;
    }

    const isBlocked = record.totalHits > limit;
    let timeToBlockExpire = 0;

    if (isBlocked && blockDuration > 0) {
      record.blockedUntil = now + blockDuration;
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire,
    };
  }
}

