import { deterministicUuid, normaliseEmail, relativeDate } from '../lib/keys.js';
import { SUPERADMIN_ID, ASTER_RIDGE_ID, BRINDLE_CO_ID, CRESTVIEW_ID } from './organizations.js';

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

export interface UserEntityOptions {
  passwordHash?: string | null;
  platformAdminMfaSecretRef?: string | null;
}

// Well-known loginable account emails (Task 13.1)
export const LOGINABLE_SUPERADMIN_EMAIL = 'superadmin@hellosmart.ai';
export const LOGINABLE_ASTER_ADMIN_EMAIL = 'admin@asterridge.com';
export const LOGINABLE_BRINDLE_ADMIN_EMAIL = 'trialadmin@brindle.co';
export const LOGINABLE_CANDIDATE_EMAIL = 'candidate.aster-ridge.001@example.com';

// Well-known negative-test sample emails (Task 13.1)
export const NEGATIVE_SUSPENDED_CANDIDATE_EMAIL = 'candidate.aster-ridge.086@example.com';
export const NEGATIVE_DELETED_CANDIDATE_EMAIL = 'candidate.aster-ridge.096@example.com';
export const NEGATIVE_CRESTVIEW_ADMIN_EMAIL = 'admin@crestview.test';

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
export function getPlatformAdmins(
  refDate: Date = new Date('2026-10-23T00:00:00Z'),
  options?: UserEntityOptions,
): UserEntity[] {
  return [
    {
      id: SUPERADMIN_ID,
      org_id: null,
      email: normaliseEmail(LOGINABLE_SUPERADMIN_EMAIL),
      name: 'Super Admin',
      role: 'platform_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -30),
      must_reset_password: false,
      mfa_secret_ref: options?.platformAdminMfaSecretRef ?? 'secrets/seed-superadmin-mfa',
      password_hash: options?.passwordHash ?? null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -1),
      created_at: relativeDate(refDate, -90),
      deleted_at: null,
    },
  ];
}

/**
 * Returns company admin users:
 * - admin@asterridge.com (Aster Ridge Technologies - paid_active) [loginable]
 * - trialadmin@brindle.co (Brindle & Co - trial_active) [loginable]
 * - admin@crestview.test (Crestview Financial - suspended) [negative-test sample]
 */
export function getCompanyAdmins(
  refDate: Date = new Date('2026-10-23T00:00:00Z'),
  options?: UserEntityOptions,
): UserEntity[] {
  return [
    {
      id: deterministicUuid('user', LOGINABLE_ASTER_ADMIN_EMAIL),
      org_id: ASTER_RIDGE_ID,
      email: normaliseEmail(LOGINABLE_ASTER_ADMIN_EMAIL),
      name: 'Aster Ridge Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -20),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: options?.passwordHash ?? null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -2),
      created_at: relativeDate(refDate, -60),
      deleted_at: null,
    },
    {
      id: deterministicUuid('user', LOGINABLE_BRINDLE_ADMIN_EMAIL),
      org_id: BRINDLE_CO_ID,
      email: normaliseEmail(LOGINABLE_BRINDLE_ADMIN_EMAIL),
      name: 'Brindle Trial Admin',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -14),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: options?.passwordHash ?? null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -3),
      created_at: relativeDate(refDate, -14),
      deleted_at: null,
    },
    {
      id: deterministicUuid('user', NEGATIVE_CRESTVIEW_ADMIN_EMAIL),
      org_id: CRESTVIEW_ID,
      email: normaliseEmail(NEGATIVE_CRESTVIEW_ADMIN_EMAIL),
      name: 'Crestview Admin (Suspended Org)',
      role: 'company_admin',
      status: 'active',
      email_verified_at: relativeDate(refDate, -30),
      must_reset_password: false,
      mfa_secret_ref: null,
      password_hash: options?.passwordHash ?? null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -15),
      created_at: relativeDate(refDate, -90),
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
  userOptions?: UserEntityOptions | undefined;
}): UserEntity[] {
  const { orgId, orgSlug, distribution, refDate, userOptions } = options;
  const candidates: UserEntity[] = [];
  let index = 1;

  const pad = (n: number) => n.toString().padStart(orgSlug === 'aster-ridge' ? 3 : 2, '0');

  // 1. Active Candidates (all active candidates receive the seed-resolved password hash)
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
      password_hash: userOptions?.passwordHash ?? null,
      failed_logins: 0,
      locked_until: null,
      last_login_at: relativeDate(refDate, -1),
      created_at: relativeDate(refDate, -20),
      deleted_at: null,
    });
  }

  // 2. Invited Candidates (password_hash is NULL until invite link onboarding)
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
    const isNegativeSample = email === NEGATIVE_SUSPENDED_CANDIDATE_EMAIL;

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
      password_hash: isNegativeSample ? (userOptions?.passwordHash ?? null) : null,
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
    const isNegativeSample = email === NEGATIVE_DELETED_CANDIDATE_EMAIL;

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
      password_hash: isNegativeSample ? (userOptions?.passwordHash ?? null) : null,
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
export function getCandidates(
  refDate: Date = new Date('2026-10-23T00:00:00Z'),
  options?: UserEntityOptions,
): UserEntity[] {
  const asterCandidates = generateCompanyCandidates({
    orgId: ASTER_RIDGE_ID,
    orgSlug: 'aster-ridge',
    distribution: ASTER_CANDIDATE_STATE_DISTRIBUTION,
    refDate,
    userOptions: options,
  });

  const brindleCandidates = generateCompanyCandidates({
    orgId: BRINDLE_CO_ID,
    orgSlug: 'brindle-co',
    distribution: BRINDLE_CANDIDATE_STATE_DISTRIBUTION,
    refDate,
    userOptions: options,
  });

  return [...asterCandidates, ...brindleCandidates];
}

/**
 * Returns all user fixtures: platform admins, company admins, and candidates.
 */
export function getUsers(
  refDate: Date = new Date('2026-10-23T00:00:00Z'),
  options?: UserEntityOptions,
): UserEntity[] {
  return [
    ...getPlatformAdmins(refDate, options),
    ...getCompanyAdmins(refDate, options),
    ...getCandidates(refDate, options),
  ];
}
