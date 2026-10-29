import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { SessionService } from '../src/modules/session/session.service.js';

describe('S0-T16-1: Sessions API Integration', () => {
  let app: NestFastifyApplication;
  let sessionService: SessionService;

  const userA = {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'usera@example.test',
    role: 'company_admin' as const,
    orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
  };

  const userB = {
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'userb@example.test',
    role: 'company_admin' as const,
    orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.register(cookie, { secret: 'test-session-secret-for-signing-cookies' });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    sessionService = app.get(SessionService);
    const db = app.get(DatabaseService);
    db.setStatusChecker(async () => ({
      userStatus: 'active',
      orgStatus: 'paid_active',
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/auth/sessions lists active sessions with masked IP and flags current session', async () => {
    // Create two sessions for User A
    const s1 = await sessionService.createSession(userA, {
      ip: '203.0.113.195',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });
    const s2 = await sessionService.createSession(userA, {
      ip: '198.51.100.42',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    });

    // Call GET /auth/sessions with s1's cookie
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: `hs_session=${s1.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('sessions');
    expect(Array.isArray(body.sessions)).toBe(true);

    const sessions = body.sessions;
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    // Verify current flag
    const currentSession = sessions.find((s: any) => s.sessionId === s1.sessionId);
    const otherSession = sessions.find((s: any) => s.sessionId === s2.sessionId);

    expect(currentSession).toBeDefined();
    expect(currentSession.current).toBe(true);
    expect(currentSession.ip).toBe('203.0.113.xxx'); // Masked IP
    expect(currentSession.device).toBe('Chrome on Windows');

    expect(otherSession).toBeDefined();
    expect(otherSession.current).toBe(false);
    expect(otherSession.ip).toBe('198.51.100.xxx');
    expect(otherSession.device).toBe('Safari on macOS');

    // Ensure raw tokens are NEVER present in API response
    expect(JSON.stringify(body)).not.toContain(s1.rawToken);
    expect(JSON.stringify(body)).not.toContain(s2.rawToken);
  });

  it('DELETE /api/v1/auth/sessions/:id revokes targeted session but preserves current session', async () => {
    const s1 = await sessionService.createSession(userA, {
      ip: '10.0.0.1',
      userAgent: 'curl/7.68.0',
    });
    const s2 = await sessionService.createSession(userA, {
      ip: '10.0.0.2',
      userAgent: 'curl/7.68.0',
    });

    // User A revokes s2 using s1
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${s2.sessionId}`,
      headers: {
        cookie: `hs_session=${s1.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      message: 'Session revoked successfully',
    });

    // s2 is now revoked
    const testS2 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: `hs_session=${s2.rawToken}`,
      },
    });
    expect(testS2.statusCode).toBe(401);

    // s1 remains valid
    const testS1 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: `hs_session=${s1.rawToken}`,
      },
    });
    expect(testS1.statusCode).toBe(200);
  });

  it('DELETE /api/v1/auth/sessions/:id revoking current session clears cookies', async () => {
    const s1 = await sessionService.createSession(userA);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${s1.sessionId}`,
      headers: {
        cookie: `hs_session=${s1.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    // Cookie is cleared
    const setCookie = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    expect(cookieHeader).toContain('hs_session=');

    // s1 is now revoked
    const check = await sessionService.resolveSession(s1.rawToken);
    expect(check).toBeNull();
  });

  it('DELETE /api/v1/auth/sessions/:id prevents cross-user session revocation (returns 404)', async () => {
    const sessionUserA = await sessionService.createSession(userA);
    const sessionUserB = await sessionService.createSession(userB);

    // User A attempts to revoke User B's session
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/auth/sessions/${sessionUserB.sessionId}`,
      headers: {
        cookie: `hs_session=${sessionUserA.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('SESSION_NOT_FOUND');

    // User B's session must still be active
    const checkB = await sessionService.resolveSession(sessionUserB.rawToken);
    expect(checkB).not.toBeNull();
  });

  it('POST /api/v1/auth/logout-all revokes all user sessions and clears cookie', async () => {
    const s1 = await sessionService.createSession(userA);
    const s2 = await sessionService.createSession(userA);
    const s3 = await sessionService.createSession(userA);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout-all',
      headers: {
        cookie: `hs_session=${s1.rawToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      message: 'All sessions logged out successfully',
    });

    // Check that cookies are cleared
    expect(res.headers['set-cookie']).toBeDefined();

    // All three sessions must now be revoked
    expect(await sessionService.resolveSession(s1.rawToken)).toBeNull();
    expect(await sessionService.resolveSession(s2.rawToken)).toBeNull();
    expect(await sessionService.resolveSession(s3.rawToken)).toBeNull();
  });
});
