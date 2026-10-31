import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssessmentsService } from '../src/modules/assessments/assessments.service.js';
import { AssessmentsRepository } from '../src/modules/assessments/assessments.repository.js';
import { AssessmentsController } from '../src/modules/assessments/assessments.controller.js';
import type { UserContext } from '../src/common/types/user-context.js';
import { REQUEST_USER_KEY } from '../src/common/guards/session.guard.js';

describe('Assessment Builder & Task Lifecycle Engine (Stream 2, S1-T02-1, S1-T02-2, S1-T02-3)', () => {
  let service: AssessmentsService;
  let mockRepo: AssessmentsRepository;
  let mockPool: any;
  let mockClient: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';

  const companyAdminOrgA: UserContext = {
    userId: 'usr_company_a',
    email: 'admin@orga.com',
    role: 'company_admin',
    orgId: orgA,
  };

  const companyAdminOrgB: UserContext = {
    userId: 'usr_company_b',
    email: 'admin@orgb.com',
    role: 'company_admin',
    orgId: orgB,
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT set_config')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT max_templates, trial_ends_at FROM app.entitlements')) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                max_templates: 3,
                trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
          });
        }
        if (sql.includes('latest_event_hash')) {
          return Promise.resolve({ rows: [{ hash: Buffer.alloc(32) }] });
        }
        if (sql.includes('INSERT INTO audit.events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    mockRepo = {
      findAssignedTemplateVersion: vi.fn(),
      createAssessment: vi.fn(),
      listByOrg: vi.fn(),
      findById: vi.fn(),
      updateBriefOverrides: vi.fn(),
      countByOrg: vi.fn(),
    } as any;

    service = new AssessmentsService(mockRepo, mockPool);
  });

  describe('S1-T02-1: Assessment Creation with Version Pinning (BR-03)', () => {
    it('creates an assessment and pins the exact published template_version_id', async () => {
      const templateVersionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const assessmentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      (mockRepo.countByOrg as any).mockResolvedValue(1); // 1 active out of 3 allowed
      (mockRepo.findAssignedTemplateVersion as any).mockResolvedValue({
        templateId: 'tpl_fs_01',
        templateSlug: 'tpl_fs_01',
        templateVersionId,
        version: '1.2.0',
        manifest: { name: 'Full Stack Next.js' },
      });
      (mockRepo.createAssessment as any).mockResolvedValue(assessmentId);
      (mockRepo.findById as any).mockResolvedValue({
        id: assessmentId,
        orgId: orgA,
        templateId: 'tpl_fs_01',
        templateVersionId,
        templateVersion: '1.2.0',
        name: 'Senior Frontend Assessment',
        workspaceMode: 'cloud',
        status: 'draft',
        timing: { durationMinutes: 90 },
        aiPolicy: { enabled: true },
        briefOverrides: {},
        envRefs: [],
        releaseResultsDefault: false,
        candidateCount: 0,
        dryRunPassedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await service.create(
        {
          templateId: 'tpl_fs_01',
          name: 'Senior Frontend Assessment',
          workspaceMode: 'cloud',
          timing: { type: 'duration', durationMinutes: 90, tz: 'UTC', pauseTimerOnDisconnect: false },
          aiPolicy: {
            enabled: true,
            allowedModels: ['gpt-4o'],
            capPerCandidate: { unit: 'tokens', value: 50000 },
            rpm: 20,
            onCap: 'warn_then_block',
          },
          briefOverrides: {},
          releaseResultsDefault: false,
        },
        companyAdminOrgA,
      );

      expect(res.id).toBe(assessmentId);
      expect(res.templateVersionId).toBe(templateVersionId);
      expect(res.templateVersion).toBe('1.2.0');
      expect(mockRepo.createAssessment).toHaveBeenCalledWith(
        expect.anything(),
        orgA,
        templateVersionId,
        expect.anything(),
      );
      // Audit log check
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('returns 404 (never 403) if requested template is not assigned to the organization (BR-01, BR-02)', async () => {
      (mockRepo.countByOrg as any).mockResolvedValue(0);
      (mockRepo.findAssignedTemplateVersion as any).mockResolvedValue(null);

      await expect(
        service.create(
          {
            templateId: 'unassigned_tpl',
            name: 'Unauthorized Assessment',
            workspaceMode: 'cloud',
            timing: { type: 'duration', durationMinutes: 90, tz: 'UTC', pauseTimerOnDisconnect: false },
            aiPolicy: {
              enabled: true,
              allowedModels: ['gpt-4o'],
              capPerCandidate: { unit: 'tokens', value: 50000 },
              rpm: 20,
              onCap: 'warn_then_block',
            },
            briefOverrides: {},
            releaseResultsDefault: false,
          },
          companyAdminOrgA,
        ),
      ).rejects.toMatchObject({
        response: {
          status: 404,
          code: 'TEMPLATE_NOT_FOUND',
        },
      });
    });
  });

  describe('S1-T02-2: Candidate Instructions & Deliverables Override API', () => {
    it('updates brief overrides and logs tamper-evident audit record', async () => {
      const assessmentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const initialDetail: any = {
        id: assessmentId,
        orgId: orgA,
        briefOverrides: { scenario: 'Initial scenario' },
      };

      const updatedOverrides = {
        scenario: 'Custom scenario for team alpha',
        instructions: 'Focus on database query optimization and avoid N+1 queries.',
        deliverables: ['PR on GitHub', 'Performance audit report'],
      };

      (mockRepo.findById as any)
        .mockResolvedValueOnce(initialDetail)
        .mockResolvedValueOnce({
          ...initialDetail,
          briefOverrides: updatedOverrides,
        });
      (mockRepo.updateBriefOverrides as any).mockResolvedValue(true);

      const res = await service.updateBrief(
        assessmentId,
        updatedOverrides,
        companyAdminOrgA,
      );

      expect(res.briefOverrides).toEqual(updatedOverrides);
      expect(mockRepo.updateBriefOverrides).toHaveBeenCalledWith(
        expect.anything(),
        orgA,
        assessmentId,
        expect.objectContaining(updatedOverrides),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('returns 404 when updating brief for an assessment owned by another organization (BR-01)', async () => {
      (mockRepo.findById as any).mockResolvedValue(null);

      await expect(
        service.updateBrief(
          'cross_org_assessment',
          { scenario: 'Hacked scenario' },
          companyAdminOrgB,
        ),
      ).rejects.toMatchObject({
        response: {
          status: 404,
          code: 'ASSESSMENT_NOT_FOUND',
        },
      });
    });
  });

  describe('S1-T02-3: Plan Entitlements & Template Quota Enforcer (BR-05, BR-07)', () => {
    it('blocks assessment creation when active assessments reach max_templates quota', async () => {
      (mockRepo.countByOrg as any).mockResolvedValue(3); // 3 out of 3 used!

      await expect(
        service.create(
          {
            templateId: 'tpl_fs_01',
            name: 'Over-Quota Assessment',
            workspaceMode: 'cloud',
            timing: { type: 'duration', durationMinutes: 90, tz: 'UTC', pauseTimerOnDisconnect: false },
            aiPolicy: {
              enabled: true,
              allowedModels: ['gpt-4o'],
              capPerCandidate: { unit: 'tokens', value: 50000 },
              rpm: 20,
              onCap: 'warn_then_block',
            },
            briefOverrides: {},
            releaseResultsDefault: false,
          },
          companyAdminOrgA,
        ),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'ENTITLEMENT_LIMIT_EXCEEDED',
        },
      });
    });

    it('blocks assessment creation when company trial has expired', async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT set_config')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT max_templates, trial_ends_at FROM app.entitlements')) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                max_templates: 5,
                trial_ends_at: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.create(
          {
            templateId: 'tpl_fs_01',
            name: 'Expired Trial Assessment',
            workspaceMode: 'cloud',
            timing: { type: 'duration', durationMinutes: 90, tz: 'UTC', pauseTimerOnDisconnect: false },
            aiPolicy: {
              enabled: true,
              allowedModels: ['gpt-4o'],
              capPerCandidate: { unit: 'tokens', value: 50000 },
              rpm: 20,
              onCap: 'warn_then_block',
            },
            briefOverrides: {},
            releaseResultsDefault: false,
          },
          companyAdminOrgA,
        ),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'TRIAL_EXPIRED',
        },
      });
    });
  });

  describe('HTTP Controller Integration', () => {
    it('AssessmentsController validates payload, returns 201 and delegates to service', async () => {
      const controller = new AssessmentsController(service);
      const req: any = { [REQUEST_USER_KEY]: companyAdminOrgA };

      const validPayload = {
        templateId: 'tpl_fs_01',
        name: 'Valid Next.js Task',
        workspaceMode: 'cloud' as const,
      };

      (mockRepo.countByOrg as any).mockResolvedValue(0);
      (mockRepo.findAssignedTemplateVersion as any).mockResolvedValue({
        templateId: 'tpl_fs_01',
        templateVersionId: 'ver_01',
        version: '1.0.0',
      });
      (mockRepo.createAssessment as any).mockResolvedValue('asm_01');
      (mockRepo.findById as any).mockResolvedValue({
        id: 'asm_01',
        name: 'Valid Next.js Task',
      });

      const res = await controller.create(validPayload, req);
      expect(res).toBeDefined();

      // Invalid payload (name too short) throws 422
      await expect(
        controller.create({ templateId: 'tpl_01', name: 'a' }, req),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });
});
