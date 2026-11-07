import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminWorkspacesService } from '../src/modules/admin/admin-workspaces.service.js';
import { AdminWorkspacesController } from '../src/modules/admin/admin-workspaces.controller.js';
import type { UserContext } from '../src/common/types/user-context.js';
import type { RequestMeta } from '../src/modules/auth/auth.service.js';
import { AppHttpException } from '../src/common/errors/app-http.exception.js';

describe('AdminWorkspacesService & AdminWorkspacesController (S1B-T05-3)', () => {
  const testAdminUser: UserContext = {
    userId: 'admin-user-1',
    email: 'admin@hellosmart.ai',
    role: 'platform_admin',
    orgId: null,
  };

  const testCompanyUser: UserContext = {
    userId: 'company-user-1',
    email: 'hr@acme.test',
    role: 'company_admin',
    orgId: '22222222-2222-2222-2222-222222222222',
  };

  const testMeta: RequestMeta = {
    ip: '10.0.0.1',
    userAgent: 'SuperAdmin-Browser/1.0',
    requestId: 'req-ws-test-123',
  };

  let mockClient: any;
  let mockPool: any;
  let service: AdminWorkspacesService;
  let controller: AdminWorkspacesController;
  let queryHistory: Array<{ sql: string; params: any[] }>;

  const sampleWorkspaceRow = {
    id: '11111111-1111-4111-8111-111111111111',
    org_id: '22222222-2222-4222-8222-222222222222',
    org_name: 'Acme Corp',
    org_slug: 'acme-corp',
    candidate_id: '33333333-3333-4333-8333-333333333333',
    candidate_name: 'Jane Candidate',
    candidate_email: 'jane@example.test',
    assignment_id: '44444444-4444-4444-8444-444444444444',
    assessment_id: '55555555-5555-4555-8555-555555555555',
    assessment_name: 'Full Stack Engineer Evaluation',
    mode: 'cloud',
    status: 'connected',
    runtime_ref: 'container-vm-998',
    snapshot_ref: 's3://snapshots/ws-1111.tar.gz',
    started_at: new Date(Date.now() - 3600000), // 1 hour ago
    last_activity_at: new Date(Date.now() - 120000), // 2 mins ago
    disconnected_at: null,
    ended_at: null,
    deadline_at: new Date(Date.now() + 7200000), // 2 hours remaining
    allocated_amount_cents: 50000,
    used_amount_cents: 0,
    balance_cents: 50000,
    markup_percentage: 15.0,
    spend_cap_cents: 100000,
  };

  beforeEach(() => {
    queryHistory = [];
    mockClient = {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        queryHistory.push({ sql, params });

        if (
          sql.includes('BEGIN') ||
          sql.includes('COMMIT') ||
          sql.includes('SELECT set_config') ||
          sql.includes('audit.latest_event_hash')
        ) {
          return { rows: [{ hash: Buffer.from('prev-hash-123') }] };
        }

        // Count query for listWorkspaces
        if (sql.includes('SELECT COUNT(*)::int AS total FROM app.workspaces')) {
          return { rows: [{ total: 1 }] };
        }

        // Aggregate metrics query
        if (sql.includes('total_workspaces') && sql.includes('active_workspaces')) {
          return {
            rows: [
              {
                total_workspaces: 12,
                active_workspaces: 5,
                connected_count: 3,
                disconnected_count: 2,
                destroyed_count: 1,
                ended_count: 6,
                tracked_tenants_count: 4,
              },
            ],
          };
        }

        // Page list query
        if (sql.includes('FROM app.workspaces w') && sql.includes('LIMIT')) {
          return { rows: [sampleWorkspaceRow] };
        }

        // Get single workspace detail
        if (sql.includes('WHERE w.id = $1')) {
          return {
            rows: [
              {
                ...sampleWorkspaceRow,
                extended_minutes: 15,
                first_connect_at: sampleWorkspaceRow.started_at,
                submitted_at: null,
                auto_submitted: false,
                write_revoked_at: null,
                allocation_id: '66666666-6666-4666-8666-666666666666',
                allocation_status: 'active',
              },
            ],
          };
        }

        // Recent activity events query
        if (sql.includes('FROM app.activity_events')) {
          return {
            rows: [
              {
                id: '77777777-7777-4777-8777-777777777777',
                type: 'connect',
                payload: { pauseTimerOnDisconnect: false },
                ip: '10.0.0.50',
                at: new Date(Date.now() - 3600000),
              },
            ],
          };
        }

        // Initial fetch of workspace for destroy
        if (sql.includes('FROM app.workspaces') && sql.includes('WHERE id = $1') && !sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.id,
                org_id: sampleWorkspaceRow.org_id,
                assignment_id: sampleWorkspaceRow.assignment_id,
                mode: sampleWorkspaceRow.mode,
                status: sampleWorkspaceRow.status,
                snapshot_ref: sampleWorkspaceRow.snapshot_ref,
                runtime_ref: sampleWorkspaceRow.runtime_ref,
              },
            ],
            rowCount: 1,
          };
        }

        // Lock assignment row FOR UPDATE
        if (sql.includes('FROM app.assignments') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.assignment_id,
                status: 'in_progress',
                write_revoked_at: null,
              },
            ],
            rowCount: 1,
          };
        }

        // Row lock for destroy: SELECT ... FOR UPDATE
        if (sql.includes('FROM app.workspaces') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.id,
                org_id: sampleWorkspaceRow.org_id,
                assignment_id: sampleWorkspaceRow.assignment_id,
                mode: sampleWorkspaceRow.mode,
                status: sampleWorkspaceRow.status,
                snapshot_ref: sampleWorkspaceRow.snapshot_ref,
                runtime_ref: sampleWorkspaceRow.runtime_ref,
              },
            ],
            rowCount: 1,
          };
        }

        // Mutation updates and inserts
        if (
          sql.includes('UPDATE app.workspaces') ||
          sql.includes('UPDATE app.assignments') ||
          sql.includes('INSERT INTO app.activity_events') ||
          sql.includes('INSERT INTO audit.events')
        ) {
          return { rows: [], rowCount: 1 };
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    service = new AdminWorkspacesService(mockPool);
    controller = new AdminWorkspacesController(service);
  });

  describe('listWorkspaces', () => {
    it('returns paginated workspace list and honest spend telemetry', async () => {
      const res = await service.listWorkspaces(
        { page: 1, page_size: 25, status: 'all', mode: 'all' },
        testAdminUser,
      );

      expect(res.total).toBe(1);
      expect(res.items).toHaveLength(1);
      const ws = res.items[0]!;
      expect(ws.id).toBe(sampleWorkspaceRow.id);
      expect(ws.orgName).toBe('Acme Corp');
      expect(ws.candidateName).toBe('Jane Candidate');
      expect(ws.candidateEmail).toBe('jane@example.test');
      expect(ws.status).toBe('connected');
      expect(ws.isOnline).toBe(true);
      expect(ws.idleMinutes).toBeLessThan(5);

      // Honest spend check: never fabricate fake usage
      expect(ws.spendInfo.meteringStatus).toBe('unconnected');
      expect(ws.spendInfo.meteringNotice).toBe('AI proxy runtime metering unconnected');
      expect(ws.spendInfo.allocatedAmountCents).toBe(50000);
      expect(ws.spendInfo.balanceCents).toBe(50000);
      expect(ws.spendInfo.markupPercentage).toBe(15.0);

      // Aggregate metrics
      expect(res.metrics.totalWorkspaces).toBe(12);
      expect(res.metrics.activeWorkspaces).toBe(5);
      expect(res.metrics.connectedCount).toBe(3);
      expect(res.metrics.trackedTenantsCount).toBe(4);
    });

    it('filters by status, mode, and search keyword', async () => {
      await service.listWorkspaces(
        {
          page: 1,
          page_size: 10,
          status: 'connected',
          mode: 'cloud',
          search: 'Jane',
          org_id: sampleWorkspaceRow.org_id,
        },
        testAdminUser,
      );

      const listQuery = queryHistory.find((q) => q.sql.includes('FROM app.workspaces w') && q.sql.includes('LIMIT'));
      expect(listQuery).toBeDefined();
      expect(listQuery!.sql).toContain('w.org_id = $');
      expect(listQuery!.sql).toContain('w.status = $');
      expect(listQuery!.sql).toContain('w.mode = $');
      expect(listQuery!.sql).toContain('ILIKE $');
      expect(listQuery!.params).toContain(sampleWorkspaceRow.org_id);
      expect(listQuery!.params).toContain('connected');
      expect(listQuery!.params).toContain('cloud');
      expect(listQuery!.params).toContain('%Jane%');
    });

    it('filters active workspaces including provisioning, not_connected, connected, disconnected', async () => {
      await service.listWorkspaces({ status: 'active' }, testAdminUser);
      const listQuery = queryHistory.find((q) => q.sql.includes('FROM app.workspaces w') && q.sql.includes('LIMIT'));
      expect(listQuery!.sql).toContain(
        "w.status IN ('queued', 'provisioning', 'not_connected', 'connected', 'disconnected')",
      );
    });
  });

  describe('getWorkspaceDetail', () => {
    it('returns full workspace details with activity history and allocation context', async () => {
      const res = await service.getWorkspaceDetail(sampleWorkspaceRow.id, testAdminUser);
      expect(res.id).toBe(sampleWorkspaceRow.id);
      expect(res.recentEvents).toHaveLength(1);
      expect(res.recentEvents[0]!.type).toBe('connect');
      expect(res.tenantCreditAllocation).toBeDefined();
      expect(res.tenantCreditAllocation?.allocatedAmountCents).toBe(50000);
      expect(res.assignmentTiming?.extendedMinutes).toBe(15);
    });

    it('throws 404 when workspace does not exist', async () => {
      mockClient.query.mockImplementationOnce(async (sql: string) => {
        if (sql.includes('WHERE w.id = $1')) return { rows: [] };
        return { rows: [] };
      });

      await expect(
        service.getWorkspaceDetail('00000000-0000-0000-0000-000000000000', testAdminUser),
      ).rejects.toMatchObject({
        status: 404,
        code: 'WORKSPACE_NOT_FOUND',
      });
    });
  });

  describe('destroyWorkspace (Emergency Kill-Switch)', () => {
    it('successfully emergency destroys an active connected workspace with transactional audit', async () => {
      const reason = 'Candidate requested early termination due to emergency';
      const res = await service.destroyWorkspace(
        sampleWorkspaceRow.id,
        { reason },
        testAdminUser,
        testMeta,
      );

      expect(res.success).toBe(true);
      expect(res.workspaceId).toBe(sampleWorkspaceRow.id);
      expect(res.status).toBe('destroyed');
      expect(res.assignmentRevoked).toBe(true);
      expect(res.reason).toBe(reason);

      // Verify limitations are honestly represented
      expect(res.limitations.runtimeTerminated).toBe(false);
      expect(res.limitations.candidateNotified).toBe(false);

      // Check SQL execution order
      const updateWs = queryHistory.find((q) => q.sql.includes("UPDATE app.workspaces\n              SET status = 'destroyed'"));
      expect(updateWs).toBeDefined();

      const updateAsg = queryHistory.find((q) => q.sql.includes("UPDATE app.assignments\n              SET write_revoked_at = $3,\n                  status = 'revoked'"));
      expect(updateAsg).toBeDefined();

      const insertEvent = queryHistory.find((q) => q.sql.includes('INSERT INTO app.activity_events'));
      expect(insertEvent).toBeDefined();
      expect(insertEvent!.params[3]).toContain('emergency');

      const insertAudit = queryHistory.find((q) => q.sql.includes('INSERT INTO audit.events'));
      expect(insertAudit).toBeDefined();
      expect(insertAudit!.params[3]).toBe('workspace.emergency_destroyed');
      expect(insertAudit!.params[4]).toBe('workspace');
      expect(insertAudit!.params[5]).toBe(sampleWorkspaceRow.id);
    });

    it('rejects destruction of an already destroyed workspace with 409 Conflict', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM app.workspaces') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.id,
                org_id: sampleWorkspaceRow.org_id,
                status: 'destroyed',
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(
        service.destroyWorkspace(
          sampleWorkspaceRow.id,
          { reason: 'Duplicate termination request' },
          testAdminUser,
          testMeta,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: 'WORKSPACE_ALREADY_TERMINATED',
      });
    });

    it('rejects destruction of an already ended workspace with 409 Conflict', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM app.workspaces') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.id,
                org_id: sampleWorkspaceRow.org_id,
                status: 'ended',
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(
        service.destroyWorkspace(
          sampleWorkspaceRow.id,
          { reason: 'Late kill attempt' },
          testAdminUser,
          testMeta,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: 'WORKSPACE_ALREADY_TERMINATED',
      });
    });

    it('fails closed and rolls back if audit log persistence fails', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO audit.events')) {
          throw new Error('Disk full: audit append failed');
        }
        if (sql.includes('FROM app.workspaces') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: sampleWorkspaceRow.id,
                org_id: sampleWorkspaceRow.org_id,
                status: 'connected',
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(
        service.destroyWorkspace(
          sampleWorkspaceRow.id,
          { reason: 'Security anomaly identified' },
          testAdminUser,
          testMeta,
        ),
      ).rejects.toThrow('Disk full: audit append failed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('fails and rolls back transaction when UPDATE app.assignments affects zero rows', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (
          sql.includes('BEGIN') ||
          sql.includes('ROLLBACK') ||
          sql.includes('SELECT set_config') ||
          sql.includes('audit.latest_event_hash')
        ) {
          return { rows: [{ hash: Buffer.from('prev-hash-123') }] };
        }
        if (sql.includes('FROM app.workspaces') && !sql.includes('FOR UPDATE')) {
          return { rows: [sampleWorkspaceRow], rowCount: 1 };
        }
        if (sql.includes('FROM app.assignments') && sql.includes('FOR UPDATE')) {
          return {
            rows: [{ id: sampleWorkspaceRow.assignment_id, status: 'in_progress', write_revoked_at: null }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM app.workspaces') && sql.includes('FOR UPDATE')) {
          return { rows: [sampleWorkspaceRow], rowCount: 1 };
        }
        if (sql.includes('UPDATE app.workspaces')) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE app.assignments')) {
          // Zero rows affected simulates orphaned workspace or missing assignment
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 1 };
      });

      await expect(
        service.destroyWorkspace(
          sampleWorkspaceRow.id,
          { reason: 'Security emergency check' },
          testAdminUser,
          testMeta,
        ),
      ).rejects.toMatchObject({
        status: 500,
        code: 'ASSIGNMENT_REVOCATION_FAILED',
      });

      // Verify no activity or audit events were recorded after revocation failure
      const insertedAudit = queryHistory.find((q) => q.sql.includes('INSERT INTO audit.events'));
      expect(insertedAudit).toBeUndefined();
      const insertedActivity = queryHistory.find((q) => q.sql.includes('INSERT INTO app.activity_events'));
      expect(insertedActivity).toBeUndefined();

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('fails and rolls back transaction when assignment is missing during lock acquisition', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (
          sql.includes('BEGIN') ||
          sql.includes('ROLLBACK') ||
          sql.includes('SELECT set_config')
        ) {
          return { rows: [] };
        }
        if (sql.includes('FROM app.workspaces') && !sql.includes('FOR UPDATE')) {
          return { rows: [sampleWorkspaceRow], rowCount: 1 };
        }
        if (sql.includes('FROM app.assignments') && sql.includes('FOR UPDATE')) {
          // Zero rows returned on lock acquisition
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 1 };
      });

      await expect(
        service.destroyWorkspace(
          sampleWorkspaceRow.id,
          { reason: 'Security emergency check' },
          testAdminUser,
          testMeta,
        ),
      ).rejects.toMatchObject({
        status: 500,
        code: 'ASSIGNMENT_REVOCATION_FAILED',
      });

      const updatedWs = queryHistory.find((q) => q.sql.includes('UPDATE app.workspaces'));
      expect(updatedWs).toBeUndefined();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Controller Role & Input Validation', () => {
    it('throws 422 for invalid reason payload (less than 5 characters)', async () => {
      const mockReq: any = {
        user: testAdminUser,
        headers: {},
      };

      await expect(
        controller.destroy(sampleWorkspaceRow.id, { reason: 'bad' }, mockReq),
      ).rejects.toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws 422 for invalid workspace id UUID format', async () => {
      const mockReq: any = {
        user: testAdminUser,
        headers: {},
      };

      await expect(
        controller.getDetail('non-uuid-string', mockReq),
      ).rejects.toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR',
      });
    });
  });
});

