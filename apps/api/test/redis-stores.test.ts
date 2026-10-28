import { createClient } from 'redis';
import type { RedisLike } from '../src/modules/redis/redis.tokens.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisIdempotencyStore, RedisSessionStore } from '../src/modules/session/redis-session.store.js';

const redisUrl = process.env.REDIS_URL;

describe.runIf(Boolean(redisUrl))('@hs/api redis stores (integration)', () => {
  let redis: RedisLike;

  beforeAll(async () => {
    const client = createClient({ url: redisUrl });
    await client.connect();
    redis = client as RedisLike;
  });

  afterAll(async () => {
    if (redis?.isOpen) {
      await redis.quit();
    }
  });

  it('persists session with TTL', async () => {
    const store = new RedisSessionStore(redis);
    const sessionId = `test_${crypto.randomUUID()}`;
    await store.set(
      sessionId,
      {
        id: sessionId,
        user: {
          userId: '11111111-1111-4111-8111-111111111111',
          email: 'test@example.test',
          role: 'company_admin',
          orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
        },
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
      },
      60,
    );
    const loaded = await store.get(sessionId);
    expect(loaded?.user.email).toBe('test@example.test');
    await store.delete(sessionId);
  });

  it('persists idempotency payload with TTL', async () => {
    const store = new RedisIdempotencyStore(redis);
    const key = `test_${crypto.randomUUID()}`;
    await store.set(
      key,
      {
        statusCode: 200,
        body: '{"ok":true}',
        contentType: 'application/json',
        expiresAt: Date.now() + 60_000,
      },
      60,
    );
    const loaded = await store.get(key);
    expect(loaded?.body).toBe('{"ok":true}');
    await redis.del(`hs:idem:${key}`);
  });
});
