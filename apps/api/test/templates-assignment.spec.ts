import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplatesService } from '../src/modules/templates/templates.service.js';
import { TemplatesRepository } from '../src/modules/templates/templates.repository.js';
import { CompanyTemplatesController } from '../src/modules/templates/company-templates.controller.js';
import { AdminTemplatesController } from '../src/modules/templates/admin-templates.controller.js';
import type { UserContext } from '../src/common/types/user-context.js';
import { REQUEST_USER_KEY } from '../src/common/guards/session.guard.js';

describe('Private Template Assignment & Access Controls (BR-02, Ticket S1-T01-2)', () => {
  let service: TemplatesService;
  let mockRepo: TemplatesRepository;
  let mockPool: any;
  let mockPlatformPool: any;
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

  const platformAdmin: UserContext = {
    userId: 'usr_platform_admin',
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    orgId: null,
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT set_config')) {
          return Promise.resolve({ rows: [] });
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

    mockPlatformPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    mockRepo = {
      listAssignedTemplates: vi.fn(),
      getAssignedTemplateById: vi.fn(),
      assignTemplate: vi.fn(),
      revokeAssignment: vi.fn(),
      listAllTemplatesAdmin: vi.fn(),
      createTemplate: vi.fn(),
      cloneTemplateVersion: vi.fn(),
      publishTemplateVersion: vi.fn(),
    } as any;

    service = new TemplatesService(mockRepo, mockPool, mockPlatformPool);
  });

  describe('Company Admin: Private Template Scoping (BR-02)', () => {
    it('should list only templates explicitly assigned to caller organization', async () => {
      const assignedTemplates = [
        {
          id: 'custom_tpl_01',
          versionId: '1.0.0',
          name: 'Private Security Assessment',
          category: 'Backend',
          difficulty: 'Advanced',
          durationMinutes: 90,
          workspaceMode: 'cloud' as const,
          description: 'A private task assigned exclusively to Org A',
          tags: ['Security', 'Node.js'],
          status: 'published' as const,
          isAssigned: true,
        },
      ];

      (mockRepo.listAssignedTemplates as any).mockResolvedValue(assignedTemplates);

      const result = await service.listAssignedForCompany(companyAdminOrgA);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockRepo.listAssignedTemplates).toHaveBeenCalledWith(expect.anything(), orgA);
      expect(result).toEqual(assignedTemplates);
    });

    it('should return 403 Forbidden if actor has no orgId context', async () => {
      const invalidActor: UserContext = {
        userId: 'no_org',
        email: 'nobody@nowhere.com',
        role: 'company_admin',
        orgId: null,
      };

      await expect(service.listAssignedForCompany(invalidActor)).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });
    });

    it('should return template details when assigned to caller organization', async () => {
      const templateDetail: any = {
        id: 'tpl_fs_01',
        versionId: '1.2.0',
        name: 'Full Stack Assessment',
        category: 'Full Stack',
        difficulty: 'Intermediate',
        durationMinutes: 90,
        workspaceMode: 'cloud',
        description: 'Test template',
        tags: ['React'],
        status: 'published',
        manifest: { version: '1.0', name: 'Full Stack Assessment' },
      };

      (mockRepo.getAssignedTemplateById as any).mockResolvedValue(templateDetail);

      const result = await service.getAssignedByIdForCompany('tpl_fs_01', companyAdminOrgA);

      expect(mockRepo.getAssignedTemplateById).toHaveBeenCalledWith(
        expect.anything(),
        orgA,
        'tpl_fs_01',
      );
      expect(result).toEqual(templateDetail);
    });

    it('should return 404 Not Found (never 403) for unassigned template to prevent cross-tenant enumeration (BR-01, BR-02)', async () => {
      (mockRepo.getAssignedTemplateById as any).mockResolvedValue(null);

      await expect(
        service.getAssignedByIdForCompany('unassigned_or_other_org_tpl', companyAdminOrgB),
      ).rejects.toMatchObject({
        response: {
          status: 404,
          code: 'TEMPLATE_NOT_FOUND',
        },
      });
    });
  });

  describe('Platform Admin: Assignment Lifecycle & Audit (BR-02, BR-31)', () => {
    it('should allow platform_admin to assign a template and write audit log', async () => {
      (mockRepo.assignTemplate as any).mockResolvedValue(true);

      const result = await service.assignTemplate(
        'tpl_fs_01',
        { orgId: orgA },
        platformAdmin,
      );

      expect(result).toEqual({
        assigned: true,
        templateId: 'tpl_fs_01',
        orgId: orgA,
      });
      expect(mockRepo.assignTemplate).toHaveBeenCalledWith(
        expect.anything(),
        'tpl_fs_01',
        orgA,
        platformAdmin.userId,
      );
      // Verify audit query was executed
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('should allow platform_admin to bulk assign a template to multiple orgs', async () => {
      (mockRepo.assignTemplate as any).mockResolvedValue(true);

      const result = await service.bulkAssignTemplate(
        'tpl_fs_01',
        { orgIds: [orgA, orgB] },
        platformAdmin,
      );

      expect(result).toEqual({
        assignedCount: 2,
        orgIds: [orgA, orgB],
      });
      expect(mockRepo.assignTemplate).toHaveBeenCalledTimes(2);
    });

    it('should allow platform_admin to revoke a template assignment and write audit log', async () => {
      (mockRepo.revokeAssignment as any).mockResolvedValue(true);

      const result = await service.revokeTemplate('tpl_fs_01', orgA, platformAdmin);

      expect(result).toEqual({
        revoked: true,
        templateId: 'tpl_fs_01',
        orgId: orgA,
      });
      expect(mockRepo.revokeAssignment).toHaveBeenCalledWith(
        expect.anything(),
        'tpl_fs_01',
        orgA,
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('should reject non-platform_admin callers with 403 Forbidden', async () => {
      await expect(
        service.assignTemplate('tpl_fs_01', { orgId: orgA }, companyAdminOrgA),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });

      await expect(
        service.bulkAssignTemplate('tpl_fs_01', { orgIds: [orgA] }, companyAdminOrgA),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });

      await expect(
        service.revokeTemplate('tpl_fs_01', orgA, companyAdminOrgA),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });
    });
  });

  describe('HTTP Controllers Integration', () => {
    it('CompanyTemplatesController should delegate to service with request actor', async () => {
      const controller = new CompanyTemplatesController(service);
      const req: any = { [REQUEST_USER_KEY]: companyAdminOrgA };

      (mockRepo.listAssignedTemplates as any).mockResolvedValue([]);
      const list = await controller.getAssignedTemplates(req);
      expect(Array.isArray(list)).toBe(true);

      const templateDetail: any = {
        id: 'tpl_fs_01',
        versionId: '1.2.0',
        name: 'Full Stack',
      };
      (mockRepo.getAssignedTemplateById as any).mockResolvedValue(templateDetail);

      const item = await controller.getTemplateById('tpl_fs_01', req);
      expect(item).toBeDefined();
    });

    it('AdminTemplatesController should validate UUIDs and delegate to service', async () => {
      const controller = new AdminTemplatesController(service);
      const req: any = { [REQUEST_USER_KEY]: platformAdmin };

      (mockRepo.assignTemplate as any).mockResolvedValue(true);

      const res = await controller.assignTemplate('tpl_01', { orgId: orgA }, req);
      expect(res.assigned).toBe(true);

      // Invalid orgId (not a UUID) throws 422 validation error
      await expect(
        controller.assignTemplate('tpl_01', { orgId: 'invalid-not-uuid' }, req),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'VALIDATION_ERROR',
        },
      });
    });
  });
});
