import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminOrganizationsService } from '../src/modules/admin/admin-organizations.service.js';
import { AdminOrganizationsController } from '../src/modules/admin/admin-organizations.controller.js';
import type { UserContext } from '../src/common/types/user-context.js';
import type { RequestMeta } from '../src/modules/auth/auth.service.js';
import type { UpdateOrgEntitlementsDto } from '@hs/contracts';
import { AppHttpException } from '../src/common/errors/app-http.exception.js';

describe('AdminOrganizationsService & Controller — Governance & Entitlements (S1B-T05-1)', () => {
  const testOrgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const testAdminUser: UserContext = {
    userId: 'admin-user-1',
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    orgId: null,
  };
  const testMeta: RequestMeta = {
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 TestBrowser',
    requestId: 'req-12345',
  };

  let mockClient: any;
  let mockPool: any;
  let mockEmailSender: any;
  let mockSessionService: any;
  let service: AdminOrganizationsService;
  let controller: AdminOrganizationsController;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    mockEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    mockSessionService = {
      createSession: vi.fn(),
    };

    service = new AdminOrganizationsService(
      mockPool,
      mockEmailSender,
      mockSessionService,
    );

    controller = new AdminOrganizationsController(service);
  });

  describe('AdminOrganizationsService.getOrganizationById', () => {
    it('returns complete OrgDetailDto when organization exists', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
          return { rows: [] };
        }

        if (sql.includes('FROM app.organizations o')) {
          return {
            rows: [
              {
                id: testOrgId,
                name: 'Acme Hiring Corp',
                slug: 'acme-hiring',
                status: 'paid_active',
                plan_id: 'plan_pro',
                logo_url: 'https://cdn.hellosmart.ai/acme.png',
                white_label: false,
                custom_domain: 'careers.acme.com',
                retention_days: 90,
                created_at: new Date('2026-10-01T10:00:00.000Z'),
                max_templates: 8,
                max_candidates: 50,
                trial_ends_at: null,
                pending_invite_multiplier: 2.5,
                flags: { cloud: true, chat: true, managed_ai_credits: true },
                admin_id: '11111111-1111-4111-8111-111111111111',
                admin_name: 'Jane Admin',
                admin_email: 'jane@acme.com',
                admin_status: 'active',
                admin_last_login_at: null,
                candidate_count: 14,
                assessment_count: 4,
                active_workspaces_count: 2,
              },
            ],
          };
        }

        return { rows: [] };
      });

      const detail = await service.getOrganizationById(testOrgId);

      expect(detail).toBeDefined();
      expect(detail.id).toBe(testOrgId);
      expect(detail.name).toBe('Acme Hiring Corp');
      expect(detail.slug).toBe('acme-hiring');
      expect(detail.status).toBe('paid_active');
      expect(detail.customDomain).toBe('careers.acme.com');
      expect(detail.retentionDays).toBe(90);

      // Entitlements
      expect(detail.entitlements.maxTemplates).toBe(8);
      expect(detail.entitlements.maxCandidates).toBe(50);
      expect(detail.entitlements.pendingInviteMultiplier).toBe(2.5);
      expect(detail.entitlements.flags.cloud).toBe(true);
      expect(detail.entitlements.flags.managed_ai_credits).toBe(true);

      // Primary Admin
      expect(detail.primaryAdmin?.name).toBe('Jane Admin');
      expect(detail.primaryAdmin?.email).toBe('jane@acme.com');

      // Stats
      expect(detail.stats.candidateCount).toBe(14);
      expect(detail.stats.assessmentCount).toBe(4);
      expect(detail.stats.activeWorkspacesCount).toBe(2);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('throws 404 Problem when organization is not found', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
          return { rows: [] };
        }
        if (sql.includes('FROM app.organizations o')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      await expect(service.getOrganizationById(testOrgId)).rejects.toThrow(AppHttpException);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('queries activeWorkspacesCount including not_connected, connected, disconnected, and provisioning, but excluding ended, destroyed, and failed', async () => {
      let executedSql = '';

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
          return { rows: [] };
        }

        if (sql.includes('FROM app.organizations o')) {
          executedSql = sql;
          return {
            rows: [
              {
                id: testOrgId,
                name: 'Workspace Telemetry Org',
                slug: 'telemetry-org',
                status: 'paid_active',
                plan_id: 'plan_pro',
                logo_url: null,
                white_label: false,
                custom_domain: null,
                retention_days: 90,
                created_at: new Date('2026-10-01T10:00:00.000Z'),
                max_templates: 5,
                max_candidates: 25,
                trial_ends_at: null,
                pending_invite_multiplier: 2.0,
                flags: {},
                admin_id: null,
                admin_name: null,
                admin_email: null,
                admin_status: null,
                admin_last_login_at: null,
                candidate_count: 5,
                assessment_count: 2,
                // Suppose 4 active workspaces (1 provisioning + 1 not_connected + 1 connected + 1 disconnected)
                // while ended, destroyed, and failed are excluded
                active_workspaces_count: 4,
              },
            ],
          };
        }

        return { rows: [] };
      });

      const detail = await service.getOrganizationById(testOrgId);

      // Verify the executed SQL query contains all included statuses
      expect(executedSql).toContain("w.status IN ('provisioning', 'not_connected', 'connected', 'disconnected')");

      // Verify excluded statuses are NOT in the active workspaces subquery
      expect(executedSql).not.toContain("'ended'");
      expect(executedSql).not.toContain("'destroyed'");
      expect(executedSql).not.toContain("'failed'");

      // Verify active count is mapped correctly
      expect(detail.stats.activeWorkspacesCount).toBe(4);
    });
  });

  describe('AdminOrganizationsService.updateEntitlements', () => {
    it('updates entitlements and writes append-only audit log', async () => {
      const updateDto: UpdateOrgEntitlementsDto = {
        maxTemplates: 15,
        maxCandidates: 100,
        pendingInviteMultiplier: 3.0,
        flags: {
          cloud: true,
          chat: true,
          white_label: true,
          custom_domain: true,
        },
        reason: 'Upgrade requested by customer',
      };

      const auditEventRows: any[] = [];

      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
          return { rows: [] };
        }

        if (sql.includes('SELECT id, name FROM app.organizations WHERE id = $1')) {
          return { rows: [{ id: testOrgId, name: 'Acme Hiring Corp' }] };
        }

        if (sql.includes('FROM app.entitlements WHERE org_id = $1')) {
          return {
            rows: [
              {
                org_id: testOrgId,
                max_templates: 5,
                max_candidates: 25,
                trial_ends_at: null,
                pending_invite_multiplier: 2.0,
                flags: { cloud: true, chat: true },
              },
            ],
          };
        }

        if (sql.includes('INSERT INTO app.entitlements')) {
          return { rowCount: 1 };
        }

        if (sql.includes('audit.latest_event_hash')) {
          return { rows: [{ hash: Buffer.from('prevhash123') }] };
        }

        if (sql.includes('INSERT INTO audit.events')) {
          auditEventRows.push(params);
          return { rowCount: 1 };
        }

        // Final query to reload getOrganizationById
        if (sql.includes('FROM app.organizations o')) {
          return {
            rows: [
              {
                id: testOrgId,
                name: 'Acme Hiring Corp',
                slug: 'acme-hiring',
                status: 'paid_active',
                plan_id: 'plan_pro',
                logo_url: null,
                white_label: true,
                custom_domain: null,
                retention_days: 90,
                created_at: new Date('2026-10-01T10:00:00.000Z'),
                max_templates: updateDto.maxTemplates,
                max_candidates: updateDto.maxCandidates,
                trial_ends_at: null,
                pending_invite_multiplier: updateDto.pendingInviteMultiplier,
                flags: updateDto.flags,
                primary_admin_id: null,
                primary_admin_name: null,
                primary_admin_email: null,
                candidate_count: 5,
                assessment_count: 2,
                active_workspaces_count: 0,
              },
            ],
          };
        }

        return { rows: [] };
      });

      const updated = await service.updateEntitlements(
        testOrgId,
        updateDto,
        testAdminUser,
        testMeta,
      );

      expect(updated).toBeDefined();
      expect(updated.entitlements.maxTemplates).toBe(15);
      expect(updated.entitlements.maxCandidates).toBe(100);
      expect(updated.entitlements.pendingInviteMultiplier).toBe(3.0);
      expect(updated.entitlements.flags.white_label).toBe(true);

      // Verify audit event was logged
      expect(auditEventRows.length).toBe(1);
      const auditParams = auditEventRows[0];
      // auditParams: [$1: actorId, $2: actorRole, $3: orgId, $4: action, $5: entity, $6: entityId, $7: before, $8: after, $9: ip, $10: userAgent, $11: requestId, $12: prevHash, $13: hash]
      expect(auditParams[0]).toBe(testAdminUser.userId);
      expect(auditParams[1]).toBe(testAdminUser.role);
      expect(auditParams[2]).toBe(testOrgId);
      expect(auditParams[3]).toBe('entitlements.modified');
      expect(auditParams[4]).toBe('entitlements');
      expect(auditParams[5]).toBe(testOrgId);

      // Before/After payloads
      const beforeJson = JSON.parse(auditParams[6]);
      const afterJson = JSON.parse(auditParams[7]);

      expect(beforeJson.max_templates).toBe(5);
      expect(beforeJson.max_candidates).toBe(25);
      expect(afterJson.max_templates).toBe(15);
      expect(afterJson.max_candidates).toBe(100);
      expect(afterJson.reason).toBe('Upgrade requested by customer');

      expect(auditParams[8]).toBe(testMeta.ip);
      expect(auditParams[9]).toBe(testMeta.userAgent);
      expect(auditParams[10]).toBe(testMeta.requestId);
    });

    it('throws 404 when trying to update entitlements for non-existent org', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('SELECT set_config')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT id, name FROM app.organizations WHERE id = $1')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      await expect(
        service.updateEntitlements(testOrgId, { maxTemplates: 10 }, testAdminUser, testMeta),
      ).rejects.toThrow(AppHttpException);
    });
  });

  describe('AdminOrganizationsController routing & validation', () => {
    it('rejects invalid UUID in getById with 422', async () => {
      await expect(controller.getById('invalid-uuid')).rejects.toThrow(AppHttpException);
    });

    it('rejects invalid UUID in updateEntitlements with 422', async () => {
      const mockReq: any = {
        user: testAdminUser,
        ip: '127.0.0.1',
        headers: {},
      };
      await expect(
        controller.updateEntitlements('not-a-uuid', { maxTemplates: 5 }, mockReq),
      ).rejects.toThrow(AppHttpException);
    });

    it('successfully proxies getById to service', async () => {
      const mockDetail: any = {
        id: testOrgId,
        name: 'Test Org',
        slug: 'test-org',
        status: 'trial_active',
        planId: 'plan_trial',
        logoUrl: null,
        whiteLabel: false,
        customDomain: null,
        retentionDays: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entitlements: {
          orgId: testOrgId,
          maxTemplates: 5,
          maxCandidates: 25,
          trialEndsAt: null,
          pendingInviteMultiplier: 2.0,
          flags: {},
          updatedAt: new Date().toISOString(),
        },
        primaryAdmin: null,
        stats: {
          candidateCount: 0,
          assessmentCount: 0,
          activeWorkspacesCount: 0,
        },
      };

      vi.spyOn(service, 'getOrganizationById').mockResolvedValue(mockDetail);

      const res = await controller.getById(testOrgId);
      expect(res).toEqual(mockDetail);
      expect(service.getOrganizationById).toHaveBeenCalledWith(testOrgId);
    });

    it('successfully proxies updateEntitlements to service with request metadata', async () => {
      const mockDetail: any = {
        id: testOrgId,
        name: 'Test Org',
        slug: 'test-org',
        status: 'trial_active',
        planId: 'plan_trial',
        logoUrl: null,
        whiteLabel: false,
        customDomain: null,
        retentionDays: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entitlements: {
          orgId: testOrgId,
          maxTemplates: 10,
          maxCandidates: 50,
          trialEndsAt: null,
          pendingInviteMultiplier: 2.0,
          flags: {},
          updatedAt: new Date().toISOString(),
        },
        primaryAdmin: null,
        stats: {
          candidateCount: 0,
          assessmentCount: 0,
          activeWorkspacesCount: 0,
        },
      };

      vi.spyOn(service, 'updateEntitlements').mockResolvedValue(mockDetail);

      const mockReq: any = {
        user: testAdminUser,
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'Vitest-Agent',
        },
        id: 'req-abc',
      };

      const res = await controller.updateEntitlements(
        testOrgId,
        { maxTemplates: 10, maxCandidates: 50 },
        mockReq,
      );

      expect(res).toEqual(mockDetail);
      expect(service.updateEntitlements).toHaveBeenCalledWith(
        testOrgId,
        { maxTemplates: 10, maxCandidates: 50 },
        testAdminUser,
        {
          ip: '10.0.0.1',
          userAgent: 'Vitest-Agent',
          requestId: 'req-abc',
        },
      );
    });
  });
});
