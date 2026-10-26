import crypto from 'node:crypto';

// Test fixtures and tenant context helpers for integration tests
export interface TenantContext {
  orgId: string;
  sessionToken: string;
}

export async function createTenantContext(slug: string): Promise<TenantContext> {
  return {
    orgId: `org_${slug}`,
    sessionToken: `token_${slug}`,
  };
}

export interface SeededInvitation {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  role: 'company_admin' | 'candidate';
  token: string;
  tokenHash: Buffer;
  orgName: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export function hashToken(token: string): Buffer {
  return crypto.createHash('sha256').update(token.trim()).digest();
}

export const SEEDED_INVITATIONS = {
  valid: {
    id: '11111111-1111-4111-8111-111111111111',
    orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'invited.admin@example.test',
    role: 'company_admin' as const,
    token: 'valid_test_token_32_bytes_long_fixture_hex_01',
    tokenHash: hashToken('valid_test_token_32_bytes_long_fixture_hex_01'),
    orgName: 'Acme Test Corp',
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    usedAt: null,
    createdAt: new Date(Date.now() - 1000),
  },
  expired: {
    id: '22222222-2222-4222-8222-222222222222',
    orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    email: 'expired.candidate@example.test',
    role: 'candidate' as const,
    token: 'expired_test_token_32_bytes_fixture_hex_02',
    tokenHash: hashToken('expired_test_token_32_bytes_fixture_hex_02'),
    orgName: 'Acme Test Corp',
    expiresAt: new Date(Date.now() - 3600 * 1000),
    usedAt: null,
    createdAt: new Date(Date.now() - 73 * 3600 * 1000),
  },
  used: {
    id: '33333333-3333-4333-8333-333333333333',
    orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    email: 'already.used@example.test',
    role: 'candidate' as const,
    token: 'already_used_token_32_bytes_fixture_hex_03',
    tokenHash: hashToken('already_used_token_32_bytes_fixture_hex_03'),
    orgName: 'Acme Test Corp',
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    usedAt: new Date(Date.now() - 1800 * 1000),
    createdAt: new Date(Date.now() - 3600 * 1000),
  },
};
