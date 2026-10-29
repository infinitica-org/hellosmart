import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { UserContext } from '../src/common/types/user-context.js';
import { MemorySessionStore } from '../src/modules/session/memory-session.store.js';
import {
  hashToken,
  SessionService,
} from '../src/modules/session/session.service.js';
import { ROLE_SESSION_LIMITS } from '../src/modules/session/session.types.js';

describe('S0-T16-1: Session Lifecycle & Timeouts', () => {
  const platformAdmin: UserContext = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'superadmin@hellosmart.ai',
    role: 'platform_admin',
    orgId: null,
  };

  const companyAdmin: UserContext = {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'admin@acme.corp',
    role: 'company_admin',
    orgId: '33333333-3333-4333-8333-333333333333',
  };

  it('generates 32-byte (64 hex char) raw token, separate UUIDv4 sessionId, and never stores raw token in key or value', async () => {
    const store = new MemorySessionStore();
    const service = new SessionService(store);

    const { rawToken, sessionId, record } = await service.createSession(companyAdmin, {
      ip: '192.168.1.50',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });

    // 1. Raw token length: 32 bytes = 64 hex characters
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    // 2. Public sessionId is standard UUIDv4
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(sessionId).not.toBe(rawToken);

    // 3. Storage key must be sha256(rawToken)
    const expectedHash = hashToken(rawToken);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);

    const storedDirect = await store.get(expectedHash);
    expect(storedDirect).not.toBeNull();
    expect(storedDirect?.id).toBe(sessionId);
    expect(storedDirect?.sessionId).toBe(sessionId);

    // Ensure rawToken was never stored as a key
    const rawLookup = await store.get(rawToken);
    expect(rawLookup).toBeNull();

    // Ensure rawToken is not serialized in stored record
    expect((storedDirect as any).rawToken).toBeUndefined();
  });

  describe('Idle & Absolute Timeouts', () => {
    it('enforces platform_admin 15-minute idle timeout', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      const { rawToken } = await service.createSession(platformAdmin);

      // Active at 14 minutes
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000);
      const active = await service.resolveSession(rawToken);
      expect(active).not.toBeNull();

      // Expired at 16 minutes without activity
      vi.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000 + 16 * 60 * 1000);
      const expired = await service.resolveSession(rawToken);
      expect(expired).toBeNull();

      vi.restoreAllMocks();
    });

    it('enforces standard user 30-minute idle timeout', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      const { rawToken } = await service.createSession(companyAdmin);

      // Active at 25 minutes
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 1000);
      const active = await service.resolveSession(rawToken);
      expect(active).not.toBeNull();

      // Expired at 31 minutes without activity
      vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 1000 + 31 * 60 * 1000);
      const expired = await service.resolveSession(rawToken);
      expect(expired).toBeNull();

      vi.restoreAllMocks();
    });

    it('enforces platform_admin 8-hour absolute lifetime regardless of activity', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      const { rawToken } = await service.createSession(platformAdmin);
      const startTime = Date.now();

      // Continual activity every 10 minutes until 7h 50m
      for (let m = 10; m <= 470; m += 10) {
        vi.spyOn(Date, 'now').mockReturnValue(startTime + m * 60 * 1000);
        const resolved = await service.resolveSession(rawToken);
        expect(resolved).not.toBeNull();
      }

      // At 8 hours + 1 minute (481 minutes), session MUST expire despite recent activity at 470m
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 481 * 60 * 1000);
      const expired = await service.resolveSession(rawToken);
      expect(expired).toBeNull();

      vi.restoreAllMocks();
    });

    it('enforces standard user 12-hour absolute lifetime regardless of activity', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      const { rawToken } = await service.createSession(companyAdmin);
      const startTime = Date.now();

      // Periodic activity every 20 minutes up to 11 hours 40 minutes (700 minutes)
      for (let m = 20; m <= 700; m += 20) {
        vi.spyOn(Date, 'now').mockReturnValue(startTime + m * 60 * 1000);
        const active = await service.resolveSession(rawToken);
        expect(active).not.toBeNull();
      }

      // Expired at 12 hours + 1 minute (721 minutes) despite activity at 700m
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 721 * 60 * 1000);
      const expired = await service.resolveSession(rawToken);
      expect(expired).toBeNull();

      vi.restoreAllMocks();
    });

    it('throttles sliding idle refresh writes to at most once per minute (60s)', async () => {
      const store = new MemorySessionStore();
      const setSpy = vi.spyOn(store, 'set');
      const service = new SessionService(store);

      const { rawToken } = await service.createSession(companyAdmin);
      const startTime = Date.now();

      // Access at +30s: within 60s throttle window, should not call store.set
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 30 * 1000);
      setSpy.mockClear();
      const s1 = await service.resolveSession(rawToken);
      expect(s1).not.toBeNull();
      expect(setSpy).not.toHaveBeenCalled();

      // Access at +65s: exceeds 60s throttle window, updates lastSeenAt and calls store.set
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 65 * 1000);
      const s2 = await service.resolveSession(rawToken);
      expect(s2).not.toBeNull();
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(s2?.lastSeenAt).toBe(startTime + 65 * 1000);

      vi.restoreAllMocks();
    });
  });

  describe('Concurrency Caps & Eviction', () => {
    it('caps platform_admin at 2 concurrent sessions and evicts oldest', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      // Session 1
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const s1 = await service.createSession(platformAdmin);

      // Session 2 (+100ms)
      vi.spyOn(Date, 'now').mockReturnValue(now + 100);
      const s2 = await service.createSession(platformAdmin);

      // Both s1 and s2 should be active
      expect(await service.resolveSession(s1.rawToken)).not.toBeNull();
      expect(await service.resolveSession(s2.rawToken)).not.toBeNull();

      // Session 3 (+200ms) -> triggers eviction of oldest (s1)
      vi.spyOn(Date, 'now').mockReturnValue(now + 200);
      const s3 = await service.createSession(platformAdmin);

      // s1 must now be evicted
      expect(await service.resolveSession(s1.rawToken)).toBeNull();

      // s2 and s3 must remain active
      expect(await service.resolveSession(s2.rawToken)).not.toBeNull();
      expect(await service.resolveSession(s3.rawToken)).not.toBeNull();

      vi.restoreAllMocks();
    });

    it('caps company_admin at 5 concurrent sessions and evicts oldest', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      const sessions: Array<{ rawToken: string; sessionId: string }> = [];
      const startTime = Date.now();

      // Create 5 sessions
      for (let i = 0; i < 5; i++) {
        vi.spyOn(Date, 'now').mockReturnValue(startTime + i * 100);
        sessions.push(await service.createSession(companyAdmin));
      }

      // Verify all 5 are active
      for (const s of sessions) {
        expect(await service.resolveSession(s.rawToken)).not.toBeNull();
      }

      // Create 6th session -> evicts session 0 (oldest)
      vi.spyOn(Date, 'now').mockReturnValue(startTime + 600);
      const s6 = await service.createSession(companyAdmin);

      // Session 0 evicted
      expect(await service.resolveSession(sessions[0]!.rawToken)).toBeNull();

      // Sessions 1-4 and session 6 remain active (total 5)
      for (let i = 1; i < 5; i++) {
        expect(await service.resolveSession(sessions[i]!.rawToken)).not.toBeNull();
      }
      expect(await service.resolveSession(s6.rawToken)).not.toBeNull();

      vi.restoreAllMocks();
    });

    it('serializes parallel logins and maintains strict concurrency limits', async () => {
      const store = new MemorySessionStore();
      const service = new SessionService(store);

      // Launch 5 parallel logins for platform_admin (cap is 2)
      const results = await Promise.all([
        service.createSession(platformAdmin),
        service.createSession(platformAdmin),
        service.createSession(platformAdmin),
        service.createSession(platformAdmin),
        service.createSession(platformAdmin),
      ]);

      // Count how many are active right now
      const activeStatuses = await Promise.all(
        results.map((s) => service.resolveSession(s.rawToken)),
      );
      const activeCount = activeStatuses.filter((s) => s !== null).length;

      // Must strictly not exceed maxConcurrentSessions (2 for platform_admin)
      expect(activeCount).toBeLessThanOrEqual(ROLE_SESSION_LIMITS.platform_admin.maxConcurrentSessions);
    });
  });
});
