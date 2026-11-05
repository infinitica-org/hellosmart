import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CandidatePortalController } from '../src/modules/candidates/candidate-portal.controller.js';
import { CandidatesService } from '../src/modules/candidates/candidates.service.js';
import { createMockDbPool } from './helpers/candidate-mock-db.js';
import type { AuthenticatedUser } from '../src/common/types/user-context.js';
import { REQUEST_USER_KEY } from '../src/common/guards/session.guard.js';

describe('Candidate Portal API & Service (BUG-CAN-03, BUG-CAN-04, BR-01, BR-06, BR-12, BR-20)', () => {
  let controller: CandidatePortalController;
  let service: CandidatesService;
  let mockPool: any;

  const orgId = '11111111-1111-4111-8111-111111111111';
  const foreignOrgId = '22222222-2222-4222-8222-222222222222';
  const candidateId = '33333333-3333-4333-8333-333333333333';
  const assessmentId = '44444444-4444-4444-8444-444444444444';
  const assignmentId = '55555555-5555-4555-8555-555555555555';

  const candidateActor: AuthenticatedUser = {
    userId: candidateId,
    email: 'candidate@example.com',
    role: 'candidate',
    orgId,
  };

  const companyAdminActor: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@example.com',
    role: 'company_admin',
    orgId,
  };

  beforeEach(() => {
    mockPool = createMockDbPool();

    // Seed mock database
    mockPool.users.set(candidateId, {
      id: candidateId,
      org_id: orgId,
      email: 'candidate@example.com',
      name: 'Alex Candidate',
      role: 'candidate',
      status: 'active',
      must_reset_password: false,
      counted_against_cap_at: null,
      created_at: new Date(),
    });

    mockPool.assessments.set(assessmentId, {
      id: assessmentId,
      org_id: orgId,
      name: 'Full-Stack Distributed Systems Assessment',
      status: 'published',
    });

    mockPool.assignments.set(assignmentId, {
      id: assignmentId,
      org_id: orgId,
      assessment_id: assessmentId,
      candidate_id: candidateId,
      status: 'invited',
      invite_token_hash: Buffer.from('token'),
      invite_issued_at: new Date(),
      invite_expires_at: new Date(Date.now() + 7 * 86400000),
      invited_at: new Date(),
      created_at: new Date(),
      first_connect_at: null,
    });

    const mailService: any = {
      sendInvitationEmail: vi.fn().mockResolvedValue({ providerId: 'test-mail' }),
    };

    service = new CandidatesService(mockPool as any, mailService);
    controller = new CandidatePortalController(service);
  });

  describe('1. GET /candidate/assessments (List Candidate Assignments)', () => {
    it('returns assigned assessments for authenticated candidate', async () => {
      const req: any = { [REQUEST_USER_KEY]: candidateActor };
      const result = await controller.getAssessments(req);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(assignmentId);
      expect(result[0]?.title).toBe('Full-Stack Distributed Systems Assessment');
      expect(result[0]?.status).toBe('invited');
      expect(result[0]?.durationMinutes).toBe(90);
    });

    it('rejects company_admin from accessing candidate assessments endpoint with 403 Forbidden', async () => {
      const req: any = { [REQUEST_USER_KEY]: companyAdminActor };
      await expect(controller.getAssessments(req)).rejects.toThrow();
    });
  });

  describe('2. GET /candidate/assessments/:id (Assessment Taking Details)', () => {
    it('returns assignment details, timing, and effective brief for taking', async () => {
      const req: any = { [REQUEST_USER_KEY]: candidateActor };
      const detail = await controller.getAssessmentById(assignmentId, req);

      expect(detail).toBeDefined();
      expect(detail.id).toBe(assignmentId);
      expect(detail.title).toBe('Full-Stack Distributed Systems Assessment');
      expect(detail.briefOverrides?.scenario).toContain('distributed resilient');
      expect(detail.timing?.durationMinutes).toBe(90);
    });

    it('returns 404 for unknown or foreign organization assignment (BR-01)', async () => {
      const req: any = { [REQUEST_USER_KEY]: candidateActor };
      await expect(controller.getAssessmentById('non-existent-id', req)).rejects.toThrow();
    });
  });

  describe('3. POST /candidate/workspace/:id/consent (Consent & First Connect BR-06, BR-12)', () => {
    it('records candidate consent, transitions status to in_progress, and updates first_connect_at', async () => {
      const req: any = {
        [REQUEST_USER_KEY]: candidateActor,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Vitest Browser' },
      };

      const result = await controller.acceptConsent(assignmentId, { textVersion: 'v1.0' }, req);

      expect(result.success).toBe(true);
      expect(result.status).toBe('in_progress');
      expect(result.firstConnectAt).toBeDefined();

      // Invariant BR-31: writes audit log
      expect(mockPool.auditEvents.length).toBeGreaterThan(0);
      const audit = (mockPool.auditEvents as any[]).find((e) =>
        Array.isArray(e) ? e[3] === 'candidate.consent_accepted' : e.action === 'candidate.consent_accepted',
      );
      expect(audit).toBeDefined();
      const role = Array.isArray(audit) ? audit[1] : audit.actorRole;
      expect(role).toBe('candidate');
    });
  });

  describe('4. POST /candidate/workspace/:id/draft (Continuous Autosave BR-11)', () => {
    it('persists candidate draft state and returns saved timestamp', async () => {
      const req: any = { [REQUEST_USER_KEY]: candidateActor };
      const result = await controller.saveDraft(
        assignmentId,
        { files: { 'index.ts': 'console.log("hello");' } },
        req,
      );

      expect(result.success).toBe(true);
      expect(result.savedAt).toBeDefined();
    });
  });

  describe('5. POST /candidate/workspace/:id/submit (Final Submission BR-08, BR-11)', () => {
    it('submits assessment, sets status to submitted, and logs audit event', async () => {
      const req: any = {
        [REQUEST_USER_KEY]: candidateActor,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Vitest Browser' },
      };

      const result = await controller.submitAssessment(
        assignmentId,
        { artifacts: [{ name: 'bundle.zip', url: '/storage/1.zip' }] },
        req,
      );

      expect(result.status).toBe('submitted');
      expect(result.submissionId).toBe(`sub-${assignmentId}`);
      expect(result.submittedAt).toBeDefined();

      // Audit event
      const audit = (mockPool.auditEvents as any[]).find((e) =>
        Array.isArray(e) ? e[3] === 'assignment.submitted' : e.action === 'assignment.submitted',
      );
      expect(audit).toBeDefined();
    });
  });
});
