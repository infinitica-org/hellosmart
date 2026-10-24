import { afterAll, describe, expect, it } from 'vitest';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const enabled = process.env.AUTH_E2E_ENABLED === 'true';

const credentials = {
  activeEmail: process.env.AUTH_ACTIVE_EMAIL ?? '',
  activePassword: process.env.AUTH_ACTIVE_PASSWORD ?? '',
  suspendedUserEmail: process.env.AUTH_SUSPENDED_USER_EMAIL ?? '',
  suspendedUserPassword: process.env.AUTH_SUSPENDED_USER_PASSWORD ?? '',
  suspendedOrgEmail: process.env.AUTH_SUSPENDED_ORG_EMAIL ?? '',
  suspendedOrgPassword: process.env.AUTH_SUSPENDED_ORG_PASSWORD ?? '',
  bruteForceEmail: process.env.AUTH_BRUTE_FORCE_EMAIL ?? '',
};

async function login(email: string, password: string): Promise<Response> {
  return fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
}

function requireFixture(value: string, name: string): string {
  if (!value) throw new Error(`Missing required E2E fixture environment variable: ${name}`);
  return value;
}

afterAll(() => {
  // Intentionally no fixture cleanup: these tests use explicitly provisioned local test accounts.
});

describe.skipIf(!enabled)('Authentication API integration (CO-001, BR-04)', () => {
  it('accepts valid credentials and sets the hs_session cookie', async () => {
    const response = await login(
      requireFixture(credentials.activeEmail, 'AUTH_ACTIVE_EMAIL'),
      requireFixture(credentials.activePassword, 'AUTH_ACTIVE_PASSWORD'),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/(?:^|,\s*)hs_session=/i);
    expect(setCookie).toMatch(/httponly/i);
    expect(setCookie).toMatch(/samesite=lax/i);
    expect(await response.json()).toMatchObject({
      email: credentials.activeEmail,
    });
  });

  it('rejects a suspended user with 403 Forbidden', async () => {
    const response = await login(
      requireFixture(credentials.suspendedUserEmail, 'AUTH_SUSPENDED_USER_EMAIL'),
      requireFixture(credentials.suspendedUserPassword, 'AUTH_SUSPENDED_USER_PASSWORD'),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie') ?? '').not.toMatch(/hs_session=/i);
  });

  it('rejects a user belonging to a suspended company with 403 Forbidden', async () => {
    const response = await login(
      requireFixture(credentials.suspendedOrgEmail, 'AUTH_SUSPENDED_ORG_EMAIL'),
      requireFixture(credentials.suspendedOrgPassword, 'AUTH_SUSPENDED_ORG_PASSWORD'),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie') ?? '').not.toMatch(/hs_session=/i);
  });

  it('returns 429 after five consecutive bad-password attempts for the same account', async () => {
    const email = requireFixture(credentials.bruteForceEmail, 'AUTH_BRUTE_FORCE_EMAIL');
    let lastResponse: Response | undefined;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      lastResponse = await login(email, `definitely-wrong-password-${attempt}`);
      if (attempt < 5) {
        expect([401, 429]).toContain(lastResponse.status);
      }
    }

    expect(lastResponse).toBeDefined();
    expect(lastResponse!.status).toBe(429);
  });
});
