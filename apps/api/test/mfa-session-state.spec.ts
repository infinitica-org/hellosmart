import cookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SessionService } from '../src/modules/session/session.service.js';

describe('S0-T16-1: MFA State & Session Creation Tracking (Item 2)', () => {
  let app: NestFastifyApplication;
  let authService: AuthService;
  let sessionService: SessionService;
  let db: DatabaseService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.register(cookie, { secret: 'test-secret-key-for-mfa-session-tests' });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    authService = app.get(AuthService);
    sessionService = app.get(SessionService);
    db = app.get(DatabaseService);

    db.setStatusChecker(async () => ({
      userStatus: 'active',
      orgStatus: 'paid_active',
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets mfaVerified: true when platform admin completes /auth/mfa/verify', async () => {
    const mockPlatformAdmin = {
      id: '11111111-1111-4111-8111-111111111111',
      orgId: null,
      email: 'platform.admin@hellosmart.ai',
      name: 'Platform Admin',
      role: 'platform_admin' as const,
      portal: 'admin' as const,
      mustResetPassword: false,
      org: null,
    };

    vi.spyOn(authService, 'verifyMfa').mockResolvedValueOnce(mockPlatformAdmin as any);
    vi.spyOn(authService, 'createSessionForUserId').mockImplementationOnce(
      async (userId, meta, options) => {
        expect(options?.mfaVerified).toBe(true);
        const { rawToken, sessionId, record } = await sessionService.createSession(
          {
            userId,
            email: mockPlatformAdmin.email,
            role: mockPlatformAdmin.role,
            orgId: null,
          },
          {
            ip: meta?.ip,
            userAgent: meta?.userAgent,
            mfaVerified: options?.mfaVerified,
          },
        );
        return { rawToken, sessionId, cookieMaxAgeSeconds: 8 * 60 * 60, me: mockPlatformAdmin as any };
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: {
        preAuthToken: 'valid-preauth-token-12345678901234567890',
        totpCode: '123456',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();

    vi.restoreAllMocks();
  });

  it('sets mfaVerified: true when platform admin provides valid inline mfaCode during /auth/login', async () => {
    const mockPlatformAdmin = {
      id: '11111111-1111-4111-8111-111111111111',
      orgId: null,
      email: 'platform.admin@hellosmart.ai',
      name: 'Platform Admin',
      role: 'platform_admin' as const,
      portal: 'admin' as const,
      mustResetPassword: false,
      org: null,
    };

    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      ...mockPlatformAdmin,
      mfaVerified: true,
    } as any);

    let capturedMfaVerified: boolean | undefined;
    vi.spyOn(authService, 'createSessionForUserId').mockImplementationOnce(
      async (userId, meta, options) => {
        capturedMfaVerified = options?.mfaVerified;
        return {
          rawToken: 'token',
          sessionId: 'session-id',
          cookieMaxAgeSeconds: 8 * 60 * 60,
          me: mockPlatformAdmin as any,
        };
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'platform.admin@hellosmart.ai',
        password: 'ValidPassword123!',
        mfaCode: '123456',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(capturedMfaVerified).toBe(true);

    vi.restoreAllMocks();
  });

  it('sets mfaVerified: false for standard password-only login', async () => {
    const mockCompanyAdmin = {
      id: '22222222-2222-4222-8222-222222222222',
      orgId: '03fa0961-c787-51dd-a4f6-d445495111c6',
      email: 'admin@acme.corp',
      name: 'Company Admin',
      role: 'company_admin' as const,
      portal: 'company' as const,
      mustResetPassword: false,
      org: {
        id: '03fa0961-c787-51dd-a4f6-d445495111c6',
        name: 'Acme Corp',
        logoUrl: null,
      },
    };

    vi.spyOn(authService, 'login').mockResolvedValueOnce(mockCompanyAdmin as any);

    let capturedMfaVerified: boolean | undefined;
    vi.spyOn(authService, 'createSessionForUserId').mockImplementationOnce(
      async (userId, meta, options) => {
        capturedMfaVerified = options?.mfaVerified;
        return {
          rawToken: 'token',
          sessionId: 'session-id',
          cookieMaxAgeSeconds: 12 * 60 * 60,
          me: mockCompanyAdmin as any,
        };
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@acme.corp',
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(capturedMfaVerified).toBe(false);

    vi.restoreAllMocks();
  });

  it('does NOT create a session when platform admin login requires MFA (returns preAuthToken)', async () => {
    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      mfaRequired: true,
      preAuthToken: 'preauth-token-unverified',
    });

    const createSessionSpy = vi.spyOn(authService, 'createSessionForUserId');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'platform.admin@hellosmart.ai',
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mfaRequired).toBe(true);
    expect(body.preAuthToken).toBe('preauth-token-unverified');

    // No session was created
    expect(createSessionSpy).not.toHaveBeenCalled();
    // No session cookie set
    expect(res.headers['set-cookie']).toBeUndefined();

    vi.restoreAllMocks();
  });

  it('rejects access when an unverified preAuthToken is sent as a session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/sessions',
      headers: {
        cookie: 'hs_session=preauth-token-unverified',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('SESSION_EXPIRED');
  });
});
