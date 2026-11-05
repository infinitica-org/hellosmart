import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import crypto from 'node:crypto';
import { CandidateAssessmentsService } from '../src/modules/candidates/candidate-assessments.service.js';
import type { UserContext } from '../src/common/types/user-context.js';
import { withUserSession } from '../src/modules/tenancy/with-org.js';

const { Pool } = pg;

describe('Candidate Assessment Lifecycle - PostgreSQL Live Integration Tests (Task 4)', () => {
  let appPool: pg.Pool;
  let ownerPool: pg.Pool;
  let service: CandidateAssessmentsService;

  // Test identifiers
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const candidateA = crypto.randomUUID();
  const candidateA2 = crypto.randomUUID(); // Same org, different candidate
  const candidateB = crypto.randomUUID(); // Different org

  const assessmentAId = crypto.randomUUID();
  const assessmentBId = crypto.randomUUID();
  const assignmentAId = crypto.randomUUID();
  const assignmentA2Id = crypto.randomUUID();
  const assignmentBId = crypto.randomUUID();
  const templateId = crypto.randomUUID();
  const templateVerId = crypto.randomUUID();

  const candidateActorA: UserContext = {
    userId: candidateA,
    email: 'candA@test.com',
    role: 'candidate',
    orgId: orgA,
  };

  const candidateActorA2: UserContext = {
    userId: candidateA2,
    email: 'candA2@test.com',
    role: 'candidate',
    orgId: orgA,
  };

  const candidateActorB: UserContext = {
    userId: candidateB,
    email: 'candB@test.com',
    role: 'candidate',
    orgId: orgB,
  };

  beforeAll(async () => {
    const ownerUrl =
      process.env.TEST_DB_OWNER_URL ||
      'postgres://hs_owner:hs_owner_local@127.0.0.1:5433/hellosmart';
    const appUrl =
      process.env.TEST_DB_APP_URL ||
      'postgres://hs_app:hs_app_local@127.0.0.1:5433/hellosmart';

    ownerPool = new Pool({ connectionString: ownerUrl });
    appPool = new Pool({ connectionString: appUrl, max: 10 });
    service = new CandidateAssessmentsService(appPool);

    const platformAdminId = crypto.randomUUID();

    // Bootstrap test fixtures via owner pool (bypass RLS for setup)
    const client = await ownerPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create test organizations
      await client.query(
        `INSERT INTO app.organizations (id, name, slug, created_by) VALUES 
         ($1, 'Lifecycle Test Org A', $2, $5),
         ($3, 'Lifecycle Test Org B', $4, $5)
         ON CONFLICT DO NOTHING`,
        [orgA, `org-a-${orgA.slice(0, 8)}`, orgB, `org-b-${orgB.slice(0, 8)}`, platformAdminId],
      );

      // 2. Create test candidate users
      await client.query(
        `INSERT INTO app.users (id, org_id, email, name, role, status) VALUES
         ($1, $2, 'candA@test.com', 'Candidate A', 'candidate', 'active'),
         ($3, $2, 'candA2@test.com', 'Candidate A2', 'candidate', 'active'),
         ($4, $5, 'candB@test.com', 'Candidate B', 'candidate', 'active')
         ON CONFLICT DO NOTHING`,
        [candidateA, orgA, candidateA2, candidateB, orgB],
      );

      // 3. Create master template and version
      await client.query(
        `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description, tags)
         VALUES ($1, $2, 'Fullstack React Task', 'Engineering', 'Intermediate', 'cloud', 'Task description', '{"react","node"}')
         ON CONFLICT DO NOTHING`,
        [templateId, `template-${templateId.slice(0, 8)}`],
      );

      await client.query(
        `INSERT INTO app.template_versions (id, template_id, version, manifest, status)
         VALUES ($1, $2, '1.0.0', '{"title":"API Task","summary":"Build API","instructions":"Solve the task","workspace":{"timeoutMinutes":90}}', 'published')
         ON CONFLICT DO NOTHING`,
        [templateVerId, templateId],
      );

      await client.query(
        `INSERT INTO app.template_assignments (template_id, org_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT DO NOTHING`,
        [templateId, orgA, orgB],
      );

      // 4. Create assessments for Org A and Org B
      await client.query(
        `INSERT INTO app.assessments (id, org_id, template_version_id, name, workspace_mode, timing, status)
         VALUES 
         ($1, $2, $3, 'Org A Assessment', 'cloud', '{"durationMinutes":90}', 'published'),
         ($4, $5, $3, 'Org B Assessment', 'cloud', '{"durationMinutes":90}', 'published')
         ON CONFLICT DO NOTHING`,
        [assessmentAId, orgA, templateVerId, assessmentBId, orgB],
      );

      // 5. Create assignments
      await client.query(
        `INSERT INTO app.assignments (id, org_id, assessment_id, candidate_id, status)
         VALUES 
         ($1, $2, $3, $4, 'ready'),
         ($5, $6, $7, $8, 'ready'),
         ($9, $10, $11, $12, 'ready')
         ON CONFLICT DO NOTHING`,
        [
          assignmentAId, orgA, assessmentAId, candidateA,
          assignmentA2Id, orgA, assessmentAId, candidateA2,
          assignmentBId, orgB, assessmentBId, candidateB,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Cleanup test fixtures
    const client = await ownerPool.connect();
    try {
      await client.query('BEGIN');
      // Temporarily disable immutability triggers for test cleanup
      await client.query('ALTER TABLE app.consents DISABLE TRIGGER trg_immutable_consent');
      await client.query('ALTER TABLE app.submissions DISABLE TRIGGER trg_immutable_submission');

      await client.query('DELETE FROM app.consents WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.submissions WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.drafts WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.workspaces WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.assignments WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.assessments WHERE org_id IN ($1, $2)', [orgA, orgB]);
      await client.query('DELETE FROM app.template_assignments WHERE template_id = $1', [templateId]);
      await client.query("UPDATE app.template_versions SET status = 'draft' WHERE id = $1", [templateVerId]);
      await client.query('DELETE FROM app.template_versions WHERE id = $1', [templateVerId]);
      await client.query('DELETE FROM app.templates WHERE id = $1', [templateId]);
      await client.query('DELETE FROM app.users WHERE id IN ($1, $2, $3)', [candidateA, candidateA2, candidateB]);
      await client.query('DELETE FROM app.organizations WHERE id IN ($1, $2)', [orgA, orgB]);

      await client.query('ALTER TABLE app.consents ENABLE TRIGGER trg_immutable_consent');
      await client.query('ALTER TABLE app.submissions ENABLE TRIGGER trg_immutable_submission');
      await client.query('COMMIT');
    } finally {
      client.release();
      await appPool.end();
      await ownerPool.end();
    }
  });

  async function expectAppError(promise: Promise<any>, status: number, code: string) {
    try {
      await promise;
      expect.fail(`Expected promise to throw error with status ${status} and code ${code}`);
    } catch (err: any) {
      const actualStatus = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
      const body = typeof err.getResponse === 'function' ? err.getResponse() : err;
      const actualCode = body.code || err.code;
      expect(actualStatus).toBe(status);
      expect(actualCode).toBe(code);
    }
  }

  it('1. Authenticated candidate reads own assignment', async () => {
    const assignments = await service.getAssignments(candidateActorA);
    expect(assignments.length).toBeGreaterThanOrEqual(1);
    const myAssignment = assignments.find((a) => a.id === assignmentAId);
    expect(myAssignment).toBeDefined();
    expect(myAssignment?.title).toBe('Org A Assessment');
  });

  it("2. Candidate cannot read another candidate's assignment in the same org", async () => {
    const assignments = await service.getAssignments(candidateActorA);
    const otherCandidateAssignment = assignments.find((a) => a.id === assignmentA2Id);
    expect(otherCandidateAssignment).toBeUndefined();

    // Direct access by ID must fail with 404
    await expectAppError(
      service.getAssessmentDetails(assignmentA2Id, candidateActorA),
      404,
      'ASSIGNMENT_NOT_FOUND',
    );
  });

  it('3. Cross-tenant access is rejected (Candidate A cannot read Org B)', async () => {
    await expectAppError(
      service.getAssessmentDetails(assignmentBId, candidateActorA),
      404,
      'ASSIGNMENT_NOT_FOUND',
    );
  });

  it('4. Consent persists correctly with IP, user-agent, text version, and timestamp', async () => {
    const meta = { ip: '192.168.1.100', userAgent: 'Mozilla/5.0 IntegrationTest' };
    const consent = await service.recordConsent(
      assignmentAId,
      { textVersion: 'v1.0' },
      candidateActorA,
      meta,
    );

    expect(consent.success).toBe(true);
    expect(consent.textVersion).toBe('v1.0');
    expect(consent.consentId).toBeDefined();

    // Repeat call is idempotent and preserves the original consent record
    const secondCall = await service.recordConsent(
      assignmentAId,
      { textVersion: 'v1.0' },
      candidateActorA,
      meta,
    );
    expect(secondCall.consentId).toBe(consent.consentId);
  });

  it('5. Start requires consent (Candidate A2 cannot start without consent)', async () => {
    await expectAppError(
      service.startAssessment(assignmentA2Id, {}, candidateActorA2, { ip: '127.0.0.1' }),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it('6 & 7. Start sets timer once and concurrent/reconnect requests preserve original deadline', async () => {
    const meta = { ip: '127.0.0.1' };
    const session1 = await service.startAssessment(assignmentAId, {}, candidateActorA, meta);
    expect(session1.sessionId).toBeDefined();
    expect(session1.deadlineUtc).toBeDefined();

    // Reconnecting to running session
    const session2 = await service.startAssessment(assignmentAId, {}, candidateActorA, meta);
    expect(session2.deadlineUtc).toBe(session1.deadlineUtc);
    expect(session2.sessionId).toBe(session1.sessionId);
  });

  it('8. Draft saves before submission', async () => {
    const draft = await service.saveDraft(
      assignmentAId,
      {
        repositoryUrl: 'https://github.com/candidateA/solution',
        branchName: 'feature-candidate',
        architectureNotes: 'Initial architecture design documentation.',
      },
      candidateActorA,
    );

    expect(draft.repositoryUrl).toBe('https://github.com/candidateA/solution');
    expect(draft.branchName).toBe('feature-candidate');
    expect(draft.version).toBeGreaterThanOrEqual(1);

    const fetched = await service.getDraft(assignmentAId, candidateActorA);
    expect(fetched.repositoryUrl).toBe('https://github.com/candidateA/solution');
  });

  it('12. Artifact upload validates ownership and persists in draft', async () => {
    // Synthetic zip buffer with PK header (0x50, 0x4b, 0x03, 0x04)
    const validZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    const mockRequest = {
      file: async () => ({
        filename: 'my-deliverables.zip',
        mimetype: 'application/zip',
        toBuffer: async () => validZip,
        fields: {
          assignmentId: { value: assignmentAId },
        },
      }),
      query: {},
    };

    const uploaded = await service.uploadArtifact(
      mockRequest,
      candidateActorA,
      { ip: '127.0.0.1' },
    );

    expect(uploaded.id).toBeDefined();
    expect(uploaded.originalName).toBe('my-deliverables.zip');
    expect(uploaded.sizeBytes).toBe(validZip.length);

    // Verify draft now includes uploaded artifact
    const draft = await service.getDraft(assignmentAId, candidateActorA);
    expect(draft.uploadedArtifact).toBeDefined();
  });

  it('10 & 11. Final submission locks assignment and blocks duplicate submissions', async () => {
    const meta = { ip: '127.0.0.1' };
    const submission = await service.submitDeliverables(
      assignmentAId,
      {
        repositoryUrl: 'https://github.com/candidateA/solution',
        branchName: 'main',
        architectureNotes: 'Comprehensive final architecture notes with design trade-offs.',
        confirmChecklist: true,
      },
      candidateActorA,
      meta,
    );

    expect(submission.success).toBe(true);
    expect(submission.receiptId).toMatch(/^sub_rec_/);

    // Duplicate submission attempt must fail with 409
    await expectAppError(
      service.submitDeliverables(
        assignmentAId,
        {
          repositoryUrl: 'https://github.com/candidateA/solution',
          branchName: 'main',
          architectureNotes: 'Retry attempt',
          confirmChecklist: true,
        },
        candidateActorA,
        meta,
      ),
      409,
      'SUBMISSION_ALREADY_EXISTS',
    );
  });

  it('9. Draft writes after submission are rejected with 409 DRAFT_LOCKED', async () => {
    await expectAppError(
      service.saveDraft(
        assignmentAId,
        {
          repositoryUrl: 'https://github.com/candidateA/solution-modified',
          branchName: 'hacked-branch',
          architectureNotes: 'Attempting to overwrite post-submission',
        },
        candidateActorA,
      ),
      409,
      'DRAFT_LOCKED',
    );
  });

  it('13. Missing RLS identity context fails closed', async () => {
    const client = await appPool.connect();
    try {
      // In a raw connection without set_config, candidate queries must return 0 rows
      const res = await client.query('SELECT * FROM app.assignments');
      expect(res.rows.length).toBe(0);
    } finally {
      client.release();
    }
  });

  it('14. RLS context does not leak between pooled connections', async () => {
    const client = await appPool.connect();
    try {
      // Execute a tenant-scoped query with local transaction
      await withUserSession(client, orgA, candidateA, 'candidate', async (tx) => {
        const res = await tx.query('SELECT current_setting($1, true) as tenant', ['app.org_id']);
        expect(res.rows[0].tenant).toBe(orgA);
      });

      // After transaction completes, the connection MUST NOT retain app.org_id
      const leakCheck = await client.query("SELECT current_setting('app.org_id', true) as tenant");
      expect(leakCheck.rows[0].tenant).toBe('');
    } finally {
      client.release();
    }
  });
});
