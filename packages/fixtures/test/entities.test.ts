import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrganizations,
  SUPERADMIN_ID,
  ASTER_RIDGE_ID,
  BRINDLE_CO_ID,
  CRESTVIEW_ID,
  TRIAL_DURATION_DAYS,
} from '../dist/entities/organizations.js';
import {
  getUsers,
  getPlatformAdmins,
  getCompanyAdmins,
  getCandidates,
  ASTER_CANDIDATE_STATE_DISTRIBUTION,
  BRINDLE_CANDIDATE_STATE_DISTRIBUTION,
} from '../dist/entities/users.js';

describe('HelloSmart Test Data Matrix Entities ([6.1])', () => {
  const refDate = new Date('2026-10-23T00:00:00Z');
  const orgs = getOrganizations(refDate);
  const aster = orgs.find((o) => o.slug === 'aster-ridge');
  const brindle = orgs.find((o) => o.slug === 'brindle-co');
  const crestview = orgs.find((o) => o.slug === 'crestview-suspended');

  describe('Organizations & Entitlements', () => {
    it('defines exactly three sample companies', () => {
      assert.strictEqual(orgs.length, 3);
      assert.ok(aster, 'Aster Ridge must exist');
      assert.ok(brindle, 'Brindle & Co must exist');
      assert.ok(crestview, 'Crestview Financial must exist');
    });

    it('Aster Ridge matches paid_active specifications', () => {
      assert.strictEqual(aster?.name, 'Aster Ridge Technologies');
      assert.strictEqual(aster?.slug, 'aster-ridge');
      assert.strictEqual(aster?.status, 'paid_active');
      assert.strictEqual(aster?.custom_domain, 'hire.asterridge.com');
      assert.strictEqual(aster?.retention_days, 90);
      assert.strictEqual(aster?.created_by, SUPERADMIN_ID);

      // Entitlements
      assert.strictEqual(aster?.entitlements.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(aster?.entitlements.max_templates, 10);
      assert.strictEqual(aster?.entitlements.max_candidates, 100);
      assert.strictEqual(aster?.entitlements.trial_ends_at, null);
      assert.strictEqual(aster?.entitlements.pending_invite_multiplier, 2.0);
      assert.strictEqual(aster?.entitlements.flags['cloud'], true);
      assert.strictEqual(aster?.entitlements.flags['chat'], true);
      assert.strictEqual(aster?.entitlements.flags['custom_domain'], true);
    });

    it('Brindle & Co matches trial_active and 14-day trial specifications', () => {
      assert.strictEqual(brindle?.name, 'Brindle & Co');
      assert.strictEqual(brindle?.slug, 'brindle-co');
      assert.strictEqual(brindle?.status, 'trial_active');
      assert.strictEqual(brindle?.custom_domain, null);
      assert.strictEqual(brindle?.retention_days, 30);
      assert.strictEqual(brindle?.created_by, SUPERADMIN_ID);

      // Entitlements
      assert.strictEqual(brindle?.entitlements.org_id, BRINDLE_CO_ID);
      assert.strictEqual(brindle?.entitlements.max_templates, 2);
      assert.strictEqual(brindle?.entitlements.max_candidates, 10);
      assert.strictEqual(brindle?.entitlements.flags['chat'], true);

      // 14-day trial derivation test
      assert.ok(brindle?.entitlements.trial_started_at);
      assert.ok(brindle?.entitlements.trial_ends_at);
      const diffMs =
        brindle.entitlements.trial_ends_at.getTime() -
        brindle.entitlements.trial_started_at.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, TRIAL_DURATION_DAYS);
      assert.strictEqual(diffDays, 14);
    });

    it('Crestview Financial matches suspended negative-test specifications', () => {
      assert.strictEqual(crestview?.name, 'Crestview Financial');
      assert.strictEqual(crestview?.slug, 'crestview-suspended');
      assert.strictEqual(crestview?.status, 'suspended');
      assert.strictEqual(crestview?.custom_domain, null);
      assert.strictEqual(crestview?.retention_days, 90);
      assert.strictEqual(crestview?.created_by, SUPERADMIN_ID);

      // Entitlements
      assert.strictEqual(crestview?.entitlements.org_id, CRESTVIEW_ID);
      assert.strictEqual(crestview?.entitlements.max_templates, 1);
      assert.strictEqual(crestview?.entitlements.max_candidates, 5);
      assert.strictEqual(crestview?.entitlements.trial_ends_at, null);
    });
  });

  describe('Users & Role Boundaries', () => {
    it('defines superadmin platform admin with MFA enabled and org_id = null', () => {
      const platformAdmins = getPlatformAdmins(refDate);
      assert.strictEqual(platformAdmins.length, 1);
      const superadmin = platformAdmins[0]!;
      assert.strictEqual(superadmin.id, SUPERADMIN_ID);
      assert.strictEqual(superadmin.email, 'superadmin@hellosmart.ai');
      assert.strictEqual(superadmin.role, 'platform_admin');
      assert.strictEqual(superadmin.org_id, null, 'Platform admin must have org_id NULL');
      assert.strictEqual(superadmin.status, 'active');
      assert.ok(superadmin.mfa_secret_ref, 'MFA must be enabled for platform admin');
    });

    it('defines company admins for all three organizations', () => {
      const companyAdmins = getCompanyAdmins(refDate);
      assert.strictEqual(companyAdmins.length, 3);

      const asterAdmin = companyAdmins.find((u) => u.email === 'admin@asterridge.com');
      assert.ok(asterAdmin);
      assert.strictEqual(asterAdmin.org_id, ASTER_RIDGE_ID);
      assert.strictEqual(asterAdmin.status, 'active');
      assert.strictEqual(asterAdmin.role, 'company_admin');

      const brindleAdmin = companyAdmins.find((u) => u.email === 'trialadmin@brindle.co');
      assert.ok(brindleAdmin);
      assert.strictEqual(brindleAdmin.org_id, BRINDLE_CO_ID);
      assert.strictEqual(brindleAdmin.status, 'active');
      assert.strictEqual(brindleAdmin.role, 'company_admin');

      const crestviewAdmin = companyAdmins.find((u) => u.email === 'admin@crestview.test');
      assert.ok(crestviewAdmin);
      assert.strictEqual(crestviewAdmin.org_id, CRESTVIEW_ID);
      assert.strictEqual(crestviewAdmin.status, 'active');
      assert.strictEqual(crestviewAdmin.role, 'company_admin');
    });

    it('Aster Ridge has exactly 100 candidates covering active, invited, suspended, deleted', () => {
      const allCandidates = getCandidates(refDate);
      const asterCandidates = allCandidates.filter((c) => c.org_id === ASTER_RIDGE_ID);

      assert.strictEqual(asterCandidates.length, 100);

      const active = asterCandidates.filter((c) => c.status === 'active');
      const invited = asterCandidates.filter((c) => c.status === 'invited');
      const suspended = asterCandidates.filter((c) => c.status === 'suspended');
      const deleted = asterCandidates.filter((c) => c.status === 'deleted');

      assert.strictEqual(active.length, ASTER_CANDIDATE_STATE_DISTRIBUTION.active);
      assert.strictEqual(invited.length, ASTER_CANDIDATE_STATE_DISTRIBUTION.invited);
      assert.strictEqual(suspended.length, ASTER_CANDIDATE_STATE_DISTRIBUTION.suspended);
      assert.strictEqual(deleted.length, ASTER_CANDIDATE_STATE_DISTRIBUTION.deleted);

      // Verify soft deletion
      for (const d of deleted) {
        assert.ok(d.deleted_at !== null, 'Deleted candidates must have deleted_at set');
      }

      // Verify invited candidates have password reset required
      for (const inv of invited) {
        assert.strictEqual(inv.must_reset_password, true);
        assert.strictEqual(inv.email_verified_at, null);
      }
    });

    it('Brindle & Co has exactly 10 candidates covering active, invited, suspended, deleted', () => {
      const allCandidates = getCandidates(refDate);
      const brindleCandidates = allCandidates.filter((c) => c.org_id === BRINDLE_CO_ID);

      assert.strictEqual(brindleCandidates.length, 10);

      const active = brindleCandidates.filter((c) => c.status === 'active');
      const invited = brindleCandidates.filter((c) => c.status === 'invited');
      const suspended = brindleCandidates.filter((c) => c.status === 'suspended');
      const deleted = brindleCandidates.filter((c) => c.status === 'deleted');

      assert.strictEqual(active.length, BRINDLE_CANDIDATE_STATE_DISTRIBUTION.active);
      assert.strictEqual(invited.length, BRINDLE_CANDIDATE_STATE_DISTRIBUTION.invited);
      assert.strictEqual(suspended.length, BRINDLE_CANDIDATE_STATE_DISTRIBUTION.suspended);
      assert.strictEqual(deleted.length, BRINDLE_CANDIDATE_STATE_DISTRIBUTION.deleted);

      // Verify soft deletion
      for (const d of deleted) {
        assert.ok(d.deleted_at !== null, 'Deleted candidates must have deleted_at set');
      }
    });

    it('all user and candidate IDs are valid deterministic UUIDv5', () => {
      const allUsers = getUsers(refDate);
      assert.strictEqual(allUsers.length, 114);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (const u of allUsers) {
        assert.match(u.id, uuidRegex, `User ${u.email} must have a valid UUIDv5`);
        if (u.role === 'platform_admin') {
          assert.strictEqual(u.org_id, null);
        } else {
          assert.ok(
            u.org_id === ASTER_RIDGE_ID || u.org_id === BRINDLE_CO_ID || u.org_id === CRESTVIEW_ID,
            `User ${u.email} must belong to a valid org`,
          );
        }
      }
    });
  });
});
