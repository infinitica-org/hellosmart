import { FIXTURE } from './constants.js';

export { FIXTURE };

export interface TenantContext {
  orgId: string;
  sessionToken: string;
}

/** Typed helper for cross-tenant tests (org A = Aster Ridge, org B = Brindle & Co). */
export async function createTenantContext(
  slug: 'aster-ridge' | 'brindle-co' | 'platform',
): Promise<TenantContext> {
  if (slug === 'platform') {
    return {
      orgId: '',
      sessionToken: `token_platform_${FIXTURE.platformAdmin.id}`,
    };
  }
  const org = slug === 'aster-ridge' ? FIXTURE.asterRidge : FIXTURE.brindle;
  return {
    orgId: org.id,
    sessionToken: `token_${slug}_${org.admin.id}`,
  };
}
