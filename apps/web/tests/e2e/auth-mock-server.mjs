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
    },
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
    },
  },
];

// Active sessions in memory: sessionId -> user
const sessions = new Map();

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

  // POST /auth/login (and /api/v1/auth/login)
  if ((url.pathname === '/auth/login' || url.pathname === '/api/v1/auth/login') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body || '{}');
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

        // Generate session token
        const sessionId = `hs_sess_${crypto.randomUUID()}`;
        sessions.set(sessionId, user);

        const cookie = `hs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        });

        const { password: _, ...meResponse } = user;
        res.end(JSON.stringify(meResponse));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(
          JSON.stringify({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid JSON payload',
          })
        );
      }
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

