import { deterministicUuid, relativeDate } from '../lib/keys.js';

/**
 * Standard duration for company trial periods in days.
 */
export const TRIAL_DURATION_DAYS = 14;

export interface EntitlementEntity {
  org_id: string;
  max_templates: number;
  max_candidates: number;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  pending_invite_multiplier: number;
  flags: Record<string, boolean | string | number>;
  updated_at?: Date;
}

export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  status: 'provisioned' | 'trial_active' | 'trial_expired' | 'paid_active' | 'suspended';
  logo_key: string | null;
  custom_domain: string | null;
  retention_days: number;
  created_by: string; // Foreign key references platform admin (superadmin)
  created_at?: Date;
  updated_at?: Date;
  entitlements: EntitlementEntity;
}

export const SUPERADMIN_ID = deterministicUuid('user', 'superadmin@hellosmart.ai');
export const ASTER_RIDGE_ID = deterministicUuid('org', 'aster-ridge');
export const BRINDLE_CO_ID = deterministicUuid('org', 'brindle-co');
export const CRESTVIEW_ID = deterministicUuid('org', 'crestview-suspended');

/**
 * Generates the test data matrix for Aster Ridge Technologies (Paid Active),
 * Brindle & Co (Trial Active), and Crestview Financial (Suspended),
 * adhering strictly to 0001_tenancy_foundation.sql.
 *
 * @param refDate Anchor date for deterministic date calculations.
 * @param superadminId Platform admin UUID responsible for creating the organizations.
 */
export function getOrganizations(
  refDate: Date = new Date('2026-10-23T00:00:00Z'),
  superadminId: string = SUPERADMIN_ID,
): OrganizationEntity[] {
  // Brindle trial window derived using single TRIAL_DURATION_DAYS constant
  const brindleTrialStart = relativeDate(refDate, 0);
  const brindleTrialEnd = relativeDate(brindleTrialStart, TRIAL_DURATION_DAYS);

  return [
    {
      id: ASTER_RIDGE_ID,
      name: 'Aster Ridge Technologies',
      slug: 'aster-ridge',
      status: 'paid_active',
      logo_key: 'logos/aster.png',
      custom_domain: 'hire.asterridge.com',
      retention_days: 90,
      created_by: superadminId,
      created_at: relativeDate(refDate, -60),
      updated_at: relativeDate(refDate, -5),
      entitlements: {
        org_id: ASTER_RIDGE_ID,
        max_templates: 10,
        max_candidates: 100,
        trial_started_at: null,
        trial_ends_at: null,
        pending_invite_multiplier: 2.0,
        flags: { cloud: true, chat: true, custom_domain: true },
        updated_at: relativeDate(refDate, -5),
      },
    },
    {
      id: BRINDLE_CO_ID,
      name: 'Brindle & Co',
      slug: 'brindle-co',
      status: 'trial_active',
      logo_key: null,
      custom_domain: null,
      retention_days: 30,
      created_by: superadminId,
      created_at: brindleTrialStart,
      updated_at: brindleTrialStart,
      entitlements: {
        org_id: BRINDLE_CO_ID,
        max_templates: 2,
        max_candidates: 10,
        trial_started_at: brindleTrialStart,
        trial_ends_at: brindleTrialEnd,
        pending_invite_multiplier: 2.0,
        flags: { chat: true },
        updated_at: brindleTrialStart,
      },
    },
    {
      id: CRESTVIEW_ID,
      name: 'Crestview Financial',
      slug: 'crestview-suspended',
      status: 'suspended',
      logo_key: null,
      custom_domain: null,
      retention_days: 90,
      created_by: superadminId,
      created_at: relativeDate(refDate, -90),
      updated_at: relativeDate(refDate, -10),
      entitlements: {
        org_id: CRESTVIEW_ID,
        max_templates: 1,
        max_candidates: 5,
        trial_started_at: null,
        trial_ends_at: null,
        pending_invite_multiplier: 2.0,
        flags: {},
        updated_at: relativeDate(refDate, -10),
      },
    },
  ];
}
