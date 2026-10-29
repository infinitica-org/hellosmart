import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.AUTH_MOCK_PORT ? parseInt(process.env.AUTH_MOCK_PORT, 10) : 4000;

// Deterministic test accounts matching packages/fixtures
const USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: (process.env.E2E_SUPER_ADMIN_EMAIL ?? 'admin.super@seed.example.test').toLowerCase(),
    password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'DevPassword123!',
    name: 'Super Admin',
    role: 'platform_admin',
    portal: 'admin',
    mustResetPassword: false,
    org: null,
    status: 'active',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: (process.env.E2E_COMPANY_ADMIN_EMAIL ?? 'owner@aster.seed.example.test').toLowerCase(),
    password: process.env.E2E_COMPANY_ADMIN_PASSWORD ?? 'DevPassword123!',
    name: 'Aster Owner',
    role: 'company_admin',
    portal: 'company',
    mustResetPassword: false,
    org: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Aster Ridge Technologies',
      logoUrl: null,
      status: 'active',
    },
    status: 'active',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: (process.env.E2E_CANDIDATE_EMAIL ?? 'complete@seed.example.test').toLowerCase(),
    password: process.env.E2E_CANDIDATE_PASSWORD ?? 'DevPassword123!',
    name: 'Complete Candidate',
    role: 'candidate',
    portal: 'candidate',
    mustResetPassword: false,
    org: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Aster Ridge Technologies',
      logoUrl: null,
      status: 'active',
    },
    status: 'active',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'suspended@aster.seed.example.test',
    password: process.env.E2E_COMPANY_ADMIN_PASSWORD ?? 'DevPassword123!',
    name: 'Suspended Owner',
    role: 'company_admin',
    portal: 'company',
    mustResetPassword: false,
    org: {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Suspended Corp',
      logoUrl: null,
      status: 'suspended',
    },
    status: 'active',
  },
];

// In-memory token stores
const sessions = new Map(); // sessionId -> user
const preAuthStore = new Map(); // preAuthToken -> { userId, attempts, expiresAt }
const INVITATIONS = new Map([
  [
    'valid-company-admin-token',
    {
      token: 'valid-company-admin-token',
      email: 'new.admin@aster.seed.example.test',
      role: 'company_admin',
      orgName: 'Aster Ridge Technologies',
      status: 'pending',
      expiresAt: Date.now() + 86400000,
    },
  ],
  [
    'valid-candidate-token',
    {
      token: 'valid-candidate-token',
      email: 'new.candidate@aster.seed.example.test',
      role: 'candidate',
      orgName: 'Aster Ridge Technologies',
      status: 'pending',
      expiresAt: Date.now() + 86400000,
    },
  ],
  [
    'expired-invite-token',
    {
      token: 'expired-invite-token',
      email: 'expired@aster.seed.example.test',
      role: 'candidate',
      orgName: 'Aster Ridge Technologies',
      status: 'pending',
      expiresAt: Date.now() - 3600000, // Expired 1 hr ago
    },
  ],
  [
    'used-invite-token',
    {
      token: 'used-invite-token',
      email: 'used@aster.seed.example.test',
      role: 'candidate',
      orgName: 'Aster Ridge Technologies',
      status: 'consumed',
      expiresAt: Date.now() + 86400000,
    },
  ],
]);

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1:4000'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck for Playwright readiness
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Helper to read JSON body
  const readJson = (callback) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        callback(null, parsed);
      } catch (err) {
        callback(err);
      }
    });
  };

  // POST /auth/login (and /api/v1/auth/login)
  if ((url.pathname === '/auth/login' || url.pathname === '/api/v1/auth/login') && req.method === 'POST') {
    readJson((err, { email, password }) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Invalid JSON payload' }));
        return;
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = USERS.find((u) => u.email === normalizedEmail);

      if (!user || user.password !== password) {
        res.writeHead(401, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid credentials. Please verify your email and password.',
            code: 'INVALID_CREDENTIALS',
          })
        );
        return;
      }

      // Check organization suspension
      if (user.org && user.org.status === 'suspended') {
        res.writeHead(403, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Forbidden',
            status: 403,
            detail: 'Your organization has been suspended. Please contact support.',
            code: 'ORG_SUSPENDED',
          })
        );
        return;
      }

      // Platform admin: requires MFA step (BR-04, BR-25)
      if (user.role === 'platform_admin') {
        const preAuthToken = `preauth_mock_${crypto.randomUUID()}`;
        preAuthStore.set(preAuthToken, {
          userId: user.id,
          attempts: 0,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ mfaRequired: true, preAuthToken }));
        return;
      }

      // Standard roles: issue session cookie directly
      const sessionId = `hs_sess_${crypto.randomUUID()}`;
      sessions.set(sessionId, user);

      const cookie = `hs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      });

      const { password: _, ...meResponse } = user;
      res.end(JSON.stringify(meResponse));
    });
    return;
  }

  // POST /auth/mfa/verify (and /api/v1/auth/mfa/verify)
  if ((url.pathname === '/auth/mfa/verify' || url.pathname === '/api/v1/auth/mfa/verify') && req.method === 'POST') {
    readJson((err, { preAuthToken, totpCode }) => {
      if (err || !preAuthToken || !totpCode) {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Bad Request', status: 400, detail: 'preAuthToken and totpCode are required' }));
        return;
      }

      const entry = preAuthStore.get(preAuthToken);
      if (!entry || Date.now() > entry.expiresAt) {
        preAuthStore.delete(preAuthToken);
        res.writeHead(401, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Pre-authentication expired or invalid',
            code: 'PREAUTH_INVALID',
          })
        );
        return;
      }

      if (entry.attempts >= 3) {
        preAuthStore.delete(preAuthToken);
        res.writeHead(429, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Too many failed MFA attempts. Please wait 15 minutes.',
            code: 'MFA_LOCKED_OUT',
          })
        );
        return;
      }

      const sanitizedCode = String(totpCode).trim();
      if (sanitizedCode !== '123456') {
        entry.attempts += 1;
        if (entry.attempts >= 3) {
          preAuthStore.delete(preAuthToken);
          res.writeHead(429, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'about:blank',
              title: 'Too Many Requests',
              status: 429,
              detail: 'Too many failed MFA attempts. Pre-authentication invalidated.',
              code: 'MFA_LOCKED_OUT',
            })
          );
          return;
        }

        res.writeHead(401, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid MFA code',
            code: 'MFA_INVALID',
          })
        );
        return;
      }

      // Valid TOTP: issue session
      preAuthStore.delete(preAuthToken);
      const user = USERS.find((u) => u.id === entry.userId);
      const sessionId = `hs_sess_${crypto.randomUUID()}`;
      sessions.set(sessionId, user);

      const cookie = `hs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      });

      const { password: _, ...meResponse } = user;
      res.end(JSON.stringify(meResponse));
    });
    return;
  }

  // GET /auth/invitations/:token (and /api/v1/auth/invitations/:token)
  const inviteMatch = url.pathname.match(/^\/(?:api\/v1\/)?auth\/invitations\/([^/]+)$/);
  if (inviteMatch && req.method === 'GET') {
    const token = inviteMatch[1];
    const invite = INVITATIONS.get(token);

    if (!invite) {
      res.writeHead(404, { 'Content-Type': 'application/problem+json' });
      res.end(JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Invitation not found', code: 'INVITATION_NOT_FOUND' }));
      return;
    }

    if (invite.status === 'consumed') {
      res.writeHead(409, { 'Content-Type': 'application/problem+json' });
      res.end(JSON.stringify({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'This invitation has already been accepted.', code: 'INVITATION_ALREADY_USED' }));
      return;
    }

    if (Date.now() > invite.expiresAt) {
      res.writeHead(410, { 'Content-Type': 'application/problem+json' });
      res.end(JSON.stringify({ type: 'about:blank', title: 'Gone', status: 410, detail: 'This invitation link has expired.', code: 'INVITATION_EXPIRED' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      email: invite.email,
      role: invite.role,
      orgName: invite.orgName,
    }));
    return;
  }

  // POST /auth/invitations/accept (and /api/v1/auth/invitations/accept)
  if ((url.pathname === '/auth/invitations/accept' || url.pathname === '/api/v1/auth/invitations/accept') && req.method === 'POST') {
    readJson((err, { token, password }) => {
      if (err || !token || !password) {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Bad Request', status: 400, detail: 'token and password are required' }));
        return;
      }

      const invite = INVITATIONS.get(token);
      if (!invite) {
        res.writeHead(404, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Invitation not found', code: 'INVITATION_NOT_FOUND' }));
        return;
      }

      if (invite.status === 'consumed') {
        res.writeHead(409, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'This invitation has already been accepted.', code: 'INVITATION_ALREADY_USED' }));
        return;
      }

      if (Date.now() > invite.expiresAt) {
        res.writeHead(410, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({ type: 'about:blank', title: 'Gone', status: 410, detail: 'This invitation link has expired.', code: 'INVITATION_EXPIRED' }));
        return;
      }

      // Validate password policy (min 12 chars, upper, lower, digit, symbol)
      const policyPasses =
        password.length >= 12 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);

      if (!policyPasses) {
        res.writeHead(422, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({
          type: 'about:blank',
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Password does not meet security policy requirements.',
          code: 'PASSWORD_TOO_WEAK',
        }));
        return;
      }

      // Consume invitation atomically
      invite.status = 'consumed';

      // Register or update user with accepted password
      const newUser = {
        id: crypto.randomUUID(),
        email: invite.email.toLowerCase(),
        password,
        name: invite.role === 'company_admin' ? 'New Company Admin' : 'New Candidate',
        role: invite.role,
        portal: invite.role === 'company_admin' ? 'company' : 'candidate',
        mustResetPassword: false,
        org: {
          id: '00000000-0000-0000-0000-000000000010',
          name: invite.orgName,
          logoUrl: null,
          status: 'active',
        },
        status: 'active',
      };
      USERS.push(newUser);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Password set successfully. You can now sign in.',
      }));
    });
    return;
  }

  // GET /me (and /api/v1/me)
  if ((url.pathname === '/me' || url.pathname === '/api/v1/me') && req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie);
    let sessionToken = cookies['hs_session'];

    if (!sessionToken && req.headers.authorization?.startsWith('Bearer ')) {
      sessionToken = req.headers.authorization.slice(7).trim();
    }

    const user = sessionToken ? sessions.get(sessionToken) : null;

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/problem+json' });
      res.end(
        JSON.stringify({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Session invalid or expired',
          code: 'UNAUTHORIZED',
        })
      );
      return;
    }

    // Check organization suspension on live session lookup
    if (user.org && user.org.status === 'suspended') {
      sessions.delete(sessionToken);
      res.writeHead(403, { 'Content-Type': 'application/problem+json' });
      res.end(
        JSON.stringify({
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Your organization has been suspended.',
          code: 'ORG_SUSPENDED',
        })
      );
      return;
    }

    const { password: _, ...meResponse } = user;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(meResponse));
    return;
  }

  // POST /auth/logout (and /api/v1/auth/logout)
  if ((url.pathname === '/auth/logout' || url.pathname === '/api/v1/auth/logout') && req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['hs_session'];
    if (sessionToken) {
      sessions.delete(sessionToken);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'hs_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/problem+json' });
  res.end(
    JSON.stringify({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${url.pathname} not found`,
    })
  );
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[auth-mock-server] Running on http://127.0.0.1:${PORT}`);
});
