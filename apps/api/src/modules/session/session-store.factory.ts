import type { Config } from '../../config/config.js';
import type { HelloRedisClient } from '../redis/redis.tokens.js';
import { MemoryIdempotencyStore, MemorySessionStore } from './memory-session.store.js';
import { RedisIdempotencyStore, RedisSessionStore } from './redis-session.store.js';
import type { IdempotencyStore, SessionStore } from './session.types.js';

export function createSessionStore(config: Config, redis: HelloRedisClient): SessionStore {
  if (redis) {
    return new RedisSessionStore(redis);
  }
  if (config.NODE_ENV === 'staging' || config.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required for session storage in staging and production');
  }
  return new MemorySessionStore();
}

export function createIdempotencyStore(config: Config, redis: HelloRedisClient): IdempotencyStore {
  if (redis) {
    return new RedisIdempotencyStore(redis);
  }
  if (config.NODE_ENV === 'staging' || config.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required for idempotency in staging and production');
  }
  return new MemoryIdempotencyStore();
}
