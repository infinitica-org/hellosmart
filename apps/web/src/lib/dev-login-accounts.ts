export interface DevLoginAccount {
  email: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  portal: 'admin' | 'company' | 'candidate';
  name: string;
  requiresMfa?: boolean;
  status?: 'active' | 'suspended';
}

export const DEV_LOGIN_ACCOUNTS: Record<string, DevLoginAccount> = {
  'admin@hellosmart.ai': {
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Platform Administrator',
    requiresMfa: true,
    status: 'active',
  },
  'platform.admin@hellosmart.ai': {
    email: 'platform.admin@hellosmart.ai',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Platform Administrator',
    requiresMfa: true,
    status: 'active',
  },
  'admin.super@seed.example.test': {
    email: 'admin.super@seed.example.test',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Super Admin',
    requiresMfa: true,
    status: 'active',
  },
  'company@example.com': {
    email: 'company@example.com',
    role: 'company_admin',
    portal: 'company',
    name: 'Acme Corp Admin',
    requiresMfa: false,
    status: 'active',
  },
  'admin@asterridge.com': {
    email: 'admin@asterridge.com',
    role: 'company_admin',
    portal: 'company',
    name: 'Aster Ridge Admin',
    requiresMfa: false,
    status: 'active',
  },
  'owner@aster.seed.example.test': {
    email: 'owner@aster.seed.example.test',
    role: 'company_admin',
    portal: 'company',
    name: 'Aster Owner',
    requiresMfa: false,
    status: 'active',
  },
  'company.admin@seed.example.test': {
    email: 'company.admin@seed.example.test',
    role: 'company_admin',
    portal: 'company',
    name: 'Company Admin',
    requiresMfa: false,
    status: 'active',
  },
  'candidate@example.com': {
    email: 'candidate@example.com',
    role: 'candidate',
    portal: 'candidate',
    name: 'Jane Doe',
    requiresMfa: false,
    status: 'active',
  },
  'complete@seed.example.test': {
    email: 'complete@seed.example.test',
    role: 'candidate',
    portal: 'candidate',
    name: 'Complete Candidate',
    requiresMfa: false,
    status: 'active',
  },
  'alex.turner@seed.example.test': {
    email: 'alex.turner@seed.example.test',
    role: 'candidate',
    portal: 'candidate',
    name: 'Alex Turner',
    requiresMfa: false,
    status: 'active',
  },
  'suspended@example.com': {
    email: 'suspended@example.com',
    role: 'company_admin',
    portal: 'company',
    name: 'Suspended Account',
    status: 'suspended',
  },
  'admin.suspended@seed.example.test': {
    email: 'admin.suspended@seed.example.test',
    role: 'platform_admin',
    portal: 'admin',
    name: 'Suspended Admin',
    status: 'suspended',
  },
};

export function devIdentifyLogin(email: string) {
  const user = DEV_LOGIN_ACCOUNTS[email.trim().toLowerCase()];
  if (!user) {
    return { recognized: false as const };
  }
  return {
    recognized: true as const,
    role: user.role,
    portal: user.portal,
    name: user.name,
    orgName: null as string | null,
    mfaRequired: Boolean(user.requiresMfa),
    accountStatus: (user.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
  };
}
