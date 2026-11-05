import { describe, expect, it } from 'vitest';
import { RedisThrottlerStorage } from '../src/modules/redis/redis-throttler.storage.js';
import type { RedisLike } from '../src/modules/redis/redis.tokens.js';

function memoryRedis(): RedisLike & { store: Map<string, { value: number; exp: number }> } {
  const store = new Map<string, { value: number; exp: number }>();
  const client = {
    store,
    isOpen: true,
    async get() {
      return null;
    },
    async set() {
      return 'OK';
    },
    async del() {
      return 1;
    },
    async incr(key: string) {
      const cur = store.get(key) ?? { value: 0, exp: Date.now() + 60_000 };
      cur.value += 1;
      store.set(key, cur);
      return cur.value;
    },
    async sAdd() {
      return 1;
    },
    async sMembers() {
      return [];
    },
    async sRem() {
      return 1;
    },
    async expire(key: string, seconds: number) {
      const cur = store.get(key);
      if (cur) cur.exp = Date.now() + seconds * 1000;
      return true;
    },
    async mGet(keys: string[]) {
      return keys.map((key) => {
        const cur = store.get(key);
        return cur ? String(cur.value) : null;
      });
    },
    async eval() {
      return 0;
    },
    async ping() {
      return 'PONG';
    },
    async quit() {
      return 'OK';
    },
  };
  return client as RedisLike & { store: Map<string, { value: number; exp: number }> };
}

describe('RedisThrottlerStorage', () => {
  it('shares hit counts across two storage instances on one Redis', async () => {
    const redis = memoryRedis();
    const a = new RedisThrottlerStorage(redis);
    const b = new RedisThrottlerStorage(redis);
    await a.increment('login:1', 60_000, 5, 0, 'login');
    await a.increment('login:1', 60_000, 5, 0, 'login');
    const third = await b.increment('login:1', 60_000, 5, 0, 'login');
    expect(third.totalHits).toBe(3);
  });

  it('uses in-memory counters when Redis is null', async () => {
    const storage = new RedisThrottlerStorage(null);
    const first = await storage.increment('ip:1', 60_000, 2, 0, 'default');
    const second = await storage.increment('ip:1', 60_000, 2, 0, 'default');
    const third = await storage.increment('ip:1', 60_000, 2, 0, 'default');
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(third.isBlocked).toBe(true);
  });
});
