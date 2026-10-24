import { deterministicUuid, relativeDate } from '../lib/keys.ts';

export interface EntitlementsFixture {
  org_id: string;
  max_templates: number;
  max_candidates: number;
  trial_ends_at: Date | null;
  pending_invite_multiplier: number;
  flags: Record<string, any>;
}

export interface OrganizationFixture {
  key: string;
  id: string;
  name: string;
  slug: string;
  status: 'provisioned' | 'trial_active' | 'trial_expired' | 'paid_active' | 'suspended';
  logo_key: string | null;
  custom_domain: string | null;
  retention_days: number;
  created_by: string; // admin_super.id
  entitlements: EntitlementsFixture;
}

export function getOrganizations(refDate: Date, adminSuperId: string): OrganizationFixture[] {
  const asterId = deterministicUuid('org', 'aster');
  const brindleId = deterministicUuid('org', 'brindle');

  return [
    {
      key: 'aster',
      id: asterId,
      name: 'Aster Ridge Technologies',
      slug: 'aster-ridge',
      status: 'paid_active',
      logo_key: 'logos/aster.png',
      custom_domain: 'assess.aster.example.test',
      retention_days: 90,
      created_by: adminSuperId,
      entitlements: {
        org_id: asterId,
        max_templates: 5,
        max_candidates: 25,
        trial_ends_at: null,
        pending_invite_multiplier: 2.0,
        flags: { cloud: true, chat: true },
      },
    },
    {
      key: 'brindle',
      id: brindleId,
      name: 'Brindle & Co. Logistics',
      slug: 'brindle-co',
      status: 'trial_active',
      logo_key: null,
      custom_domain: null,
      retention_days: 30,
      created_by: adminSuperId,
      entitlements: {
        org_id: brindleId,
        max_templates: 1,
        max_candidates: 5,
        trial_ends_at: relativeDate(refDate, 14),
        pending_invite_multiplier: 1.5,
        flags: { chat: true },
      },
    },
  ];
}
