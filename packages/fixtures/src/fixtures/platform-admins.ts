import { deterministicUuid, normaliseEmail, relativeDate } from '../lib/keys.ts';

export interface PlatformAdminFixture {
  key: string;
  id: string;
  email: string;
  name: string;
  role: 'platform_admin';
  org_id: null;
  status: 'active' | 'suspended';
  email_verified_at: Date;
  must_reset_password: boolean;
  mfa_secret_ref: string;
}

export function getPlatformAdmins(refDate: Date): PlatformAdminFixture[] {
  return [
    {
      key: 'admin_super',
      id: deterministicUuid('user', 'admin_super'),
      email: normaliseEmail('admin.super@seed.example.test'),
      name: 'Super Admin',
      role: 'platform_admin',
      org_id: null,
      status: 'active',
      email_verified_at: relativeDate(refDate, -30),
      must_reset_password: false,
      mfa_secret_ref: 'secrets/seed-platform-admin-mfa-test', // Fake non-prod MFA secret ref (AWS Secrets Manager mock)
    },
    {
      key: 'admin_support',
      id: deterministicUuid('user', 'admin_support'),
      email: normaliseEmail('admin.support@seed.example.test'),
      name: 'Support Admin',
      role: 'platform_admin',
      org_id: null,
      status: 'active',
      email_verified_at: relativeDate(refDate, -20),
      must_reset_password: false,
      mfa_secret_ref: 'secrets/seed-platform-admin-mfa-test',
    },
    {
      key: 'admin_suspended',
      id: deterministicUuid('user', 'admin_suspended'),
      email: normaliseEmail('admin.suspended@seed.example.test'),
      name: 'Suspended Admin',
      role: 'platform_admin',
      org_id: null,
      status: 'suspended',
      email_verified_at: relativeDate(refDate, -15),
      must_reset_password: false,
      mfa_secret_ref: 'secrets/seed-platform-admin-mfa-test',
    },
  ];
}
