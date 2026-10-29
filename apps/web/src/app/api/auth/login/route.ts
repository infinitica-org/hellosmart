import { NextRequest, NextResponse } from 'next/server';
import { DEV_SESSION_STORE, MOCK_PREAUTH_STORE } from '@/lib/session-store';

interface DevUser {
  email: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  name: string;
  requiresMfa?: boolean;
  status?: 'active' | 'suspended';
}

const DEV_ACCOUNTS: Record<string, DevUser> = {
  'admin@hellosmart.ai': {
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Platform Administrator',
    requiresMfa: true,
    status: 'active',
  },
  'platform.admin@hellosmart.ai': {
    email: 'platform.admin@hellosmart.ai',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Platform Administrator',
    requiresMfa: true,
    status: 'active',
  },
  'admin.super@seed.example.test': {
    email: 'admin.super@seed.example.test',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Super Admin',
    requiresMfa: true,
    status: 'active',
  },
  'company@example.com': {
    email: 'company@example.com',
    role: 'company_admin',
    portal: 'company',
    name: 'Acme Corp Admin',
    requiresMfa: false,
    status: 'active',
  },
  'company.admin@seed.example.test': {
    email: 'company.admin@seed.example.test',
    role: 'company_admin',
    portal: 'company',
    name: 'Company Admin',
    requiresMfa: false,
    status: 'active',
  },
  'candidate@example.com': {
    email: 'candidate@example.com',
    role: 'candidate',
    portal: 'candidate',
    name: 'Jane Doe',
    requiresMfa: false,
    status: 'active',
  },
  'complete@seed.example.test': {
    email: 'complete@seed.example.test',
    role: 'candidate',
    portal: 'candidate',
    name: 'Complete Candidate',
    requiresMfa: false,
    status: 'active',
  },
  'alex.turner@seed.example.test': {
    email: 'alex.turner@seed.example.test',
    role: 'candidate',
    portal: 'candidate',
    name: 'Alex Turner',
    requiresMfa: false,
    status: 'active',
  },
  'suspended@example.com': {
    email: 'suspended@example.com',
    role: 'company_admin',
    portal: 'company',
    name: 'Suspended Account',
    status: 'suspended',
  },
  'admin.suspended@seed.example.test': {
    email: 'admin.suspended@seed.example.test',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Suspended Admin',
    status: 'suspended',
  },
};

// Track failed attempts in memory for rate-limiting simulation
const failedAttempts: Record<string, number> = {};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Gate development fallback behind an explicit opt-in.
  // INVARIANT: production is unconditionally excluded — no flag can override this.
  // For local dev: set NODE_ENV=development and ENABLE_DEV_ACCOUNTS=true or ALLOW_DEV_LOGIN_BFF=true.
  // Never set ENABLE_DEV_ACCOUNTS or ALLOW_DEV_LOGIN_BFF in staging or production.
  const devFallbackEnabled =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');

  try {
    const body = await req.json();
    const { email, password, mfaCode } = body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: 'Email and password are required',
        },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting check (429 simulation for > 4 failed attempts or explicit rate-limit testing fixture)
    if (
      normalizedEmail.includes('ratelimit') ||
      (failedAttempts[normalizedEmail] && failedAttempts[normalizedEmail] >= 5)
    ) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many failed attempts. Please wait 15 minutes.',
        },
        { status: 429 },
      );
    }

    const rawApiUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const apiBaseUrl = rawApiUrl.replace(/\/$/, '');

    // 1. Attempt real backend call first
    try {
      const loginUrl = apiBaseUrl.endsWith('/api/v1')
        ? `${apiBaseUrl}/auth/login`
        : `${apiBaseUrl}/api/v1/auth/login`;

      const apiRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        body: JSON.stringify({ email: normalizedEmail, password, mfaCode }),
      });

      const data = await apiRes.json().catch(() => null);

      if (apiRes.ok) {
        failedAttempts[normalizedEmail] = 0;
        const res = NextResponse.json(data, { status: 200 });
        const setCookie = apiRes.headers.get('set-cookie');
        if (setCookie) {
          res.headers.set('set-cookie', setCookie);
        }
        return res;
      }

      // If backend returned a specific error status (401, 403, 429, etc.), relay it directly.
      // Never fall back to DEV_ACCOUNTS when the backend is reachable.
      return NextResponse.json(
        data || {
          type: 'about:blank',
          title: 'Authentication Failed',
          status: apiRes.status,
          detail: 'Invalid credentials or authentication error.',
        },
        { status: apiRes.status },
      );
    } catch {
      // Backend offline / unreachable
      // Never use demo credentials if the backend is unavailable
      // unless explicitly enabled for local development. Fail closed with 503.
      if (!devFallbackEnabled) {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Authentication Service Unavailable',
            status: 503,
            detail: 'The authentication service is currently unavailable. Please verify API server connectivity.',
          },
          { status: 503 },
        );
      }
    }

    // 2. Development-only mock fallback (reachable ONLY when devFallbackEnabled is true)
    const user = DEV_ACCOUNTS[normalizedEmail];

    if (!user) {
      failedAttempts[normalizedEmail] = (failedAttempts[normalizedEmail] || 0) + 1;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password, or account not found.',
        },
        { status: 401 },
      );
    }

    // Check account status (403 if suspended)
    if (user.status === 'suspended') {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Your account or company is suspended. Please contact support.',
        },
        { status: 403 },
      );
    }

    // In dev mode, check basic password validity
    if (password === 'wrongpassword' || password.length < 6) {
      failedAttempts[normalizedEmail] = (failedAttempts[normalizedEmail] || 0) + 1;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password, or account not found.',
        },
        { status: 401 },
      );
    }

    // Step 2a: Check MFA requirement
    // When MFA is required, DO NOT issue session cookies or tokens until verified.
    if (user.requiresMfa) {
      const preAuthToken = `preauth_dev_${crypto.randomUUID()}`;
      MOCK_PREAUTH_STORE.set(preAuthToken, {
        email: user.email,
        attempts: 0,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
      });

      return NextResponse.json(
        {
          mfaRequired: true,
          preAuthToken,
          role: user.role,
          portal: user.portal,
          email: user.email,
          message: 'Two-factor authentication code required.',
        },
        { status: 200 },
      );
    }

    // Successful login: reset failed attempts
    failedAttempts[normalizedEmail] = 0;

    // Issue a cryptographically secure random session token for dev mode
    const devToken = `hs_dev_${crypto.randomUUID()}`;
    DEV_SESSION_STORE.set(devToken, { role: user.role, email: user.email });

    const sessionPayload = {
      user: {
        id: `usr_${user.portal}_01`,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      role: user.role,
      portal: user.portal,
      token: devToken,
    };

    const res = NextResponse.json(sessionPayload, { status: 200 });

    // Session cookie: HttpOnly, SameSite=lax, Secure in production
    res.cookies.set('hs_session', devToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Client role hint:
    // INVARIANT: hs_role is non-httpOnly for UI display hints only.
    // Server and middleware authorization NEVER trust this cookie.
    res.cookies.set('hs_role', user.role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred during login.',
      },
      { status: 500 },
    );
  }
}
