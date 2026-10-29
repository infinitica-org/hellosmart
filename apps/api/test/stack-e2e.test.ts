import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LoginLockoutService } from '../src/modules/auth/login-lockout.service.js';
import { SessionService } from '../src/modules/session/session.service.js';
import {
  completePlatformAdminLogin,
  createStackTestApp,
  DEV_PASSWORD,
  isStackInfraReady,
  loginWithPassword,
  SEED,
  setUserPassword,
} from './stack-e2e.harness.js';

const stackReady = await isStackInfraReady();

describe.runIf(stackReady).sequential('S0 stack E2E (auth + admin orgs)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createStackTestApp();
    const lockout = app.get(LoginLockoutService);
    await lockout.clearFailures(SEED.platformAdminEmail);
    await lockout.clearFailures(SEED.companyAdminEmail);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('test(CO-001): company admin login, /me, logout lifecycle', async () => {
    const login = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    expect(login.statusCode, JSON.stringify(login.body)).toBe(200);
    expect(login.body.portal).toBe('company');
    expect(login.sessionCookie).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
    });
    expect(me.statusCode).toBe(200);
    const profile = me.json() as { email: string; role: string };
    expect(profile.email).toBe(SEED.companyAdminEmail);
    expect(profile.role).toBe('company_admin');

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
    });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  it('test(CO-001): invalid credentials return 401 without leaking account state', async () => {
    const res = await loginWithPassword(app, SEED.companyAdminEmail, 'not-the-password');
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(String(res.body.detail)).toMatch(/invalid email or password/i);
  });

  it('test(CO-001): unknown email returns 401', async () => {
    const res = await loginWithPassword(
      app,
      `nobody-${crypto.randomUUID()}@example.test`,
      DEV_PASSWORD,
    );
    expect(res.statusCode).toBe(401);
  });

  it('test(AD-001): platform admin requires MFA then reaches admin portal', async () => {
    const first = await loginWithPassword(app, SEED.platformAdminEmail, DEV_PASSWORD);
    expect(first.statusCode).toBe(200);
    expect(first.body.mfaRequired).toBe(true);
    expect(typeof first.body.preAuthToken).toBe('string');
    expect(first.sessionCookie).toBeUndefined();

    const cookie = await completePlatformAdminLogin(app);
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: cookie },
    });
    expect(me.statusCode).toBe(200);
    const profile = me.json() as { portal: string; role: string };
    expect(profile.portal).toBe('admin');
    expect(profile.role).toBe('platform_admin');
  });

  it('test(AD-001): invalid MFA code returns 401', async () => {
    const first = await loginWithPassword(app, SEED.platformAdminEmail, DEV_PASSWORD);
    expect(first.statusCode).toBe(200);
    expect(typeof first.body.preAuthToken).toBe('string');
    const preAuthToken = first.body.preAuthToken as string;
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { preAuthToken, totpCode: '000000' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('test(AD-001): password-only platform admin cannot reach admin routes', async () => {
    const first = await loginWithPassword(app, SEED.platformAdminEmail, DEV_PASSWORD);
    expect(first.statusCode).toBe(200);
    expect(first.body.mfaRequired).toBe(true);
    expect(first.sessionCookie).toBeUndefined();

    const adminAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      payload: {
        name: 'No MFA',
        slug: `no-mfa-${crypto.randomUUID().slice(0, 8)}`,
        adminEmail: 'no-mfa@example.test',
        adminName: 'No MFA',
      },
    });
    expect(adminAttempt.statusCode).toBe(401);
  });

  it('test(AD-001): three wrong MFA codes burn preAuthToken', async () => {
    const first = await loginWithPassword(app, SEED.platformAdminEmail, DEV_PASSWORD);
    expect(first.statusCode).toBe(200);
    const preAuthToken = first.body.preAuthToken as string;

    for (let i = 0; i < 2; i += 1) {
      const bad = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        payload: { preAuthToken, totpCode: '000000' },
      });
      expect(bad.statusCode).toBe(401);
      expect((bad.json() as { code: string }).code).toBe('MFA_INVALID');
    }

    const third = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { preAuthToken, totpCode: '000000' },
    });
    expect(third.statusCode).toBe(401);
    expect((third.json() as { code: string }).code).toBe('MFA_LOCKED');

    const afterBurn = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { preAuthToken, totpCode: '000000' },
    });
    expect(afterBurn.statusCode).toBe(401);
    expect((afterBurn.json() as { code: string }).code).toBe('PREAUTH_INVALID');
  });

  it.sequential('test(NF-006): login lockout after repeated failures', async () => {
    const email = `lockout-${crypto.randomUUID()}@example.test`;
    for (let i = 0; i < 5; i += 1) {
      const attempt = await loginWithPassword(app, email, 'wrong');
      expect(attempt.statusCode).toBe(401);
    }
    const locked = await loginWithPassword(app, email, 'wrong');
    expect(locked.statusCode).toBe(429);
    const body = locked.body as { code: string };
    expect(body.code).toBe('LOGIN_LOCKED');
  });

  it('test(BR-04): admin org provision, company login, suspend revokes sessions', async () => {
    const platformCookie = await completePlatformAdminLogin(app);
    const suffix = crypto.randomUUID().slice(0, 8);
    const adminEmail = `e2e-admin-${suffix}@example.test`;
    const slug = `e2e-org-${suffix}`;

    const provision = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      cookies: { [SessionService.cookieName()]: platformCookie },
      payload: {
        name: `E2E Org ${suffix}`,
        slug,
        adminEmail,
        adminName: 'E2E Admin',
      },
    });
    expect(provision.statusCode).toBe(201);
    const org = provision.json() as { id: string; slug: string; status: string };
    expect(org.slug).toBe(slug);
    expect(org.status).toBe('trial_active');

    const invitePassword = `Welcome-E2E-${suffix}`;
    await setUserPassword(adminEmail, invitePassword);

    const companyLogin = await loginWithPassword(app, adminEmail, invitePassword);
    expect(companyLogin.statusCode).toBe(200);
    expect(companyLogin.sessionCookie).toBeTruthy();

    const suspend = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/organizations/${org.id}/status`,
      cookies: { [SessionService.cookieName()]: platformCookie },
      payload: { status: 'suspended', reason: 'E2E suspend test' },
    });
    expect(suspend.statusCode).toBe(200);

    const staleSession = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: companyLogin.sessionCookie! },
    });
    expect(staleSession.statusCode).toBe(401);

    const loginAfterSuspend = await loginWithPassword(app, adminEmail, invitePassword);
    expect(loginAfterSuspend.statusCode).toBe(403);
    const suspendedBody = loginAfterSuspend.body as { code: string };
    expect(suspendedBody.code).toBe('ORG_SUSPENDED');
  });

  it('test(BR-04): duplicate org slug returns 409', async () => {
    const platformCookie = await completePlatformAdminLogin(app);
    const slug = `dup-${crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      name: 'Dup Org',
      slug,
      adminEmail: `dup-a-${slug}@example.test`,
      adminName: 'Dup A',
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      cookies: { [SessionService.cookieName()]: platformCookie },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      cookies: { [SessionService.cookieName()]: platformCookie },
      payload: {
        ...payload,
        adminEmail: `dup-b-${slug}@example.test`,
        adminName: 'Dup B',
      },
    });
    expect(second.statusCode).toBe(409);
    const body = second.json() as { code: string };
    expect(body.code).toBe('ORG_SLUG_CONFLICT');
  });

  it('test(BR-25): unauthenticated admin routes return 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/organizations',
      payload: {
        name: 'No Auth',
        adminEmail: 'noauth@example.test',
        adminName: 'No Auth',
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
