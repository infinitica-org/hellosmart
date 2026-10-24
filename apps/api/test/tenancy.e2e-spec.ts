import { describe, expect, it } from 'vitest';

const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const enabled = process.env.TENANCY_E2E_ENABLED === 'true';

function requireFixture(value: string, name: string): string {
  if (!value) throw new Error(`Missing required E2E fixture environment variable: ${name}`);
  return value;
}

async function loginAndGetCookie(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });

  expect(response.status, 'Org A fixture must be an active company admin').toBe(200);
  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookiePair = setCookie.match(/(?:^|,\s*)(hs_session=[^;,]+)/i)?.[1];
  expect(cookiePair, 'login response must set hs_session').toBeDefined();
  return cookiePair!;
}

describe.skipIf(!enabled)('Tenant isolation API integration (BR-01)', () => {
  it('does not allow an Org A session to read a candidate belonging to Org B', async () => {
    const cookie = await loginAndGetCookie(
      requireFixture(process.env.TENANCY_ORG_A_EMAIL ?? '', 'TENANCY_ORG_A_EMAIL'),
      requireFixture(process.env.TENANCY_ORG_A_PASSWORD ?? '', 'TENANCY_ORG_A_PASSWORD'),
    );
    const orgBCandidateId = requireFixture(
      process.env.TENANCY_ORG_B_CANDIDATE_ID ?? '',
      'TENANCY_ORG_B_CANDIDATE_ID',
    );

    // Cross-org resource lookups must return 404 (not 403) to avoid confirming that
    // another tenant's record exists. The ID is a fixture owned exclusively by Org B.
    const response = await fetch(
      `${apiBaseUrl}/candidates/${encodeURIComponent(orgBCandidateId)}`,
      { headers: { cookie }, redirect: 'manual' },
    );

    expect(response.status).toBe(404);
    const body = await response.json().catch(() => ({}));
    expect(JSON.stringify(body)).not.toContain(orgBCandidateId);
  });

  it('does not include Org B records in Org A candidate listings', async () => {
    const cookie = await loginAndGetCookie(
      requireFixture(process.env.TENANCY_ORG_A_EMAIL ?? '', 'TENANCY_ORG_A_EMAIL'),
      requireFixture(process.env.TENANCY_ORG_A_PASSWORD ?? '', 'TENANCY_ORG_A_PASSWORD'),
    );
    const orgBCandidateId = requireFixture(
      process.env.TENANCY_ORG_B_CANDIDATE_ID ?? '',
      'TENANCY_ORG_B_CANDIDATE_ID',
    );

    const response = await fetch(`${apiBaseUrl}/candidates`, {
      headers: { cookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((item: { id?: string }) => item.id === orgBCandidateId)).toBe(false);
  });
});
