/** Deterministic fixture IDs (synthetic data only; emails use @example.test). */
export const FIXTURE = {
  platformAdmin: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'superadmin@hellosmart.ai',
    name: 'Platform Super Admin',
  },
  asterRidge: {
    id: '03fa0961-c787-51dd-a4f6-d445495111c6',
    slug: 'aster-ridge',
    name: 'Aster Ridge Technologies',
    admin: {
      id: '10000000-0000-4000-8000-000000000001',
      email: 'admin@asterridge.com',
      name: 'Aster Ridge Admin',
    },
    entitlements: { maxTemplates: 10, maxCandidates: 100, status: 'paid_active' as const },
  },
  brindle: {
    id: '43598d97-152e-5fe9-95e5-f55db8858a7f',
    slug: 'brindle-co',
    name: 'Brindle & Co',
    admin: {
      id: '20000000-0000-4000-8000-000000000001',
      email: 'admin@brindle.co',
      name: 'Brindle Admin',
    },
    entitlements: { maxTemplates: 2, maxCandidates: 10, status: 'trial_active' as const },
  },
} as const;
