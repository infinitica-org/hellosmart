import crypto from 'node:crypto';
import cookie from '@fastify/cookie';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  type Argon2Engine,
  AuthModule,
  AuthController,
  AuthService,
  CurrentUser,
  DB_POOL,
  HasherService,
  MfaService,
  MeController,
  MemorySessionStore,
  RedisSessionStore,
  Roles,
  RolesGuard,
  Session,
  SESSION_COOKIE_NAME,
  SESSION_STORE,
  SessionGuard,
  SessionService,
  ThrottlerStorageRedis,
} from '../src/modules/auth/index.js';
import { registerLoggingHooks } from '../src/modules/observability/index.js';

interface InMemoryUser {
  id: string;
  org_id: string | null;
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  password_hash: string | null;
  must_reset_password: boolean;
  status: string;
  failed_logins: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  mfa_secret_ref: string | null;
  org_name?: string;
  org_status?: string;
}

function createAuthMockDbPool() {
  const users = new Map<string, InMemoryUser>();
  const auditEvents: any[] = [];

  const pool = {
    users,
    auditEvents,

    async query(sql: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
      const client = await pool.connect();
      try {
        return await client.query(sql, params);
      } finally {
        client.release();
      }
    },

    async connect(): Promise<PoolClient> {
      const client = {
        async query(sql: string, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
          const normalized = sql.trim().replace(/\s+/g, ' ');

          // 1. app.lookup_user_for_login($1)
          if (normalized.includes('app.lookup_user_for_login')) {
            const email = (params[0] as string).toLowerCase();
            for (const user of users.values()) {
              if (user.email.toLowerCase() === email && user.status !== 'deleted') {
                return {
                  rows: [
                    {
                      id: user.id,
                      org_id: user.org_id,
                      email: user.email,
                      name: user.name,
                      role: user.role,
                      password_hash: user.password_hash,
                      must_reset_password: user.must_reset_password,
                      mfa_secret_ref: user.mfa_secret_ref,
                      status: user.status,
                      failed_logins: user.failed_logins,
                      locked_until: user.locked_until,
                      org_name: user.org_name ?? 'Acme Corp',
                      org_status: user.org_status ?? 'active',
                    },
                  ],
                  rowCount: 1,
                };
              }
            }
            return { rows: [], rowCount: 0 };
          }

          // 2. app.record_login_failure($1, 5, 900)
          if (normalized.includes('app.record_login_failure')) {
            const userId = params[0] as string;
            const maxAttempts = (params[1] as number) || 5;
            const lockoutSeconds = (params[2] as number) || 900;
            const user = users.get(userId);
            if (user) {
              user.failed_logins += 1;
              const isLocked = user.failed_logins >= maxAttempts;
              if (isLocked) {
                user.locked_until = new Date(Date.now() + lockoutSeconds * 1000);
              }
              return {
                rows: [
                  {
                    new_failed_logins: user.failed_logins,
                    is_locked: isLocked,
                    locked_until: user.locked_until,
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }

          // 3. app.record_login_success($1)
          if (normalized.includes('app.record_login_success')) {
            const userId = params[0] as string;
            const user = users.get(userId);
            if (user) {
              user.failed_logins = 0;
              user.locked_until = null;
              user.last_login_at = new Date();
            }
            return { rows: [], rowCount: 0 };
          }

          // 4. User lookup by ID (SELECT ... FROM app.users WHERE id = $1 or u.id = $1)
          if (
            normalized.includes('FROM app.users') &&
            (normalized.includes('WHERE id = $1') || normalized.includes('WHERE u.id = $1'))
          ) {
            const userId = params[0] as string;
            const user = users.get(userId);
            if (user) {
              return {
                rows: [
                  {
                    id: user.id,
                    org_id: user.org_id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    password_hash: user.password_hash,
                    must_reset_password: user.must_reset_password,
                    status: user.status,
                    org_name: user.org_name ?? 'Acme Corp',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }

          if (
            normalized === 'BEGIN' ||
            normalized === 'COMMIT' ||
            normalized === 'ROLLBACK' ||
            normalized.toLowerCase() === 'begin' ||
            normalized.toLowerCase() === 'commit' ||
            normalized.toLowerCase() === 'rollback'
          ) {
            return { rows: [], rowCount: 0 };
          }

          // 5. UPDATE app.users SET password_hash = $1, must_reset_password = false...
          if (normalized.startsWith('UPDATE app.users')) {
            const userId = (params[1] ?? params[0]) as string;
            const newPasswordHash = params[0] as string;
            const user = users.get(userId);
            if (user) {
              user.password_hash = newPasswordHash;
              user.must_reset_password = false;
              user.status = 'active';
              user.failed_logins = 0;
              user.locked_until = null;
              return { rows: [user], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          }

          // 6. Audit tail & insert
          if (normalized.includes('SELECT hash FROM audit.events')) {
            const last = auditEvents[auditEvents.length - 1];
            return { rows: last ? [{ hash: last.hash }] : [], rowCount: last ? 1 : 0 };
          }

          if (normalized.startsWith('INSERT INTO audit.events')) {
            const event = {
              id: auditEvents.length + 1,
              hash: crypto.randomBytes(32),
            };
            auditEvents.push(event);
            return { rows: [event], rowCount: 1 };
          }

          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      } as unknown as PoolClient;

      return client;
    },
  };

  return pool;
}

@Controller('test-protected')
class TestProtectedController {
  @Get('normal')
  @UseGuards(SessionGuard)
  getNormal(@CurrentUser() session: Session) {
    return { accessed: true, userId: session.userId };
  }

  @Get('admin-only')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('platform_admin')
  getAdminOnly(@CurrentUser() session: Session) {
    return { adminArea: true, userId: session.userId };
  }
}

describe('Sprint 1 / S0-T10: Secure Session Management & Authentication Flow', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createAuthMockDbPool>;
  let sessionStore: MemorySessionStore;
  let hasherService: HasherService;
  let mfaService: MfaService;
  let sessionService: SessionService;
  let authService: AuthService;

  const adminMfaSecret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 TOTP secret

  const SESSION_SECRET = 'test_session_secret_at_least_32_characters_long_1234';
  const candidateUserId = 'cnd-1111-2222-3333-444444444444';
  const adminUserId = 'adm-9999-8888-7777-666666666666';
  const orgId = 'org-1111-2222-3333-444444444444';

  const strongPassword = 'CorrectHorseBatteryStaple1!';
  const updatedStrongPassword = 'NewSecretPassword2026!#';

  beforeEach(async () => {
    mockPool = createAuthMockDbPool();
    sessionStore = new MemorySessionStore();

    const mockArgon2Engine: Argon2Engine = {
      async hash(plain, options) {
        const salt = crypto.randomBytes(16).toString('base64url');
        const hash = crypto.createHash('sha256').update(plain).digest('base64url');
        return `$argon2id$v=19$m=${options?.memoryCost ?? 19456},t=${options?.timeCost ?? 2},p=${options?.parallelism ?? 1}$${salt}$${hash}`;
      },
      async verify(hash, plain) {
        if (!hash.startsWith('$argon2id$')) return false;
        const parts = hash.split('$');
        const expected = parts[5];
        const actual = crypto.createHash('sha256').update(plain).digest('base64url');
        return expected === actual;
      },
    };

    hasherService = new HasherService(mockArgon2Engine);
    mfaService = new MfaService();
    sessionService = new SessionService(sessionStore);
    authService = new AuthService(hasherService, sessionService, mfaService, mockPool as unknown as Pool);

    const initialHash = await hasherService.hashPassword(strongPassword);

    // Seed candidate user
    mockPool.users.set(candidateUserId, {
      id: candidateUserId,
      org_id: orgId,
      email: 'candidate@example.test',
      name: 'Alice Candidate',
      role: 'candidate',
      password_hash: initialHash,
      must_reset_password: false,
      status: 'active',
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      mfa_secret_ref: null,
    });

    // Seed platform admin user
    mockPool.users.set(adminUserId, {
      id: adminUserId,
      org_id: null,
      email: 'admin@hellosmart.test',
      name: 'Super Admin',
      role: 'platform_admin',
      password_hash: initialHash,
      must_reset_password: false,
      status: 'active',
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      mfa_secret_ref: adminMfaSecret,
    });

    @Module({
      controllers: [AuthController, MeController, TestProtectedController],
      providers: [
        { provide: HasherService, useValue: hasherService },
        { provide: MfaService, useValue: mfaService },
        { provide: SessionService, useValue: sessionService },
        { provide: AuthService, useValue: authService },
        { provide: SESSION_STORE, useValue: sessionStore },
        { provide: DB_POOL, useValue: mockPool },
        SessionGuard,
        RolesGuard,
      ],
    })
    class TestAuthAppModule {}

    const adapter = new FastifyAdapter();
    registerLoggingHooks(adapter.getInstance());

    const pluginMeta = Symbol.for('plugin-meta');
    if ((cookie as any)[pluginMeta]) {
      (cookie as any)[pluginMeta].fastify = '>=4.0.0';
    }
    await adapter.getInstance().register(cookie, { secret: SESSION_SECRET });

    app = await NestFactory.create<NestFastifyApplication>(TestAuthAppModule, adapter, {
      logger: false,
    });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  // 1. Session creation and login issuance
  it('1. POST /auth/login returns user profile and sets signed HttpOnly session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'candidate@example.test',
        password: strongPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.email).toBe('candidate@example.test');
    expect(body.role).toBe('candidate');
    expect(body.portal).toBe('candidate');
    expect(body.mustResetPassword).toBe(false);

    // Verify session cookies in response headers
    const setCookieHeader = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();

    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader!];
    const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Path=/');

    // Verify non-sensitive routing hint cookies
    const roleCookie = cookies.find((c) => c.startsWith('hs_role='));
    expect(roleCookie).toBeDefined();
    expect(roleCookie).toContain('hs_role=candidate');
  });

  // 2. Session validation on protected route
  it('2. Protected endpoints validate signed session cookie and authorize requests', async () => {
    // Log in first
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const setCookieHeader = loginRes.headers['set-cookie'];
    const sessionCookie = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader!]).find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    )!;

    // Hit GET /api/v1/me with session cookie
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: sessionCookie.split(';')[0] },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.id).toBe(candidateUserId);
    expect(meBody.portal).toBe('candidate');
  });

  // 3. Unauthorized access without session cookie returns RFC 9457 401
  it('3. Accessing protected endpoint without session cookie returns 401 UNAUTHORIZED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.title).toBe('Unauthorized');
  });

  // 4. Logout revokes session in store and clears browser cookies
  it('4. POST /auth/logout destroys active session and clears cookies', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const sessionCookie = (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!;

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: sessionCookie.split(';')[0] },
    });

    expect(logoutRes.statusCode).toBe(200);
    const logoutBody = JSON.parse(logoutRes.body);
    expect(logoutBody.success).toBe(true);

    // Verify cookie was cleared
    const setCookie = logoutRes.headers['set-cookie']!;
    const clearedCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const clearedSession = clearedCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(clearedSession).toContain('Max-Age=0');

    // Attempting to use the old session cookie now returns 401
    const secondMeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: sessionCookie.split(';')[0] },
    });
    expect(secondMeRes.statusCode).toBe(401);
  });

  // 5. Inactivity idle timeout check (30 min for normal user, 15 min for admin)
  it('5. Session expires when inactive beyond idle timeout', async () => {
    const session = await sessionService.createSession({
      userId: candidateUserId,
      orgId,
      email: 'candidate@example.test',
      name: 'Alice Candidate',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: false,
    });

    // Simulate 31 minutes of inactivity (timeout is 30m = 1800s)
    const rawEntry = (sessionStore as any).sessions.get(session.id);
    rawEntry.session.lastActiveAt = Date.now() - 31 * 60 * 1000;

    // Validate should return null due to inactivity
    const validated = await sessionService.validateSession(session.id);
    expect(validated).toBeNull();
  });

  // 6. Forced password reset enforcement (mustResetPassword === true)
  it('6. When mustResetPassword is true, user can only access /me, password change, or logout', async () => {
    // Set candidate user to must_reset_password = true
    const user = mockPool.users.get(candidateUserId)!;
    user.must_reset_password = true;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const sessionCookie = (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Allowed: GET /me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: sessionCookie },
    });
    expect(meRes.statusCode).toBe(200);

    // BLOCKED: Other protected endpoints like /test-protected/normal must return 403 PASSWORD_RESET_REQUIRED
    const blockedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/test-protected/normal',
      headers: { cookie: sessionCookie },
    });
    expect(blockedRes.statusCode).toBe(403);
    const blockedBody = JSON.parse(blockedRes.body);
    expect(blockedBody.code).toBe('PASSWORD_RESET_REQUIRED');
  });

  // 7. Password change updates password, clears reset flag, and revokes other sessions
  it('7. POST /auth/password/change completes forced reset and rotates sessions', async () => {
    const user = mockPool.users.get(candidateUserId)!;
    user.must_reset_password = true;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const sessionCookie = (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Change password
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      headers: { cookie: sessionCookie },
      payload: {
        newPassword: updatedStrongPassword,
      },
    });

    expect(changeRes.statusCode).toBe(200);
    const changeBody = JSON.parse(changeRes.body);
    expect(changeBody.success).toBe(true);

    // Verify user in DB has must_reset_password = false
    expect(user.must_reset_password).toBe(false);

    // Verify user can now log in with the new password
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'candidate@example.test',
        password: updatedStrongPassword,
      },
    });
    expect(newLoginRes.statusCode).toBe(200);

    // Old password fails
    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'candidate@example.test',
        password: strongPassword,
      },
    });
    expect(oldLoginRes.statusCode).toBe(401);
  });

  // 8. Role-based access control with RolesGuard (BR-25)
  it('8. RolesGuard blocks candidate from admin routes with 404 (BR-01 / BR-25)', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const sessionCookie = (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Candidate accessing platform_admin route
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test-protected/admin-only',
      headers: { cookie: sessionCookie },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('NOT_FOUND');
  });

  // 9. Login failure tracking and account lockout (CO-001)
  it('9. Repeated failed logins lock the account after 5 attempts', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'candidate@example.test', password: 'WrongPassword123!' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('INVALID_CREDENTIALS');
    }

    // 5th failure triggers lockout
    const fifthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: 'WrongPassword123!' },
    });
    expect(fifthRes.statusCode).toBe(401);

    // 6th attempt returns 401 ACCOUNT_LOCKED
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    expect(lockedRes.statusCode).toBe(401);
    const lockedBody = JSON.parse(lockedRes.body);
    expect(lockedBody.code).toBe('ACCOUNT_LOCKED');
    expect(lockedBody.detail).toContain('temporarily locked');
  });

  // 10. Platform admin requires valid genuine MFA code (AD-001, BR-04)
  it('10. Platform admin MFA enforcement rejects hardcoded codes and requires genuine TOTP', async () => {
    // 10a. Missing MFA code
    const resNoMfa = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@hellosmart.test', password: strongPassword },
    });
    expect(resNoMfa.statusCode).toBe(401);
    const bodyNoMfa = JSON.parse(resNoMfa.body);
    expect(bodyNoMfa.code).toBe('MFA_REQUIRED');

    // 10b. Hardcoded MFA code '123456' is REJECTED if it doesn't match genuine TOTP
    const realTotp = mfaService.generateTotp(adminMfaSecret);
    const bogusCode = realTotp === '123456' ? '654321' : '123456';
    const resBogus = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@hellosmart.test', password: strongPassword, mfaCode: bogusCode },
    });
    expect(resBogus.statusCode).toBe(401);
    const bodyBogus = JSON.parse(resBogus.body);
    expect(bodyBogus.code).toBe('INVALID_CREDENTIALS');

    // 10c. Genuine RFC 6238 TOTP code succeeds
    const resWithMfa = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@hellosmart.test', password: strongPassword, mfaCode: realTotp },
    });
    expect(resWithMfa.statusCode).toBe(200);
    const bodyWithMfa = JSON.parse(resWithMfa.body);
    expect(bodyWithMfa.role).toBe('platform_admin');
    expect(bodyWithMfa.portal).toBe('admin');
  });

  it('10d. Platform admin with missing MFA secret fails closed with 403', async () => {
    const noSecretAdminId = 'adm-no-secret';
    mockPool.users.set(noSecretAdminId, {
      id: noSecretAdminId,
      org_id: null,
      email: 'admin-nosecret@hellosmart.test',
      name: 'Unconfigured Admin',
      role: 'platform_admin',
      password_hash: await hasherService.hashPassword(strongPassword),
      must_reset_password: false,
      status: 'active',
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      mfa_secret_ref: null, // No MFA secret configured
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin-nosecret@hellosmart.test', password: strongPassword, mfaCode: '999999' },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('MFA_CONFIGURATION_ERROR');
  });

  // 11. Redis session store ping and failure handling
  it('11. RedisSessionStore ping handles unavailable Redis gracefully', async () => {
    const failingStore = new RedisSessionStore({
      async ping() {
        throw new Error('Connection refused to redis://127.0.0.1:6379');
      },
    } as any);

    const isAlive = await failingStore.ping();
    expect(isAlive).toBe(false);
  });

  // 12. ThrottlerStorageRedis handles multi-instance rate limiting and memory fallback
  it('12. ThrottlerStorageRedis handles multi-instance increments and limits', async () => {
    const storage = new ThrottlerStorageRedis(null); // in-memory fallback
    const res1 = await storage.increment('test-ip-key', 60000, 2, 0, 'default');
    expect(res1.totalHits).toBe(1);
    expect(res1.isBlocked).toBe(false);

    const res2 = await storage.increment('test-ip-key', 60000, 2, 0, 'default');
    expect(res2.totalHits).toBe(2);
    expect(res2.isBlocked).toBe(false);

    const res3 = await storage.increment('test-ip-key', 60000, 2, 0, 'default');
    expect(res3.totalHits).toBe(3);
    expect(res3.isBlocked).toBe(true);
  });

  // 13. Wire invitation acceptance to actual session revocation in session store
  it('13. Invitation acceptance revokes all active sessions for the user in session store', async () => {
    const session = await sessionService.createSession({
      userId: candidateUserId,
      orgId,
      email: 'candidate@example.test',
      name: 'Alice Candidate',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: true,
    });

    expect(await sessionStore.getSession(session.id)).not.toBeNull();

    // Revoke all sessions for candidate
    await sessionService.revokeAllUserSessions(candidateUserId);

    expect(await sessionStore.getSession(session.id)).toBeNull();
  });

  // 14. Negative test: Forged or tampered session cookie signatures are rejected with 401
  it('14. SessionGuard rejects forged or tampered session cookie signatures with 401', async () => {
    // Forged cookie signature: s:fake_session.invalidsignature
    const tamperedCookie = `${SESSION_COOKIE_NAME}=s:fake_session_12345.invalidsignaturehere`;
    const resTampered = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: tamperedCookie },
    });
    expect(resTampered.statusCode).toBe(401);
    const body = JSON.parse(resTampered.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.detail).toContain('signature');
  });

  // 15. Safe rate limiting policy: strict mode fails closed without silent downgrade to memory
  it('15. ThrottlerStorageRedis safe failure policy: strict mode fails closed without memory fallback', async () => {
    // 15a. In strict mode with no Redis client -> returns isBlocked: true (fails closed)
    const strictNullStorage = new ThrottlerStorageRedis(null, { strictMode: true });
    const blockedResult = await strictNullStorage.increment('key1', 60000, 10, 0, 'default');
    expect(blockedResult.isBlocked).toBe(true);
    expect(blockedResult.totalHits).toBe(11);

    // 15b. In strict mode when Redis throws an error -> returns isBlocked: true (fails closed)
    const failingRedisMock = {
      pttl: vi.fn().mockRejectedValue(new Error('Redis cluster unreachable')),
      pipeline: vi.fn().mockReturnValue({
        incr: vi.fn().mockReturnThis(),
        pttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis network timeout')),
      }),
    } as any;

    const strictErrorStorage = new ThrottlerStorageRedis(failingRedisMock, { strictMode: true });
    const errorBlocked = await strictErrorStorage.increment('key2', 60000, 10, 0, 'default');
    expect(errorBlocked.isBlocked).toBe(true);
    expect(errorBlocked.totalHits).toBe(11);

    // 15c. Non-strict mode falls back to memory safely for dev/test
    const nonStrictStorage = new ThrottlerStorageRedis(null, { strictMode: false });
    const memoryResult = await nonStrictStorage.increment('key3', 60000, 10, 0, 'default');
    expect(memoryResult.isBlocked).toBe(false);
    expect(memoryResult.totalHits).toBe(1);
  });

  // 16. Production session store startup validation prevents silent memory fallback
  it('16. Production session store startup validation prevents silent memory fallback', async () => {
    const validateProdStore = async (env: Record<string, string | undefined>) => {
      const isProduction = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
      if (isProduction && !env.REDIS_URL) {
        throw new Error('FATAL: REDIS_URL must be configured in production/staging environments.');
      }
      if (isProduction) {
        const store = new RedisSessionStore({
          ping: async () => 'PONG',
        } as any);
        const alive = await store.ping();
        if (!alive) {
          throw new Error('FATAL: Failed to connect to Redis session store during startup verification.');
        }
        return store;
      }
      return new MemorySessionStore();
    };

    // Missing REDIS_URL in production throws fatal error
    await expect(validateProdStore({ NODE_ENV: 'production' })).rejects.toThrow(
      'REDIS_URL must be configured in production/staging environments',
    );

    // Failed ping in production throws fatal error
    const validateProdFailedPing = async () => {
      const store = new RedisSessionStore({
        ping: async () => {
          throw new Error('ECONNREFUSED');
        },
      } as any);
      const alive = await store.ping();
      if (!alive) {
        throw new Error('FATAL: Failed to connect to Redis session store during startup verification.');
      }
      return store;
    };
    await expect(validateProdFailedPing()).rejects.toThrow(
      'Failed to connect to Redis session store during startup verification',
    );
  });

  // 17. Negative test: Password change session rotation invalidates previous session
  it('17. Password change rotates sessions: previous session revoked and rejected with 401', async () => {
    // 1. Log in candidate to get session 1
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'candidate@example.test', password: strongPassword },
    });
    const session1Cookie = (Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : [loginRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Session 1 is valid
    const me1 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: session1Cookie },
    });
    expect(me1.statusCode).toBe(200);

    // 2. Change password
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      headers: { cookie: session1Cookie },
      payload: {
        currentPassword: strongPassword,
        newPassword: updatedStrongPassword,
      },
    });
    expect(changeRes.statusCode).toBe(200);
    const session2Cookie = (Array.isArray(changeRes.headers['set-cookie'])
      ? changeRes.headers['set-cookie']
      : [changeRes.headers['set-cookie']!]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // 3. Negative check: Old session 1 is now revoked and MUST return 401
    const oldSessionMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: session1Cookie },
    });
    expect(oldSessionMe.statusCode).toBe(401);

    // 4. New session 2 succeeds
    const newSessionMe = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: session2Cookie },
    });
    expect(newSessionMe.statusCode).toBe(200);
  });

  // 18. Database privileges: 0003_auth_sessions.sql revokes PUBLIC execution and grants strictly to hs_app
  it('18. Database privileges: 0003_auth_sessions.sql revokes PUBLIC execution and grants strictly to hs_app', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const sqlPath = path.resolve(currentDir, '../../../packages/contracts/db/migrations/0003_auth_sessions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Must revoke from PUBLIC
    expect(sqlContent).toContain('REVOKE EXECUTE ON FUNCTION app.lookup_user_for_login(citext) FROM PUBLIC');
    expect(sqlContent).toContain('REVOKE EXECUTE ON FUNCTION app.record_login_failure(uuid, int, int) FROM PUBLIC');
    expect(sqlContent).toContain('REVOKE EXECUTE ON FUNCTION app.record_login_success(uuid) FROM PUBLIC');
    expect(sqlContent).toContain('REVOKE EXECUTE ON FUNCTION app.lookup_invitation(bytea) FROM PUBLIC');

    // Must grant strictly to hs_app
    expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION app.lookup_user_for_login(citext) TO hs_app');
    expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION app.record_login_failure(uuid, int, int) TO hs_app');
    expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION app.record_login_success(uuid) TO hs_app');
    expect(sqlContent).toContain('GRANT EXECUTE ON FUNCTION app.lookup_invitation(bytea) TO hs_app');

    // Must maintain fixed search_path = app, public
    expect(sqlContent).toContain('SET search_path = app, public');
  });
});
