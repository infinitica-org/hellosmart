import { afterAll, describe, expect, it } from 'vitest';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');

// Default to deterministic seed fixtures from @hs/fixtures if env vars are unset
const credentials = {
  activeEmail: process.env.AUTH_ACTIVE_EMAIL || 'owner@aster.seed.example.test',
  activePassword: process.env.AUTH_ACTIVE_PASSWORD || 'DevPassword123!',
  suspendedUserEmail: process.env.AUTH_SUSPENDED_USER_EMAIL || 'suspended@aster.seed.example.test',
  suspendedUserPassword: process.env.AUTH_SUSPENDED_USER_PASSWORD || 'DevPassword123!',
  suspendedOrgEmail: process.env.AUTH_SUSPENDED_ORG_EMAIL || 'user@corbel.seed.example.test',
  suspendedOrgPassword: process.env.AUTH_SUSPENDED_ORG_PASSWORD || 'DevPassword123!',
  bruteForceEmail: process.env.AUTH_BRUTE_FORCE_EMAIL || 'bruteforce@seed.example.test',
};

async function login(email: string, password: string): Promise<Response> {
  try {
    return await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });
  } catch (err: any) {
    throw new Error(
      `Failed to connect to HelloSmart API at ${apiBaseUrl}/auth/login: ${err.message}. ` +
      `Ensure the backend API service is running on ${apiBaseUrl} and connected to the test database.`,
    );
  }
}

afterAll(() => {
  // Intentionally no fixture cleanup: these tests use explicitly provisioned local test accounts.
});

// Acceptance Check 11: Fail fast with clear diagnostic if prerequisites are missing; never silently skip.
describe('Authentication API integration (CO-001, BR-04)', () => {
  it('accepts valid credentials and sets the hs_session cookie', async () => {
    const response = await login(credentials.activeEmail, credentials.activePassword);

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
    const response = await login(credentials.suspendedUserEmail, credentials.suspendedUserPassword);

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie') ?? '').not.toMatch(/hs_session=/i);
  });

  it('rejects a user belonging to a suspended company with 403 Forbidden', async () => {
    const response = await login(credentials.suspendedOrgEmail, credentials.suspendedOrgPassword);

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie') ?? '').not.toMatch(/hs_session=/i);
  });

  it('returns 429 after five consecutive bad-password attempts for the same account', async () => {
    const email = credentials.bruteForceEmail;
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
