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
