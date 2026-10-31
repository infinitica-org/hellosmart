import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TemplatesService,
  bumpSemver,
} from '../src/modules/templates/templates.service.js';
import { TemplatesRepository } from '../src/modules/templates/templates.repository.js';
import { AdminTemplatesController } from '../src/modules/templates/admin-templates.controller.js';
import type { UserContext } from '../src/common/types/user-context.js';
import { REQUEST_USER_KEY } from '../src/common/guards/session.guard.js';

describe('Template Versioning, Immutability & Cloning API (BR-03, Ticket S1-T01-3)', () => {
  let service: TemplatesService;
  let mockRepo: TemplatesRepository;
  let mockPlatformPool: any;
  let mockClient: any;

  const platformAdmin: UserContext = {
    userId: 'usr_platform_admin',
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    orgId: null,
  };

  const companyAdmin: UserContext = {
    userId: 'usr_company_admin',
    email: 'admin@company.com',
    role: 'company_admin',
    orgId: '11111111-1111-1111-1111-111111111111',
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
      getLatestVersion: vi.fn(),
    } as any;

    service = new TemplatesService(mockRepo, mockPlatformPool, mockPlatformPool);
  });

  describe('Semver Increment Utility (bumpSemver)', () => {
    it('correctly increments patch, minor, and major semver versions', () => {
      expect(bumpSemver('1.0.0', 'patch')).toBe('1.0.1');
      expect(bumpSemver('1.0.0', 'minor')).toBe('1.1.0');
      expect(bumpSemver('1.0.0', 'major')).toBe('2.0.0');
      expect(bumpSemver('2.3.4', 'patch')).toBe('2.3.5');
      expect(bumpSemver('2.3.4', 'minor')).toBe('2.4.0');
      expect(bumpSemver('2.3.4', 'major')).toBe('3.0.0');
    });

    it('falls back gracefully to 1.1.0 when version string is non-standard', () => {
      expect(bumpSemver('latest', 'minor')).toBe('1.1.0');
    });
  });

  describe('Template Cloning API (BR-03)', () => {
    it('clones a template into a new draft version with auto-incremented semver', async () => {
      (mockRepo.getLatestVersion as any).mockResolvedValue('1.2.0');
      (mockRepo.cloneTemplateVersion as any).mockResolvedValue({
        id: 'ver_cloned_01',
        templateId: 'tpl_fs_01',
        version: '1.3.0',
        status: 'draft',
      });

      const res = await service.cloneVersion(
        'tpl_fs_01',
        { versionType: 'minor' },
        platformAdmin,
      );

      expect(res).toEqual({
        id: 'ver_cloned_01',
        templateId: 'tpl_fs_01',
        version: '1.3.0',
        status: 'draft',
      });
      expect(mockRepo.cloneTemplateVersion).toHaveBeenCalledWith(
        expect.anything(),
        'tpl_fs_01',
        '1.3.0',
      );
      // Audit entry for cloning
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('clones a template with explicit newVersion string', async () => {
      (mockRepo.cloneTemplateVersion as any).mockResolvedValue({
        id: 'ver_cloned_02',
        templateId: 'tpl_fs_01',
        version: '2.0.0',
        status: 'draft',
      });

      const res = await service.cloneVersion(
        'tpl_fs_01',
        { newVersion: '2.0.0', versionType: 'major' },
        platformAdmin,
      );

      expect(res.version).toBe('2.0.0');
      expect(mockRepo.cloneTemplateVersion).toHaveBeenCalledWith(
        expect.anything(),
        'tpl_fs_01',
        '2.0.0',
      );
    });

    it('rejects cloning by non-platform_admin with 403 Forbidden', async () => {
      await expect(
        service.cloneVersion('tpl_fs_01', { versionType: 'minor' }, companyAdmin),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });
    });

    it('returns 404 when cloning an unknown template', async () => {
      (mockRepo.getLatestVersion as any).mockResolvedValue(null);
      (mockRepo.cloneTemplateVersion as any).mockResolvedValue(null);

      await expect(
        service.cloneVersion('unknown_tpl', { versionType: 'minor' }, platformAdmin),
      ).rejects.toMatchObject({
        response: {
          status: 404,
          code: 'TEMPLATE_NOT_FOUND',
        },
      });
    });
  });

  describe('Template Publishing API & Immutability (BR-03)', () => {
    it('publishes a draft template version and writes audit event', async () => {
      (mockRepo.publishTemplateVersion as any).mockResolvedValue(true);

      const res = await service.publishVersion('tpl_fs_01', '1.3.0', platformAdmin);

      expect(res).toEqual({
        published: true,
        templateId: 'tpl_fs_01',
        version: '1.3.0',
      });
      expect(mockRepo.publishTemplateVersion).toHaveBeenCalledWith(
        expect.anything(),
        'tpl_fs_01',
        '1.3.0',
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit.events'),
        expect.anything(),
      );
    });

    it('rejects publishing by non-platform_admin with 403 Forbidden', async () => {
      await expect(
        service.publishVersion('tpl_fs_01', '1.3.0', companyAdmin),
      ).rejects.toMatchObject({
        response: {
          status: 403,
          code: 'FORBIDDEN',
        },
      });
    });

    it('returns 404 when publishing an unknown template or draft version', async () => {
      (mockRepo.publishTemplateVersion as any).mockResolvedValue(false);

      await expect(
        service.publishVersion('unknown_tpl', '9.9.9', platformAdmin),
      ).rejects.toMatchObject({
        response: {
          status: 404,
          code: 'VERSION_NOT_FOUND',
        },
      });
    });
  });

  describe('HTTP Controller Integration', () => {
    it('AdminTemplatesController cloneVersion validates payload and delegates', async () => {
      const controller = new AdminTemplatesController(service);
      const req: any = { [REQUEST_USER_KEY]: platformAdmin };

      (mockRepo.getLatestVersion as any).mockResolvedValue('1.0.0');
      (mockRepo.cloneTemplateVersion as any).mockResolvedValue({
        id: 'ver_cloned_03',
        templateId: 'tpl_01',
        version: '1.1.0',
        status: 'draft',
      });

      const res = await controller.cloneVersion('tpl_01', { versionType: 'minor' }, req);
      expect(res.version).toBe('1.1.0');

      // Invalid versionType returns 422
      await expect(
        controller.cloneVersion('tpl_01', { versionType: 'invalid' as any }, req),
      ).rejects.toMatchObject({
        response: {
          status: 422,
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('AdminTemplatesController publishVersion delegates with version param', async () => {
      const controller = new AdminTemplatesController(service);
      const req: any = { [REQUEST_USER_KEY]: platformAdmin };

      (mockRepo.publishTemplateVersion as any).mockResolvedValue(true);

      const res = await controller.publishVersion('tpl_01', '1.1.0', req);
      expect(res.published).toBe(true);
    });
  });
});
