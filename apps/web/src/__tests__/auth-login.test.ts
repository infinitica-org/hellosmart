import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/auth/login/route';
import { POST as logoutPOST } from '../app/api/auth/logout/route';

describe('Auth Login API Route & Handlers', () => {
  it('rejects empty credentials with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: '', password: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.detail).toContain('required');
  });

  it('returns 401 with clean error for unknown account or bad password', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com', password: 'wrongpassword' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.detail).toBe('Invalid email or password, or account not found.');
  });

  it('returns 403 with clean error for suspended account', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'suspended@example.com', password: 'ValidPassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.detail).toBe('Your account or company is suspended. Please contact support.');
  });

  it('returns 429 with clean error when rate limit is exceeded', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ratelimit-test@example.com', password: 'ValidPassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.detail).toBe('Too many failed attempts. Please wait 15 minutes.');
  });

  it('requires MFA for platform_admin and returns mfaRequired flag', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hellosmart.ai', password: 'AdminPassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mfaRequired).toBe(true);
    expect(data.role).toBe('platform_admin');
  });

  it('completes MFA with valid 6-digit TOTP and redirects to /admin', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@hellosmart.ai',
        password: 'AdminPassword123!',
        mfaCode: '123456',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe('platform_admin');
    expect(data.portal).toBe('admin');
  });

  it('logs in company_admin successfully and targets /company', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'company@example.com', password: 'CompanyPassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe('company_admin');
    expect(data.portal).toBe('company');
  });

  it('logs in candidate successfully and targets /candidate', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'candidate@example.com', password: 'CandidatePassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe('candidate');
    expect(data.portal).toBe('candidate');
  });

  it('sets HttpOnly attribute on hs_session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'candidate@example.com', password: 'CandidatePassword123!' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const sessionCookie = res.cookies.get('hs_session');
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('lax');
  });

  it('fails closed in production when demo accounts are disabled and backend fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalEnableDevAccounts = process.env.ENABLE_DEV_ACCOUNTS;

    try {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_DEV_ACCOUNTS;

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@hellosmart.ai', password: 'AdminPassword123!' }),
      });

      const res = await POST(req);
      // In production with backend unreachable, must fail closed with 503
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.title).toBe('Authentication Service Unavailable');
    } finally {
      // @ts-expect-error restore env
      process.env.NODE_ENV = originalNodeEnv;
      if (originalEnableDevAccounts !== undefined) {
        process.env.ENABLE_DEV_ACCOUNTS = originalEnableDevAccounts;
      }
    }
  });

  it('fails closed in staging even if ENABLE_DEV_ACCOUNTS=true is mistakenly set', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalEnableDevAccounts = process.env.ENABLE_DEV_ACCOUNTS;

    try {
      // @ts-expect-error override env for test — simulates a staging misconfiguration
      process.env.NODE_ENV = 'staging';
      process.env.ENABLE_DEV_ACCOUNTS = 'true';

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'company@example.com', password: 'CompanyPassword123!' }),
      });

      const res = await POST(req);
      // Must NOT authenticate via DEV_ACCOUNTS; backend offline → 503
      expect(res.status).toBe(503);
    } finally {
      // @ts-expect-error restore env
      process.env.NODE_ENV = originalNodeEnv;
      if (originalEnableDevAccounts !== undefined) {
        process.env.ENABLE_DEV_ACCOUNTS = originalEnableDevAccounts;
      } else {
        delete process.env.ENABLE_DEV_ACCOUNTS;
      }
    }
  });

  it('logs out and clears session cookies', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'hs_session=test_token_123; hs_role=candidate',
      },
    });

    const res = await logoutPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify cookies are expired / deleted
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('hs_session=;');
    expect(setCookie).toContain('hs_role=;');
  });
});

