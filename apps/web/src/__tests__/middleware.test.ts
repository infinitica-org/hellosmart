import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, DEV_SESSION_STORE } from '../middleware';

describe('Next.js Route Protection Middleware', () => {
  beforeEach(() => {
    DEV_SESSION_STORE.set('sess_123_candidate', {
      role: 'candidate',
      email: 'candidate@test.com',
    });
    DEV_SESSION_STORE.set('sess_123_company', {
      role: 'company_admin',
      email: 'admin@test.com',
    });
    DEV_SESSION_STORE.set('sess_123_admin', {
      role: 'platform_admin',
      email: 'superadmin@test.com',
    });
    DEV_SESSION_STORE.set('sess_abc_candidate', {
      role: 'candidate',
      email: 'candidate2@test.com',
    });
  });
  it('redirects unauthenticated requests on /admin to /login with from param', async () => {
    const req = new NextRequest('http://localhost:3000/admin');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/login?from=%2Fadmin');
  });

  it('redirects unauthenticated requests on /company to /login with from param', async () => {
    const req = new NextRequest('http://localhost:3000/company');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/login?from=%2Fcompany');
  });

  it('redirects unauthenticated requests on /candidate to /login with from param', async () => {
    const req = new NextRequest('http://localhost:3000/candidate');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/login?from=%2Fcandidate');
  });

  it('allows unauthenticated requests on public routes like / and /login', async () => {
    const reqHome = new NextRequest('http://localhost:3000/');
    const resHome = await middleware(reqHome);
    expect(resHome.status).toBe(200);

    const reqLogin = new NextRequest('http://localhost:3000/login');
    const resLogin = await middleware(reqLogin);
    expect(resLogin.status).toBe(200);
  });

  it('enforces BR-25: candidate trying to access /admin is redirected straight to /candidate', async () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'hs_session=sess_123_candidate; hs_role=candidate',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/candidate');
  });

  it('enforces BR-25: candidate trying to access /company is redirected straight to /candidate', async () => {
    const req = new NextRequest('http://localhost:3000/company/settings', {
      headers: {
        cookie: 'hs_session=sess_123_candidate; hs_role=candidate',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/candidate');
  });

  it('redirects company_admin trying to access /admin straight to /company', async () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'hs_session=sess_123_company; hs_role=company_admin',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/company');
  });

  it('accepts __Host-hs_session for BR-25 portal checks', async () => {
    const req = new NextRequest('http://localhost:3000/candidate', {
      headers: {
        cookie: '__Host-hs_session=sess_123_candidate; hs_role=candidate',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows candidate to access /candidate freely', async () => {
    const req = new NextRequest('http://localhost:3000/candidate', {
      headers: {
        cookie: 'hs_session=sess_123_candidate; hs_role=candidate',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows company_admin to access /company freely', async () => {
    const req = new NextRequest('http://localhost:3000/company', {
      headers: {
        cookie: 'hs_session=sess_123_company; hs_role=company_admin',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('allows platform_admin to access /admin freely', async () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'hs_session=sess_123_admin; hs_role=platform_admin',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('enforces BR-24: forces password reset when hs_must_reset=true and redirects to /change-password', async () => {
    const req = new NextRequest('http://localhost:3000/candidate', {
      headers: {
        cookie: 'hs_session=sess_123_candidate; hs_must_reset=true',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3000/change-password?required=true');
  });

  it('safety check: does not crash when backend is offline or restarting in dev', async () => {
    const req = new NextRequest('http://localhost:3000/candidate', {
      headers: {
        cookie: 'hs_session=sess_abc_candidate; hs_role=candidate',
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('fails closed in production if backend is unreachable', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllowDev = process.env.ALLOW_DEV_LOGIN;

    try {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEV_LOGIN;

      const req = new NextRequest('http://localhost:3000/admin', {
        headers: {
          cookie: 'hs_session=some_unverified_token; hs_role=platform_admin',
        },
      });

      const res = await middleware(req);
      // In production, unverified session must fail closed to /login
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/login');
    } finally {
      // @ts-expect-error restore env
      process.env.NODE_ENV = originalEnv;
      if (originalAllowDev) process.env.ALLOW_DEV_LOGIN = originalAllowDev;
    }
  });
});
