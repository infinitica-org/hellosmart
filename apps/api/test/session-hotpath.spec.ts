import { describe, expect, it, vi } from 'vitest';
import type { RedisLike } from '../src/modules/redis/redis.tokens.js';
import { RedisSessionStore } from '../src/modules/session/redis-session.store.js';
import type { SessionRecord } from '../src/modules/session/session.types.js';

function sample(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now();
  return {
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
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 3600000,
    mfaVerified: false,
    ...overrides,
  };
}

describe('RedisSessionStore hot path', () => {
  it('lists user sessions with mGet rather than per-hash GET', async () => {
    const rec = sample();
    const mGet = vi.fn().mockResolvedValue([JSON.stringify(rec)]);
    const redis: Partial<RedisLike> = {
      sMembers: vi.fn().mockResolvedValue(['hash-a']),
      mGet,
      get: vi.fn(),
      del: vi.fn(),
      sRem: vi.fn(),
    };
    const store = new RedisSessionStore(redis as RedisLike);
    const sessions = await store.getUserSessions('user-1');
    expect(mGet).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe('hash-a');
  });
});
