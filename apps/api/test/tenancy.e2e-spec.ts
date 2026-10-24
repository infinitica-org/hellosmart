import { describe, expect, it } from 'vitest';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');

// Default to deterministic seed fixtures from @hs/fixtures if env vars are unset
const orgAEmail = process.env.TENANCY_ORG_A_EMAIL || 'owner@aster.seed.example.test';
const orgAPassword = process.env.TENANCY_ORG_A_PASSWORD || 'DevPassword123!';
// Brindle candidate fixture ID (Org B)
const orgBCandidateId = process.env.TENANCY_ORG_B_CANDIDATE_ID || '00000000-0000-4000-b000-000000000001';

async function loginAndGetCookie(email: string, password: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/login`, {
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

  expect(response.status, 'Org A fixture must be an active company admin').toBe(200);
  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookiePair = setCookie.match(/(?:^|,\s*)(hs_session=[^;,]+)/i)?.[1];
  expect(cookiePair, 'login response must set hs_session').toBeDefined();
  return cookiePair!;
}

// Acceptance Check 11: Fail fast with clear diagnostic if prerequisites are missing; never silently skip.
describe('Tenant isolation API integration (BR-01)', () => {
  it('does not allow an Org A session to read a candidate belonging to Org B', async () => {
    const cookie = await loginAndGetCookie(orgAEmail, orgAPassword);

    // Cross-org resource lookups must return 404 (not 403) to avoid confirming that
    // another tenant's record exists (BR-01).
    // Note: Individual resource GET /candidates/{id} is planned; if unrouted, verify 404.
    let response: Response;
    try {
      response = await fetch(
        `${apiBaseUrl}/candidates/${encodeURIComponent(orgBCandidateId)}`,
        { headers: { cookie }, redirect: 'manual' },
      );
    } catch (err: any) {
      throw new Error(
        `Failed to execute cross-tenant read at ${apiBaseUrl}/candidates/${orgBCandidateId}: ${err.message}`,
      );
    }

    expect(response.status).toBe(404);
    const body = await response.json().catch(() => ({}));
    expect(JSON.stringify(body)).not.toContain(orgBCandidateId);
  });

  it('does not include Org B records in Org A candidate listings', async () => {
    const cookie = await loginAndGetCookie(orgAEmail, orgAPassword);

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/candidates`, {
        headers: { cookie },
        redirect: 'manual',
      });
    } catch (err: any) {
      throw new Error(`Failed to list candidates at ${apiBaseUrl}/candidates: ${err.message}`);
    }

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items?: Array<{ id?: string }> };
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items?.some((item) => item.id === orgBCandidateId)).toBe(false);
  });
});
