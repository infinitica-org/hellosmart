import { describe, expect, it, vi } from 'vitest';
import type { RedisLike } from '../src/modules/redis/redis.tokens.js';
import { RedisSessionStore } from '../src/modules/session/redis-session.store.js';
import type { SessionRecord } from '../src/modules/session/session.types.js';

describe('S0-T16-1: RedisSessionStore Atomic Lua Concurrency', () => {
  const dummySession: SessionRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    sessionId: '11111111-1111-4111-8111-111111111111',
    user: {
      userId: 'user-1',
      email: 'user1@test.org',
      role: 'company_admin',
      orgId: 'org-1',
    },
    userId: 'user-1',
    orgId: 'org-1',
    role: 'company_admin',
    email: 'user1@test.org',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    absoluteExpiresAt: Date.now() + 3600000,
    mfaVerified: false,
  };

  it('calls redis.eval with Lua script and returns evicted records', async () => {
    const mockRedis: Partial<RedisLike> = {
      eval: vi.fn().mockResolvedValue(
        JSON.stringify([
          JSON.stringify({
            ...dummySession,
            id: 'evicted-session-id',
            sessionId: 'evicted-session-id',
          }),
        ]),
      ),
    };

    const store = new RedisSessionStore(mockRedis as RedisLike);
    const result = await store.registerAndEnforceCap('user-1', 'new-token-hash', dummySession, 5, 1800);

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    expect(result.evictedRecords.length).toBe(1);
    expect(result.evictedRecords[0]?.sessionId).toBe('evicted-session-id');
  });

  it('fails closed when Redis eval throws an error', async () => {
    const mockRedis: Partial<RedisLike> = {
      eval: vi.fn().mockRejectedValue(new Error('NOSCRIPT No matching script. Please use EVAL.')),
    };

    const store = new RedisSessionStore(mockRedis as RedisLike);

    await expect(
      store.registerAndEnforceCap('user-1', 'new-token-hash', dummySession, 5, 1800),
    ).rejects.toThrowError('NOSCRIPT No matching script. Please use EVAL.');
  });
});
