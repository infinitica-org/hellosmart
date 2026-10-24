import { deterministicUuid, normaliseEmail, relativeDate } from '../lib/keys.js';
import { SUPERADMIN_ID, ASTER_RIDGE_ID, BRINDLE_CO_ID } from './organizations.js';

export interface UserEntity {
  id: string;
  org_id: string | null; // NULL only for platform roles (enforced by CHECK platform_has_no_org)
  email: string;
  name: string;
  role: 'platform_admin' | 'company_admin' | 'candidate';
  status: 'invited' | 'active' | 'suspended' | 'deleted';
  email_verified_at: Date | null;
  must_reset_password: boolean;
  mfa_secret_ref: string | null;
  password_hash: string | null;
  failed_logins: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

// Dev mock password hash for seeded accounts (obviously fake, non-production)
export const SEED_DEV_PASSWORD_MOCK = 'dev_mock_argon2id_hash_not_for_production';

export const ASTER_CANDIDATE_STATE_DISTRIBUTION = {
  active: 70,
  invited: 15,
  suspended: 10,
  deleted: 5,
  total: 100,
} as const;

export const BRINDLE_CANDIDATE_STATE_DISTRIBUTION = {
  active: 4,
  invited: 3,
  suspended: 1,
  deleted: 2,
  total: 10,
} as const;

/**
 * Returns the platform admin user entity (superadmin@hellosmart.ai).
 */
export function getPlatformAdmins(refDate: Date = new Date('2026-10-23T00:00:00Z')): UserEntity[] {
  return [
    {
      id: SUPERADMIN_ID,
      org_id: null,
      email: normaliseEmail('superadmin@hellosmart.ai'),
      name: 'Super Admin',
      role: 'platform_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -30),
      must_reset_password: false,
      mfa_secret_ref: 'secrets/seed-superadmin-mfa',
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -1),
      created_at: relativeDate(refDate, -90),
      deleted_at: null,
    },
  ];
}

/**
 * Returns the primary company admin users:
 * - admin@asterridge.com (Aster Ridge Technologies)
 * - trialadmin@brindle.co (Brindle & Co)
 */
export function getCompanyAdmins(refDate: Date = new Date('2026-10-23T00:00:00Z')): UserEntity[] {
  return [
    {
      id: deterministicUuid('user', 'admin@asterridge.com'),
      org_id: ASTER_RIDGE_ID,
      email: normaliseEmail('admin@asterridge.com'),
      name: 'Aster Ridge Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -20),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -2),
      created_at: relativeDate(refDate, -60),
      deleted_at: null,
    },
    {
      id: deterministicUuid('user', 'trialadmin@brindle.co'),
      org_id: BRINDLE_CO_ID,
      email: normaliseEmail('trialadmin@brindle.co'),
      name: 'Brindle Trial Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -14),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -3),
      created_at: relativeDate(refDate, -14),
      deleted_at: null,
    },
  ];
}

/**
 * Generates candidate user fixtures for a given company with exact counts per state.
 */
function generateCompanyCandidates(options: {
  orgId: string;
  orgSlug: string;
  distribution: { active: number; invited: number; suspended: number; deleted: number };
  refDate: Date;
}): UserEntity[] {
  const { orgId, orgSlug, distribution, refDate } = options;
  const candidates: UserEntity[] = [];
  let index = 1;

  const pad = (n: number) => n.toString().padStart(orgSlug === 'aster-ridge' ? 3 : 2, '0');

  // 1. Active Candidates
  for (let i = 0; i < distribution.active; i++) {
    const num = pad(index++);
    const email = normaliseEmail(`candidate.${orgSlug}.${num}@example.com`);
    candidates.push({
      id: deterministicUuid('candidate', email),
      org_id: orgId,
      email,
      name: `Candidate ${orgSlug} ${num} (Active)`,
      role: 'candidate',
      status: 'active',
      email_verified_at: relativeDate(refDate, -10),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -1),
      created_at: relativeDate(refDate, -20),
      deleted_at: null,
    });
  }

  // 2. Invited Candidates
  for (let i = 0; i < distribution.invited; i++) {
    const num = pad(index++);
    const email = normaliseEmail(`candidate.${orgSlug}.${num}@example.com`);
    candidates.push({
      id: deterministicUuid('candidate', email),
      org_id: orgId,
      email,
      name: `Candidate ${orgSlug} ${num} (Invited)`,
      role: 'candidate',
      status: 'invited',
      email_verified_at: null,
      must_reset_password: true,
      mfa_secret_ref: null,
      password_hash: null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      created_at: relativeDate(refDate, -2),
      deleted_at: null,
    });
  }

  // 3. Suspended Candidates
  for (let i = 0; i < distribution.suspended; i++) {
    const num = pad(index++);
    const email = normaliseEmail(`candidate.${orgSlug}.${num}@example.com`);
    candidates.push({
      id: deterministicUuid('candidate', email),
      org_id: orgId,
      email,
      name: `Candidate ${orgSlug} ${num} (Suspended)`,
      role: 'candidate',
      status: 'suspended',
      email_verified_at: relativeDate(refDate, -15),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -5),
      created_at: relativeDate(refDate, -25),
      deleted_at: null,
    });
  }

  // 4. Deleted Candidates (soft-delete with deleted_at timestamp)
  for (let i = 0; i < distribution.deleted; i++) {
    const num = pad(index++);
    const email = normaliseEmail(`candidate.${orgSlug}.${num}@example.com`);
    candidates.push({
      id: deterministicUuid('candidate', email),
      org_id: orgId,
      email,
      name: `Candidate ${orgSlug} ${num} (Deleted)`,
      role: 'candidate',
      status: 'deleted',
      email_verified_at: relativeDate(refDate, -20),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: SEED_DEV_PASSWORD_MOCK,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -8),
      created_at: relativeDate(refDate, -30),
      deleted_at: relativeDate(refDate, -4),
    });
  }

  return candidates;
}

/**
 * Returns candidates for Aster Ridge Technologies (exactly 100) and Brindle & Co (exactly 10),
 * covering active, invited, suspended, and deleted states for both companies.
 */
export function getCandidates(refDate: Date = new Date('2026-10-23T00:00:00Z')): UserEntity[] {
  const asterCandidates = generateCompanyCandidates({
    orgId: ASTER_RIDGE_ID,
    orgSlug: 'aster-ridge',
    distribution: ASTER_CANDIDATE_STATE_DISTRIBUTION,
    refDate,
  });

  const brindleCandidates = generateCompanyCandidates({
    orgId: BRINDLE_CO_ID,
    orgSlug: 'brindle-co',
    distribution: BRINDLE_CANDIDATE_STATE_DISTRIBUTION,
    refDate,
  });

  return [...asterCandidates, ...brindleCandidates];
}

/**
 * Returns all user fixtures: platform admins, company admins, and candidates.
 */
export function getUsers(refDate: Date = new Date('2026-10-23T00:00:00Z')): UserEntity[] {
  return [...getPlatformAdmins(refDate), ...getCompanyAdmins(refDate), ...getCandidates(refDate)];
}
