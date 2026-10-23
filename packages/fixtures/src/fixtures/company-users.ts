import { deterministicUuid, normaliseEmail, relativeDate } from '../lib/keys.ts';

export interface CompanyUserFixture {
  key: string;
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: 'company_admin';
  status: 'invited' | 'active' | 'suspended' | 'deleted';
  email_verified_at: Date | null;
  must_reset_password: boolean;
  failed_logins: number;
  locked_until: Date | null;
  deleted_at: Date | null;
}

export function getCompanyUsers(
  refDate: Date,
  orgs: { asterId: string; brindleId: string },
): CompanyUserFixture[] {
  const { asterId, brindleId } = orgs;

  return [
    // --- Aster Ridge Technologies ---
    {
      key: 'aster_owner',
      id: deterministicUuid('user', 'aster_owner'),
      org_id: asterId,
      email: normaliseEmail('owner@aster.seed.example.test'),
      name: 'Aster Owner',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -25),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_admin2',
      id: deterministicUuid('user', 'aster_admin2'),
      org_id: asterId,
      email: normaliseEmail('admin2@aster.seed.example.test'),
      name: 'Aster Admin Two',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -20),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_hm',
      id: deterministicUuid('user', 'aster_hm'),
      org_id: asterId,
      email: normaliseEmail('hiring.manager@aster.seed.example.test'),
      name: 'Aster Hiring Manager',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -15),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_invited',
      id: deterministicUuid('user', 'aster_invited'),
      org_id: asterId,
      email: normaliseEmail('invited@aster.seed.example.test'),
      name: 'Aster Invited Admin',
      role: 'company_admin',
      status: 'invited',
      email_verified_at: null,
      must_reset_password: true,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_suspended',
      id: deterministicUuid('user', 'aster_suspended'),
      org_id: asterId,
      email: normaliseEmail('suspended@aster.seed.example.test'),
      name: 'Aster Suspended Admin',
      role: 'company_admin',
      status: 'suspended',
      email_verified_at: relativeDate(refDate, -10),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_deactivated',
      id: deterministicUuid('user', 'aster_deactivated'),
      org_id: asterId,
      email: normaliseEmail('deactivated@aster.seed.example.test'),
      name: 'Aster Deactivated Admin',
      role: 'company_admin',
      status: 'deleted',
      email_verified_at: relativeDate(refDate, -30),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: relativeDate(refDate, -2),
    },
    {
      key: 'aster_unverified',
      id: deterministicUuid('user', 'aster_unverified'),
      org_id: asterId,
      email: normaliseEmail('unverified@aster.seed.example.test'),
      name: 'Aster Unverified Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: null,
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'aster_locked',
      id: deterministicUuid('user', 'aster_locked'),
      org_id: asterId,
      email: normaliseEmail('locked@aster.seed.example.test'),
      name: 'Aster Locked Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -10),
      must_reset_password: false,
      failed_logins: 10,
      locked_until: relativeDate(refDate, 1),
      deleted_at: null,
    },

    // --- Brindle & Co. Logistics ---
    {
      key: 'brindle_owner',
      id: deterministicUuid('user', 'brindle_owner'),
      org_id: brindleId,
      email: normaliseEmail('owner@brindle.seed.example.test'),
      name: 'Brindle Owner',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -10),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'brindle_admin2',
      id: deterministicUuid('user', 'brindle_admin2'),
      org_id: brindleId,
      email: normaliseEmail('admin2@brindle.seed.example.test'),
      name: 'Brindle Admin Two',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -8),
      must_reset_password: false,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
    {
      key: 'brindle_invited_expired',
      id: deterministicUuid('user', 'brindle_invited_expired'),
      org_id: brindleId,
      email: normaliseEmail('invited.expired@brindle.seed.example.test'),
      name: 'Brindle Expired Invite',
      role: 'company_admin',
      status: 'invited',
      email_verified_at: null,
      must_reset_password: true,
      failed_logins: 0,
      locked_until: null,
      deleted_at: null,
    },
  ];
}
