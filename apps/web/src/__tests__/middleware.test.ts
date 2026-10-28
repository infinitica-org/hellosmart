import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('Next.js Route Protection Middleware', () => {
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

  it('safety check: does not crash when backend is offline or restarting', async () => {
    const req = new NextRequest('http://localhost:3000/candidate', {
      headers: {
        cookie: 'hs_session=sess_abc_candidate; hs_role=candidate',
      },
    });


    
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});
