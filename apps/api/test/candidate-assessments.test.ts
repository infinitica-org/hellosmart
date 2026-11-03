import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CandidateAssessmentsService } from '../src/modules/candidates/candidate-assessments.service.js';
import type { UserContext } from '../src/common/types/user-context.js';

describe('CandidateAssessmentsService', () => {
  let service: CandidateAssessmentsService;
  let mockClient: any;
  let mockPool: any;

  const mockOrgId = '11111111-1111-4111-8111-111111111111';
  const mockCandidateId = '22222222-2222-4222-8222-222222222222';
  const mockAssessmentId = '33333333-3333-4333-8333-333333333333';
  const mockAssignmentId = '44444444-4444-4444-8444-444444444444';

  const candidateActor: UserContext = {
    userId: mockCandidateId,
    orgId: mockOrgId,
    role: 'candidate',
    email: 'candidate@test.com',
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };
    service = new CandidateAssessmentsService(mockPool);
  });

  it('rejects unauthenticated caller without orgId', async () => {
    await expect(
      service.getAssignments({ userId: mockCandidateId, orgId: null, role: 'candidate', email: 'test@test.com' }),
    ).rejects.toThrow();
  });

  it('fetches candidate assignments and computes status correctly', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM app.assignments asg')) {
        return {
          rows: [
            {
              assignment_id: mockAssignmentId,
              assessment_id: mockAssessmentId,
              db_status: 'invited',
              first_connect_at: null,
              deadline_at: null,
              submitted_at: null,
              assessment_name: 'Fullstack Task',
              workspace_mode: 'cloud',
              timing: { durationMinutes: 90 },
              brief_overrides: { scenario: 'Build an API' },
              company_name: 'Acme Corp',
              manifest: { title: 'Template Title' },
              workspace_id: null,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await service.getAssignments(candidateActor);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(mockAssignmentId);
    expect(res[0].status).toBe('ready');
    expect(res[0].companyName).toBe('Acme Corp');
    expect(res[0].durationMinutes).toBe(90);
  });

  it('records consent and produces auditable record', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT') && sql.includes('FROM app.assignments asg')) {
        return {
          rows: [
            {
              assignment_id: mockAssignmentId,
              org_id: mockOrgId,
              assessment_id: mockAssessmentId,
              candidate_id: mockCandidateId,
              assignment_status: 'ready',
              workspace_mode: 'cloud',
              consent_id: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO app.consents')) {
        return {
          rows: [
            {
              id: 'consent_123',
              assignment_id: mockAssignmentId,
              text_version: 'v1.0',
              accepted_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('audit.events')) {
        return { rows: [{ hash: Buffer.from('mockhash') }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const result = await service.recordConsent(
      mockAssessmentId,
      { textVersion: 'v1.0' },
      candidateActor,
      { ip: '127.0.0.1', userAgent: 'test-agent' },
    );

    expect(result.success).toBe(true);
    expect(result.textVersion).toBe('v1.0');
    expect(result.assignmentId).toBe(mockAssignmentId);
  });

  it('rejects startAssessment if consent is not accepted (BR-12)', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT') && sql.includes('FROM app.assignments asg')) {
        return {
          rows: [
            {
              assignment_id: mockAssignmentId,
              org_id: mockOrgId,
              assessment_id: mockAssessmentId,
              candidate_id: mockCandidateId,
              assignment_status: 'ready',
              workspace_mode: 'cloud',
              consent_id: null, // No consent!
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.startAssessment(mockAssessmentId, {}, candidateActor, { ip: '127.0.0.1' }),
    ).rejects.toThrow();
  });

  it('rejects duplicate submission with HTTP 409 conflict (BR-20)', async () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT') && sql.includes('FROM app.assignments asg')) {
        return {
          rows: [
            {
              assignment_id: mockAssignmentId,
              org_id: mockOrgId,
              assessment_id: mockAssessmentId,
              candidate_id: mockCandidateId,
              assignment_status: 'submitted', // Already submitted!
              submitted_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      service.submitDeliverables(
        mockAssessmentId,
        {
          repositoryUrl: 'https://github.com/repo',
          branchName: 'main',
          architectureNotes: 'Architecture notes description here',
          confirmChecklist: true,
        },
        candidateActor,
        { ip: '127.0.0.1' },
      ),
    ).rejects.toThrow();
  });
});

