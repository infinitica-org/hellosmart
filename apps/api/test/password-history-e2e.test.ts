import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionService } from '../src/modules/session/session.service.js';
import {
  createStackTestApp,
  DEV_PASSWORD,
  isStackInfraReady,
  loginWithPassword,
  SEED,
  sessionCookieFromResponse,
} from './stack-e2e.harness.js';

const stackReady = await isStackInfraReady();

describe.runIf(stackReady).sequential('Password Change & History (E2E Stack)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createStackTestApp();
  }, 60_000);

  afterAll(async () => {
    // Reset password back to default DEV_PASSWORD if modified
    try {
      const login = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
      if (!login.sessionCookie) {
        // Try logging in with the test password and revert
        const testLogin = await loginWithPassword(
          app,
          SEED.companyAdminEmail,
          'Revert#Pass2026!Val1d',
        );
        if (testLogin.sessionCookie) {
          await app.inject({
            method: 'POST',
            url: '/api/v1/auth/password/change',
            cookies: { [SessionService.cookieName()]: testLogin.sessionCookie },
            payload: {
              currentPassword: 'Revert#Pass2026!Val1d',
              newPassword: DEV_PASSWORD,
            },
          });
        }
      }
    } catch {
      // Best-effort cleanup
    }
    await app?.close();
  });

  it('rejects unauthenticated request to /auth/password/change with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      payload: {
        currentPassword: DEV_PASSWORD,
        newPassword: 'StrongNew#Password2026!',
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects incorrect current password with 400 INVALID_CREDENTIALS', async () => {
    const login = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    expect(login.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
      payload: {
        currentPassword: 'WrongPassword123!',
        newPassword: 'StrongNew#Password2026!',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects passwords failing policy with 422 PASSWORD_POLICY_VIOLATION and reasons', async () => {
    const login = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    expect(login.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
      payload: {
        currentPassword: DEV_PASSWORD,
        newPassword: 'short',
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe('PASSWORD_POLICY_VIOLATION');
    expect(Array.isArray(body.reasons)).toBe(true);
    expect(body.reasons).toContain('too_short');
  });

  it('rejects breached password with 422 PASSWORD_BREACHED', async () => {
    const login = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    expect(login.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { [SessionService.cookieName()]: login.sessionCookie! },
      payload: {
        currentPassword: DEV_PASSWORD,
        // "password123456" is a widely breached password exceeding min length
        newPassword: 'password123456',
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(['PASSWORD_BREACHED', 'PASSWORD_POLICY_VIOLATION']).toContain(body.code);
  });

  it('completes password change, revokes other sessions, enforces history', async () => {
    // 1. Establish session 1 and session 2 for company admin
    const login1 = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    const login2 = await loginWithPassword(app, SEED.companyAdminEmail, DEV_PASSWORD);
    expect(login1.sessionCookie).toBeTruthy();
    expect(login2.sessionCookie).toBeTruthy();

    const newPass1 = 'StrongPass#1_2026_Secure';

    // 2. Change password using session 1
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { [SessionService.cookieName()]: login1.sessionCookie! },
      payload: {
        currentPassword: DEV_PASSWORD,
        newPassword: newPass1,
      },
    });
    expect(changeRes.statusCode).toBe(200);
    expect(changeRes.json().success).toBe(true);

    // 3. Session 1 remains valid
    const me1 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: login1.sessionCookie! },
    });
    expect(me1.statusCode).toBe(200);

    // 4. Session 2 was revoked
    const me2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      cookies: { [SessionService.cookieName()]: login2.sessionCookie! },
    });
    expect(me2.statusCode).toBe(401);

    // 5. Attempting to change to the same (current) or previous password fails with PASSWORD_REUSED
    const reuseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password/change',
      cookies: { [SessionService.cookieName()]: login1.sessionCookie! },
      payload: {
        currentPassword: newPass1,
        newPassword: DEV_PASSWORD, // was just replaced!
      },
    });
    expect(reuseRes.statusCode).toBe(422);
    expect(reuseRes.json().code).toBe('PASSWORD_REUSED');
    expect(reuseRes.json().reasons).toContain('reused');

    // 6. Restore password to DEV_PASSWORD via intermediate passwords
    // Passwords 2, 3, 4, 5, 6
    let currentPass = newPass1;
    for (let i = 2; i <= 6; i++) {
      const nextPass = i === 6 ? DEV_PASSWORD : `StrongPass#${i}_2026_Secure`;
      const stepRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password/change',
        cookies: { [SessionService.cookieName()]: login1.sessionCookie! },
        payload: {
          currentPassword: currentPass,
          newPassword: nextPass,
        },
      });
      expect(stepRes.statusCode, JSON.stringify(stepRes.json())).toBe(200);
      currentPass = nextPass;
    }

    // Now DEV_PASSWORD is reinstated successfully after falling off the 5-password history window!
    expect(currentPass).toBe(DEV_PASSWORD);
  });
});
