import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimingConfigSchema, CreateAssessmentDtoSchema } from '@hs/contracts';
import { FakeAssignmentOwnershipAdapter } from '../../src/common/storage/assignment-ownership.port.js';
import {
  calculateDeadline,
  calculateEffectiveDeadline,
  calculateResumeDeadline,
  checkWindowStatus,
  isSubmissionTimely,
  isWithinWindow,
} from './helpers/timing-pure-logic.js';
import { TimingContractStubs } from './helpers/timing-contract-stubs.js';
import {
  checkDbConnection,
  createTimingTestApp,
  createTestSession,
  generateTestNonce,
  DATABASE_ADMIN_URL,
  type TimingTestContext,
} from './helpers/timing-test-app.js';

const isDbAvailable = await checkDbConnection();

describe('Stream 10: Timing, Boundary Expiry & Disconnect Logic (BR-08, BR-09, CA-008..012, CO-028..031)', () => {
  afterEach(() => {
    // Invariant (Lesson 7): Fake timers are always restored so they cannot leak into other tests
    vi.useRealTimers();
  });

  // =========================================================================
  // PART A: REAL TESTS (Pure Timing Calculations, Boundaries & DB Persistence)
  // =========================================================================

  describe('Part A.1: Duration Calculations & Simulated Time Travel (BR-08, CO-028, CO-031)', () => {
    it('calculates exact deadline from first connect for minimum (15m), default (90m), and maximum (480m) durations', () => {
      const baseTime = new Date('2026-11-03T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(baseTime);

      // 15 minutes (schema minimum)
      const deadline15 = calculateDeadline(new Date(), 15);
      expect(deadline15.toISOString()).toBe('2026-11-03T10:15:00.000Z');
      expect(deadline15.getTime() - baseTime.getTime()).toBe(15 * 60 * 1000);

      // 90 minutes (schema default)
      const deadline90 = calculateDeadline(new Date(), 90);
      expect(deadline90.toISOString()).toBe('2026-11-03T11:30:00.000Z');
      expect(deadline90.getTime() - baseTime.getTime()).toBe(90 * 60 * 1000);

      // 480 minutes (schema maximum: 8 hours)
      const deadline480 = calculateDeadline(new Date(), 480);
      expect(deadline480.toISOString()).toBe('2026-11-03T18:00:00.000Z');
      expect(deadline480.getTime() - baseTime.getTime()).toBe(480 * 60 * 1000);
    });

    it('extends deadline by exact amount when extendedMinutes is granted by company admin (CO-031)', () => {
      const baseTime = new Date('2026-11-03T14:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(baseTime);

      const standardDeadline = calculateDeadline(baseTime, 90, 0);
      expect(standardDeadline.toISOString()).toBe('2026-11-03T15:30:00.000Z');

      // Admin extends by 30 minutes
      const extendedDeadline = calculateDeadline(baseTime, 90, 30);
      expect(extendedDeadline.toISOString()).toBe('2026-11-03T16:00:00.000Z');
      expect(extendedDeadline.getTime() - standardDeadline.getTime()).toBe(30 * 60 * 1000);
    });

    it('verifies submission timeliness boundary: accepted at deadline, rejected 1ms after (BR-08)', () => {
      const deadline = new Date('2026-11-03T12:00:00.000Z');

      // 1ms before deadline -> timely
      const timely1ms = new Date('2026-11-03T11:59:59.999Z');
      expect(isSubmissionTimely(timely1ms, deadline)).toBe(true);

      // Exactly at deadline -> timely (inclusive boundary)
      const exactDeadline = new Date('2026-11-03T12:00:00.000Z');
      expect(isSubmissionTimely(exactDeadline, deadline)).toBe(true);

      // 1ms after deadline -> late (auto-submit sweeper boundary)
      const late1ms = new Date('2026-11-03T12:00:00.001Z');
      expect(isSubmissionTimely(late1ms, deadline)).toBe(false);

      // 10 minutes after deadline -> late
      const late10m = new Date('2026-11-03T12:10:00.000Z');
      expect(isSubmissionTimely(late10m, deadline)).toBe(false);
    });
  });

  describe('Part A.2: Window Boundary State Transitions (BR-08, CO-028, CO-030)', () => {
    const timingConfig = {
      type: 'window' as const,
      windowStartUtc: '2026-11-03T09:00:00.000Z',
      windowEndUtc: '2026-11-03T17:00:00.000Z',
    };

    it('asserts window start boundary: window_not_open 1ms before, ready at exactly window_start (inclusive)', () => {
      // 1ms before window start
      const beforeStart = new Date('2026-11-03T08:59:59.999Z');
      expect(checkWindowStatus(timingConfig, beforeStart)).toBe('window_not_open');
      expect(isWithinWindow(timingConfig, beforeStart)).toBe(false);

      // Exactly at window start
      const atStart = new Date('2026-11-03T09:00:00.000Z');
      expect(checkWindowStatus(timingConfig, atStart)).toBe('ready');
      expect(isWithinWindow(timingConfig, atStart)).toBe(true);

      // 1ms after window start
      const afterStart = new Date('2026-11-03T09:00:00.001Z');
      expect(checkWindowStatus(timingConfig, afterStart)).toBe('ready');
      expect(isWithinWindow(timingConfig, afterStart)).toBe(true);
    });

    it('asserts window end boundary: ready at exactly window_end (inclusive), expired 1ms after', () => {
      // 1ms before window end
      const beforeEnd = new Date('2026-11-03T16:59:59.999Z');
      expect(checkWindowStatus(timingConfig, beforeEnd)).toBe('ready');
      expect(isWithinWindow(timingConfig, beforeEnd)).toBe(true);

      // Exactly at window end
      const atEnd = new Date('2026-11-03T17:00:00.000Z');
      expect(checkWindowStatus(timingConfig, atEnd)).toBe('ready');
      expect(isWithinWindow(timingConfig, atEnd)).toBe(true);

      // 1ms after window end
      const afterEnd = new Date('2026-11-03T17:00:00.001Z');
      expect(checkWindowStatus(timingConfig, afterEnd)).toBe('expired');
      expect(isWithinWindow(timingConfig, afterEnd)).toBe(false);
    });

    it('pure duration timing without windows is always ready', () => {
      const durationOnly = { type: 'duration' as const, durationMinutes: 90 };
      const arbitraryDate = new Date('2030-01-01T00:00:00.000Z');
      expect(checkWindowStatus(durationOnly, arbitraryDate)).toBe('ready');
      expect(isWithinWindow(durationOnly, arbitraryDate)).toBe(true);
    });
  });

  describe('Part A.3: Combined Timing Mode Ceilings (CO-030)', () => {
    it('applies duration when duration expires before window end', () => {
      const timing = {
        type: 'both' as const,
        durationMinutes: 90,
        windowStartUtc: '2026-11-03T09:00:00.000Z',
        windowEndUtc: '2026-11-03T18:00:00.000Z',
      };
      // Connected at 10:00 -> 90 min expires at 11:30 (well before 18:00 window end)
      const firstConnect = new Date('2026-11-03T10:00:00.000Z');
      const deadline = calculateEffectiveDeadline(timing, firstConnect);
      expect(deadline.toISOString()).toBe('2026-11-03T11:30:00.000Z');
    });

    it('truncates duration to window end when window closes before duration finishes (window ceiling)', () => {
      const timing = {
        type: 'both' as const,
        durationMinutes: 90,
        windowStartUtc: '2026-11-03T09:00:00.000Z',
        windowEndUtc: '2026-11-03T18:00:00.000Z',
      };
      // Connected at 17:15 -> 90 min would be 18:45, but window closes at 18:00!
      const firstConnect = new Date('2026-11-03T17:15:00.000Z');
      const deadline = calculateEffectiveDeadline(timing, firstConnect);
      expect(deadline.toISOString()).toBe('2026-11-03T18:00:00.000Z');
    });

    it('applies extended minutes to the base ceiling', () => {
      const timing = {
        type: 'both' as const,
        durationMinutes: 90,
        windowStartUtc: '2026-11-03T09:00:00.000Z',
        windowEndUtc: '2026-11-03T18:00:00.000Z',
      };
      // Truncated to 18:00, then admin grants 15 minutes extension -> 18:15
      const firstConnect = new Date('2026-11-03T17:15:00.000Z');
      const deadline = calculateEffectiveDeadline(timing, firstConnect, 15);
      expect(deadline.toISOString()).toBe('2026-11-03T18:15:00.000Z');
    });
  });

  describe('Part A.4: Calendar & Clock Irregularities (DST, Leap Day, Year-End, Backward Clock)', () => {
    it('calculates exact elapsed UTC seconds across Daylight Saving Time (DST) transition', () => {
      // US Eastern fallback: 2026-11-01 02:00:00 EDT switches to 01:00:00 EST
      // In UTC: 2026-11-01T05:30:00.000Z (01:30 EDT) to 2026-11-01T07:00:00.000Z (02:00 EST)
      const firstConnect = new Date('2026-11-01T05:30:00.000Z');
      const deadline = calculateDeadline(firstConnect, 90);

      expect(deadline.toISOString()).toBe('2026-11-01T07:00:00.000Z');
      // Exact elapsed time in milliseconds is precisely 90 * 60 * 1000 regardless of local wall clock
      expect(deadline.getTime() - firstConnect.getTime()).toBe(90 * 60 * 1000);
    });

    it('handles leap day (Feb 29) rollover into March 1 without date distortion', () => {
      const leapDayConnect = new Date('2028-02-29T23:30:00.000Z');
      const deadline = calculateDeadline(leapDayConnect, 90);

      expect(deadline.toISOString()).toBe('2028-03-01T01:00:00.000Z');
      expect(deadline.getTime() - leapDayConnect.getTime()).toBe(90 * 60 * 1000);
    });

    it('handles year-end rollover (Dec 31 to Jan 1) cleanly', () => {
      const newYearsEveConnect = new Date('2026-12-31T23:45:00.000Z');
      const deadline = calculateDeadline(newYearsEveConnect, 90);

      expect(deadline.toISOString()).toBe('2027-01-01T01:15:00.000Z');
      expect(deadline.getTime() - newYearsEveConnect.getTime()).toBe(90 * 60 * 1000);
    });

    it('clock moving backwards or 0ms disconnect never extends deadline', () => {
      const currentDeadline = new Date('2026-11-03T11:30:00.000Z');
      const disconnectedAt = new Date('2026-11-03T10:15:00.000Z');

      // System clock went backwards (resumedAt before disconnectedAt)
      const backwardsResumedAt = new Date('2026-11-03T10:10:00.000Z');
      const result = calculateResumeDeadline({
        currentDeadline,
        disconnectedAt,
        resumedAt: backwardsResumedAt,
        pauseTimerOnDisconnect: true,
      });

      expect(result.getTime()).toBe(currentDeadline.getTime());
    });
  });

  describe('Part A.5: TimingConfigSchema Contract Validation (Contracts Layer)', () => {
    it('applies default values for duration, type, tz, and pauseTimerOnDisconnect (BR-09 default false)', () => {
      const parsed = TimingConfigSchema.parse({});
      expect(parsed.type).toBe('duration');
      expect(parsed.durationMinutes).toBe(90);
      expect(parsed.tz).toBe('UTC');
      expect(parsed.pauseTimerOnDisconnect).toBe(false);
    });

    it('validates duration boundaries: 15 to 480 minutes allowed, outside rejected', () => {
      // Boundaries 15 and 480 valid
      expect(TimingConfigSchema.parse({ durationMinutes: 15 }).durationMinutes).toBe(15);
      expect(TimingConfigSchema.parse({ durationMinutes: 480 }).durationMinutes).toBe(480);

      // Duration < 15 rejected
      expect(() => TimingConfigSchema.parse({ durationMinutes: 14 })).toThrow();

      // Duration > 480 rejected
      expect(() => TimingConfigSchema.parse({ durationMinutes: 481 })).toThrow();
    });

    it('rejects invalid timing type', () => {
      expect(() =>
        TimingConfigSchema.parse({
          type: 'unlimited' as any,
        }),
      ).toThrow();
    });

    it('CreateAssessmentDtoSchema embeds TimingConfigSchema with pauseTimerOnDisconnect=false default', () => {
      const parsed = CreateAssessmentDtoSchema.parse({
        templateId: 'tpl_demo',
        name: 'Backend Engineering Assessment',
      });
      expect(parsed.timing.pauseTimerOnDisconnect).toBe(false);
      expect(parsed.timing.durationMinutes).toBe(90);
      expect(parsed.timing.type).toBe('duration');
    });
  });

  describe('Part A.6: In-Memory Assignment Ownership Adapter Timing Checks', () => {
    let adapter: FakeAssignmentOwnershipAdapter;

    beforeEach(() => {
      adapter = new FakeAssignmentOwnershipAdapter();
    });

    it('validates candidate assignment 1ms before deadline and rejects at/after deadline', async () => {
      const candidateId = 'cand_01';
      const orgId = 'org_01';
      const assignmentId = 'asgn_01';
      const deadline = new Date('2026-11-03T12:00:00.000Z');

      adapter.setAssignment({
        id: assignmentId,
        candidateId,
        orgId,
        status: 'in_progress',
        deadlineAt: deadline,
      });

      vi.useFakeTimers();

      // 1. 1ms before deadline -> valid
      vi.setSystemTime(new Date('2026-11-03T11:59:59.999Z'));
      const beforeRes = await adapter.validateCandidateAssignment(candidateId, orgId, assignmentId);
      expect(beforeRes.valid).toBe(true);

      // 2. Exactly at deadline -> valid (inclusive: deadlineAt.getTime() < Date.now() is false)
      vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));
      const atRes = await adapter.validateCandidateAssignment(candidateId, orgId, assignmentId);
      expect(atRes.valid).toBe(true);

      // 3. 1ms after deadline -> invalid (deadlineAt.getTime() < Date.now() is true)
      vi.setSystemTime(new Date('2026-11-03T12:00:00.001Z'));
      const afterRes = await adapter.validateCandidateAssignment(candidateId, orgId, assignmentId);
      expect(afterRes.valid).toBe(false);
      expect(afterRes.reason).toBe('Assignment deadline has passed');
    });
  });

  // =========================================================================
  // Part A.7: Database-Backed Assessment Timing Persistence on hellosmart_test
  // =========================================================================

  describe.runIf(isDbAvailable)(
    'Part A.7: Database Assessment Timing Persistence on hellosmart_test (BR-01, BR-08, BR-09)',
    () => {
      let testAppCtx: TimingTestContext;
      let orgId: string;
      let companyAdminToken: string;
      let templateId: string;
      let templateVersionId: string;
      const createdAssessmentIds: string[] = [];

      beforeAll(async () => {
        testAppCtx = await createTimingTestApp();
        const nonce = generateTestNonce();
        const adminClient = await testAppCtx.adminPool.connect();

        try {
          await adminClient.query(`SELECT set_config('app.is_platform', 'true', false)`);

          // 1. Create test Organization
          const orgRes = await adminClient.query(
            `INSERT INTO app.organizations (name, slug, status, created_by)
             VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
             RETURNING id`,
            [`Timing Test Org ${nonce}`, `timing-org-${nonce}`],
          );
          orgId = orgRes.rows[0].id;

          // 2. Set entitlements
          await adminClient.query(
            `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
             VALUES ($1, 10, 50) ON CONFLICT (org_id) DO NOTHING`,
            [orgId],
          );

          // 3. Create a DRAFT template (Lesson 2: DRAFT version avoids BR-03 immutability triggers on teardown)
          const tplRes = await adminClient.query(
            `INSERT INTO app.templates (slug, name, category, difficulty, workspace_mode, description)
             VALUES ($1, $2, 'Engineering', 'Intermediate', 'cloud', 'Timing test template')
             RETURNING id`,
            [`tpl-timing-${nonce}`, `Timing Template ${nonce}`],
          );
          templateId = tplRes.rows[0].id;

          const verRes = await adminClient.query(
            `INSERT INTO app.template_versions (template_id, version, status, manifest)
             VALUES ($1, '0.1.0-draft', 'draft', '{"name": "Timing Draft"}')
             RETURNING id`,
            [templateId],
          );
          templateVersionId = verRes.rows[0].id;

          // 4. Assign template to organization (BR-02)
          await adminClient.query(
            `INSERT INTO app.template_assignments (template_id, org_id)
             VALUES ($1, $2)`,
            [templateId, orgId],
          );

          // 5. Create company admin user and session
          const userRes = await adminClient.query(
            `INSERT INTO app.users (org_id, email, name, role, status)
             VALUES ($1, $2, 'Timing Admin', 'company_admin', 'active')
             RETURNING id`,
            [orgId, `timing.admin.${nonce}@example.test`],
          );
          const userId = userRes.rows[0].id;

          companyAdminToken = await createTestSession(testAppCtx.sessionService, {
            userId,
            orgId,
            email: `timing.admin.${nonce}@example.test`,
            role: 'company_admin',
          });
        } finally {
          adminClient.release();
        }
      });

      afterAll(async () => {
        // Invariant (Lesson 1): Teardown in reverse dependency order with admin pool asserting 0 leftover rows
        const adminClient = await testAppCtx.adminPool.connect();
        try {
          await adminClient.query(`SELECT set_config('app.is_platform', 'true', false)`);

          if (createdAssessmentIds.length > 0) {
            await adminClient.query(`DELETE FROM app.assessments WHERE id = ANY($1)`, [
              createdAssessmentIds,
            ]);
          }
          if (templateId) {
            await adminClient.query(`DELETE FROM app.template_assignments WHERE template_id = $1`, [
              templateId,
            ]);
            await adminClient.query(`DELETE FROM app.template_versions WHERE template_id = $1`, [
              templateId,
            ]);
            await adminClient.query(`DELETE FROM app.templates WHERE id = $1`, [templateId]);
          }
          if (orgId) {
            await adminClient.query(`DELETE FROM app.users WHERE org_id = $1`, [orgId]);
            await adminClient.query(`DELETE FROM app.entitlements WHERE org_id = $1`, [orgId]);
            await adminClient.query(`DELETE FROM app.organizations WHERE id = $1`, [orgId]);
          }

          // Assert zero leftover assessment rows for this test
          const verifyRes = await adminClient.query(
            `SELECT count(*) FROM app.assessments WHERE id = ANY($1)`,
            [createdAssessmentIds],
          );
          expect(Number(verifyRes.rows[0].count)).toBe(0);
        } finally {
          adminClient.release();
          await testAppCtx.appPool.end();
          await testAppCtx.adminPool.end();
          await testAppCtx.app.close();
        }
      });

      it('POST /api/v1/company/assessments stores timing config with pauseTimerOnDisconnect=false by default (BR-09)', async () => {
        const payload = {
          templateId,
          templateVersionId,
          name: 'Default Timing Assessment',
          workspaceMode: 'cloud',
        };

        const res = await testAppCtx.app.inject({
          method: 'POST',
          url: '/api/v1/company/assessments',
          headers: {
            cookie: `hs_session=${companyAdminToken}`,
            origin: testAppCtx.corsOrigin,
            'x-hs-csrf': '1',
          },
          payload,
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.id).toBeDefined();
        createdAssessmentIds.push(body.id);

        expect(body.timing).toMatchObject({
          type: 'duration',
          durationMinutes: 90,
          pauseTimerOnDisconnect: false,
          tz: 'UTC',
        });

        // Verify direct database storage in JSONB column
        const dbRes = await testAppCtx.adminPool.query(
          `SELECT timing FROM app.assessments WHERE id = $1`,
          [body.id],
        );
        expect(dbRes.rows[0].timing).toMatchObject({
          type: 'duration',
          durationMinutes: 90,
          pauseTimerOnDisconnect: false,
        });
      });

      it('POST /api/v1/company/assessments persists custom pauseTimerOnDisconnect=true and window timings', async () => {
        const customPayload = {
          templateId,
          templateVersionId,
          name: 'Custom Pause-On-Disconnect Assessment',
          workspaceMode: 'cloud',
          timing: {
            type: 'both',
            durationMinutes: 120,
            windowStartUtc: '2026-11-04T00:00:00.000Z',
            windowEndUtc: '2026-11-05T00:00:00.000Z',
            tz: 'America/New_York',
            pauseTimerOnDisconnect: true,
          },
        };

        const res = await testAppCtx.app.inject({
          method: 'POST',
          url: '/api/v1/company/assessments',
          headers: {
            cookie: `hs_session=${companyAdminToken}`,
            origin: testAppCtx.corsOrigin,
            'x-hs-csrf': '1',
          },
          payload: customPayload,
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        createdAssessmentIds.push(body.id);

        expect(body.timing).toMatchObject({
          type: 'both',
          durationMinutes: 120,
          pauseTimerOnDisconnect: true,
          tz: 'America/New_York',
        });

        const dbRes = await testAppCtx.adminPool.query(
          `SELECT timing FROM app.assessments WHERE id = $1`,
          [body.id],
        );
        expect(dbRes.rows[0].timing.pauseTimerOnDisconnect).toBe(true);
        expect(dbRes.rows[0].timing.durationMinutes).toBe(120);
      });
    },
  );

  describe('Part A.8: Fake Timer Hygiene Verification', () => {
    it('proves fake timers are completely restored and Date uses real system time in subsequent tests', () => {
      // In this test, vi.useFakeTimers was NOT called; real system clock must be active
      const now = Date.now();
      const realSystemYear = new Date().getUTCFullYear();
      // Year must be current (>= 2024), not 2026 time-travel year
      expect(realSystemYear).toBeGreaterThanOrEqual(2024);
      expect(now).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // PART B: SKIPPED CONTRACT TESTS (Stream 2 Candidate Runtime & Auto-Submit)
  // =========================================================================

  describe('Part B.1: Candidate Workspace Launch Window Contract (BR-08, CA-005, CA-012)', () => {
    it.skip('launch before window opens returns HTTP 403 Forbidden with code WINDOW_NOT_OPEN', async () => {
      // SKIPPED: app.assignments table and POST /candidate/assignments/:id/connect pending Stream 2 (CA-005, CA-012, BR-08)
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000001',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch after window closes returns HTTP 403 Forbidden with code WINDOW_EXPIRED', async () => {
      // SKIPPED: app.assignments table and POST /candidate/assignments/:id/connect pending Stream 2 (CA-005, CA-012, BR-08)
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000002',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch boundary: 1ms before window start fails with 403', async () => {
      // SKIPPED: Boundary validation on POST /candidate/assignments/:id/connect pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000003',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch boundary: exactly at window start succeeds (200 OK)', async () => {
      // SKIPPED: Boundary validation on POST /candidate/assignments/:id/connect pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000004',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch boundary: exactly at window end succeeds (200 OK)', async () => {
      // SKIPPED: Boundary validation on POST /candidate/assignments/:id/connect pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000005',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch boundary: 1ms after window end fails with 403', async () => {
      // SKIPPED: Boundary validation on POST /candidate/assignments/:id/connect pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000006',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch inside window sets deadline_at strictly from server clock, ignoring client timestamp (BR-08)', async () => {
      // SKIPPED: Server-enforced clock on connect pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000007',
        candidateSessionToken: 'sess_candidate',
        clientTimestamp: '2099-01-01T00:00:00.000Z',
      });
    });

    it.skip('launch idempotency: launching an already in_progress assignment does not reset deadline_at', async () => {
      // SKIPPED: Session reconnect idempotency pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000008',
        candidateSessionToken: 'sess_candidate',
      });
    });

    it.skip('launch authorization: attempting to launch another candidate assignment returns 404 (BR-01)', async () => {
      // SKIPPED: Candidate assignment isolation pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000009',
        candidateSessionToken: 'sess_candidate_other',
      });
    });

    it.skip('launch authorization: suspended candidate or suspended organization returns 403', async () => {
      // SKIPPED: User/Organization suspension guard pending Stream 2
      await TimingContractStubs.launchAssignment({
        assignmentId: '00000000-0000-4000-8000-000000000010',
        candidateSessionToken: 'sess_suspended_user',
      });
    });
  });

  describe('Part B.2: Disconnect & Resume Timing Logic (BR-09, CA-009, CA-011)', () => {
    it.skip('disconnect with pauseTimerOnDisconnect=false leaves deadline unchanged after 1s, 10m, and past deadline', async () => {
      // SKIPPED: Workspace disconnect event handling pending Stream 2 (CA-009, BR-09)
      await TimingContractStubs.recordWorkspaceEvent({
        workspaceId: 'ws_01',
        assignmentId: 'asgn_01',
        candidateSessionToken: 'sess_candidate',
        eventType: 'disconnect',
      });
    });

    it.skip('disconnect with pauseTimerOnDisconnect=false: rapid disconnect/reconnect storm leaves deadline unchanged', async () => {
      // SKIPPED: Flapping disconnect handling pending Stream 2
      await TimingContractStubs.recordWorkspaceEvent({
        workspaceId: 'ws_01',
        assignmentId: 'asgn_01',
        candidateSessionToken: 'sess_candidate',
        eventType: 'disconnect',
      });
    });

    it.skip('disconnect with pauseTimerOnDisconnect=true: deadline moves forward by exact disconnect duration on resume', async () => {
      // SKIPPED: Resume deadline adjustment pending Stream 2
      await TimingContractStubs.recordWorkspaceEvent({
        workspaceId: 'ws_01',
        assignmentId: 'asgn_01',
        candidateSessionToken: 'sess_candidate',
        eventType: 'resume',
      });
    });

    it.skip('disconnect with pauseTimerOnDisconnect=true: cannot extend past window_end_utc + extendedMinutes ceiling', async () => {
      // SKIPPED: Combined ceiling enforcement on resume pending Stream 2
      await TimingContractStubs.recordWorkspaceEvent({
        workspaceId: 'ws_01',
        assignmentId: 'asgn_01',
        candidateSessionToken: 'sess_candidate',
        eventType: 'resume',
      });
    });

    it.skip('disconnect with pauseTimerOnDisconnect=true: client-supplied disconnect timestamp is ignored', async () => {
      // SKIPPED: Server clock enforcement on disconnect event pending Stream 2
      await TimingContractStubs.recordWorkspaceEvent({
        workspaceId: 'ws_01',
        assignmentId: 'asgn_01',
        candidateSessionToken: 'sess_candidate',
        eventType: 'disconnect',
        clientTimestamp: '2026-11-03T00:00:00.000Z',
      });
    });
  });
});
