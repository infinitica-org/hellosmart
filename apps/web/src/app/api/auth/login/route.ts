import { NextRequest, NextResponse } from 'next/server';

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

// Track failed attempts in memory for 429 simulation
const failedAttempts: Record<string, number> = {};

export async function POST(req: NextRequest): Promise<NextResponse> {
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
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting check (429 simulation for > 4 failed attempts or explicit rate-limit testing)
    if (normalizedEmail.includes('ratelimit') || (failedAttempts[normalizedEmail] && failedAttempts[normalizedEmail] >= 5)) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many failed attempts. Please wait 15 minutes.',
        },
        { status: 429 }
      );
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

    // First attempt real backend call if available
    try {
      const apiRes = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      // If backend returned a specific error status, relay it
      return NextResponse.json(
        data || {
          type: 'about:blank',
          title: 'Authentication Failed',
          status: apiRes.status,
          detail: 'Invalid credentials or authentication error.',
        },
        { status: apiRes.status }
      );
    } catch {
      // Backend not running / offline: fall back to dev-mode authentication
    }

    // Dev-mode fallback authentication
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
        { status: 401 }
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
        { status: 403 }
      );
    }

    // In dev mode, any test password with length >= 6 is accepted, except explicit "wrongpassword"
    if (password === 'wrongpassword' || password.length < 6) {
      failedAttempts[normalizedEmail] = (failedAttempts[normalizedEmail] || 0) + 1;
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password, or account not found.',
        },
        { status: 401 }
      );
    }

    // Check MFA requirement
    if (user.requiresMfa && !mfaCode) {
      return NextResponse.json(
        {
          mfaRequired: true,
          role: user.role,
          portal: user.portal,
          email: user.email,
          message: 'Two-factor authentication code required.',
        },
        { status: 200 }
      );
    }

    // If MFA was required, validate TOTP code (must be 6 digits)
    if (user.requiresMfa && mfaCode) {
      const sanitizedCode = mfaCode.trim();
      if (!/^\d{6}$/.test(sanitizedCode) || sanitizedCode === '000000') {
        return NextResponse.json(
          {
            type: 'about:blank',
            title: 'Invalid MFA Code',
            status: 401,
            detail: 'Invalid 6-digit authentication code. Please try again.',
          },
          { status: 401 }
        );
      }
    }

    // Successful login: reset failed attempts
    failedAttempts[normalizedEmail] = 0;

    const sessionPayload = {
      user: {
        id: `usr_${user.portal}_01`,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      role: user.role,
      portal: user.portal,
      token: `hs_sess_${Date.now()}_${user.role}`,
    };

    const res = NextResponse.json(sessionPayload, { status: 200 });

    // Set cookies for role and session so middleware and client work smoothly
    res.cookies.set('hs_session', sessionPayload.token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
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
      { status: 500 }
    );
  }
}
