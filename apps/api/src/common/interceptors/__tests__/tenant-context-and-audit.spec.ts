import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError, lastValueFrom, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TenantContextInterceptor } from '../tenant-context.interceptor.js';
import { TenantContextService } from '../../database/tenant-context.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLogService, redactSensitiveData } from '../../audit/audit-log.service.js';
import { ProblemDetailsException } from '../../exceptions/problem-details.exception.js';
import { AuthenticatedUser } from '../../constants/auth.constants.js';

describe('Subtask 9.2: Tenant Context Interceptor & Shared AuditLogService', () => {
  let databaseService: DatabaseService;
  let tenantContextService: TenantContextService;
  let tenantContextInterceptor: TenantContextInterceptor;
  let auditLogService: AuditLogService;

  beforeEach(() => {
    databaseService = new DatabaseService();
    tenantContextService = new TenantContextService();
    tenantContextInterceptor = new TenantContextInterceptor(databaseService, tenantContextService);
    auditLogService = new AuditLogService(databaseService, tenantContextService);
  });

  const createMockExecutionContext = (user?: AuthenticatedUser): { context: ExecutionContext; req: any } => {
    const req: any = {
      user,
      headers: {},
      cookies: {},
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  const createMockClient = () => {
    const executedQueries: Array<{ text: string; values?: any[] | undefined }> = [];
    let isReleased = false;

    const client = {
      query: vi.fn(async (text: string, values?: any[]): Promise<any> => {
        executedQueries.push({ text, values: values ?? undefined });
        if (text.includes('INSERT INTO app.audit_logs')) {
          return { rows: [{ id: '101', at: new Date() }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(() => {
        isReleased = true;
      }),
      getExecutedQueries: () => executedQueries,
      isReleased: () => isReleased,
    };

    return client;
  };

  describe('TenantContextInterceptor (Database Tenant Isolation & Transactions)', () => {
    it('should bypass transaction for unauthenticated / public routes', async () => {
      const { context } = createMockExecutionContext(undefined);
      const mockClient = createMockClient();
      tenantContextInterceptor.setClientFactory(async () => mockClient);

      const handler: CallHandler = {
        handle: () => of({ success: true }),
      };

      const result = await lastValueFrom(tenantContextInterceptor.intercept(context, handler));
      expect(result).toEqual({ success: true });
      expect(mockClient.getExecutedQueries()).toHaveLength(0);
      expect(mockClient.isReleased()).toBe(false);
    });

    it('should enforce SET LOCAL app.current_org_id and app.current_role inside transaction for company_admin', async () => {
      const user: AuthenticatedUser = {
        userId: 'user-ca-123',
        orgId: 'org-tenant-999',
        role: 'company_admin',
        email: 'admin@acme.com',
      };
      const { context, req } = createMockExecutionContext(user);
      const mockClient = createMockClient();
      tenantContextInterceptor.setClientFactory(async () => mockClient);

      let executedInTx = false;
      const handler: CallHandler = {
        handle: () => {
          // Verify AsyncLocalStorage has active client & tenant context during handler execution
          const currentStore = tenantContextService.getContext();
          expect(currentStore?.orgId).toBe('org-tenant-999');
          expect(currentStore?.role).toBe('company_admin');
          expect(currentStore?.inTransaction).toBe(true);
          expect(tenantContextService.getCurrentClient()).toBe(mockClient);
          executedInTx = true;
          return of({ data: 'tenant_records' });
        },
      };

      const result = await lastValueFrom(tenantContextInterceptor.intercept(context, handler));
      expect(result).toEqual({ data: 'tenant_records' });
      expect(executedInTx).toBe(true);

      const queries = mockClient.getExecutedQueries();
      // 1. Transaction started
      expect(queries[0]!.text).toBe('BEGIN');
      // 2. SET LOCAL app.current_org_id and app.current_role executed before any query
      const orgQuery = queries.find(
        (q) => q.text.includes('SET LOCAL app.current_org_id') || q.text.includes("set_config('app.current_org_id'"),
      );
      expect(orgQuery).toBeDefined();

      const roleQuery = queries.find(
        (q) => q.text.includes('SET LOCAL app.current_role') || q.text.includes("set_config('app.current_role'"),
      );
      expect(roleQuery).toBeDefined();

      // 3. Transaction committed
      expect(queries[queries.length - 1]!.text).toBe('COMMIT');
      expect(mockClient.isReleased()).toBe(true);
    });

    it('should set role context and app.is_platform for platform_admin without requiring an orgId', async () => {
      const user: AuthenticatedUser = {
        userId: 'user-pa-1',
        orgId: null,
        role: 'platform_admin',
        email: 'superadmin@hellosmart.ai',
      };
      const { context } = createMockExecutionContext(user);
      const mockClient = createMockClient();
      tenantContextInterceptor.setClientFactory(async () => mockClient);

      const handler: CallHandler = {
        handle: () => of({ platform: true }),
      };

      const result = await lastValueFrom(tenantContextInterceptor.intercept(context, handler));
      expect(result).toEqual({ platform: true });

      const queries = mockClient.getExecutedQueries();
      expect(queries[0]!.text).toBe('BEGIN');

      const isPlatformQuery = queries.find((q) => q.text.includes("set_config('app.is_platform'"));
      expect(isPlatformQuery).toBeDefined();

      expect(queries[queries.length - 1]!.text).toBe('COMMIT');
      expect(mockClient.isReleased()).toBe(true);
    });

    it('should fail closed (403 Forbidden) when a tenant role lacks an orgId', () => {
      const user: AuthenticatedUser = {
        userId: 'user-no-org',
        orgId: null,
        role: 'company_admin',
        email: 'broken@example.com',
      };
      const { context } = createMockExecutionContext(user);
      const handler: CallHandler = { handle: () => of({}) };

      expect(() => tenantContextInterceptor.intercept(context, handler)).toThrowError(
        ProblemDetailsException,
      );

      try {
        tenantContextInterceptor.intercept(context, handler);
      } catch (err: any) {
        expect(err.problem.status).toBe(403);
        expect(err.problem.code).toBe('TENANT_REQUIRED');
      }
    });

    it('should rollback transaction and release client when route handler throws an error', async () => {
      const user: AuthenticatedUser = {
        userId: 'user-ca-123',
        orgId: 'org-tenant-999',
        role: 'company_admin',
        email: 'admin@acme.com',
      };
      const { context } = createMockExecutionContext(user);
      const mockClient = createMockClient();
      tenantContextInterceptor.setClientFactory(async () => mockClient);

      const handler: CallHandler = {
        handle: () => throwError(() => new Error('DB write failed')),
      };

      await expect(lastValueFrom(tenantContextInterceptor.intercept(context, handler))).rejects.toThrow(
        'DB write failed',
      );

      const queries = mockClient.getExecutedQueries();
      expect(queries[0]!.text).toBe('BEGIN');
      expect(queries[queries.length - 1]!.text).toBe('ROLLBACK');
      expect(mockClient.isReleased()).toBe(true);
    });

    it('should fail closed and abort request if setting tenant context throws an error', async () => {
      const user: AuthenticatedUser = {
        userId: 'user-ca-123',
        orgId: 'org-tenant-999',
        role: 'company_admin',
        email: 'admin@acme.com',
      };
      const { context } = createMockExecutionContext(user);
      const mockClient = createMockClient();
      // Simulate database failure when setting local config
      mockClient.query = vi.fn().mockImplementation(async (text: string) => {
        if (text.includes('SET LOCAL') || text.includes('set_config')) {
          throw new Error('Database permission denied for configuration');
        }
        return { rows: [] };
      });
      tenantContextInterceptor.setClientFactory(async () => mockClient);

      const handler: CallHandler = { handle: () => of({}) };

      await expect(lastValueFrom(tenantContextInterceptor.intercept(context, handler))).rejects.toThrow(
        ProblemDetailsException,
      );

      expect(mockClient.isReleased()).toBe(true);
    });

    it('shows queries inside a request only return the caller org rows (Tenant Isolation Test)', async () => {
      const userOrgA: AuthenticatedUser = {
        userId: 'user-a',
        orgId: 'org-aaa',
        role: 'company_admin',
        email: 'a@org-a.com',
      };

      // Mock DB table rows for two distinct tenants
      const allRowsInDatabase = [
        { id: '1', org_id: 'org-aaa', name: 'Candidate A1' },
        { id: '2', org_id: 'org-bbb', name: 'Candidate B1' },
        { id: '3', org_id: 'org-aaa', name: 'Candidate A2' },
      ];

      const { context } = createMockExecutionContext(userOrgA);
      const mockClient = createMockClient();

      // Implement Postgres RLS filter simulation based on set app.current_org_id
      let sessionOrgId: string | null = null;
      mockClient.query = vi.fn(async (text: string, values?: any[]): Promise<any> => {
        if (text.includes("set_config('app.current_org_id'") || text.includes('SET LOCAL app.current_org_id')) {
          sessionOrgId = values ? values[0] : 'org-aaa';
          return { rows: [], rowCount: 1 };
        }
        if (text.includes('SELECT * FROM app.candidates')) {
          // RLS: USING (org_id = app.current_org_id())
          const visibleRows = allRowsInDatabase.filter((row) => row.org_id === sessionOrgId);
          return { rows: visibleRows, rowCount: visibleRows.length };
        }
        return { rows: [], rowCount: 1 };
      });

      tenantContextInterceptor.setClientFactory(async () => mockClient);

      const handler: CallHandler = {
        handle: () => {
          // Inside request: query candidates
          const client = tenantContextService.getCurrentClient();
          return from(client.query('SELECT * FROM app.candidates')).pipe(
            map((res: any) => res.rows),
          );
        },
      };

      const rows: any = await lastValueFrom(tenantContextInterceptor.intercept(context, handler));
      expect(rows).toHaveLength(2);
      expect(rows.every((r: any) => r.org_id === 'org-aaa')).toBe(true);
      expect(rows.some((r: any) => r.org_id === 'org-bbb')).toBe(false);
    });
  });

  describe('Shared AuditLogService & Secret Redaction (BR-31)', () => {
    it('should strip passwords, tokens, TOTP codes, and secrets from before and after payloads', () => {
      const sensitivePayload = {
        userId: 'usr-1',
        email: 'candidate@test.com',
        password: 'SuperSecretPassword123!',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
        totp_code: '123456',
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        token: 'session-jwt-token-value',
        apiKey: 'sk-ant-api03-secret',
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
        normalField: 'Normal Data',
        nested: {
          client_secret: 'oauth-secret-key',
          accountStatus: 'active',
          hs_session: 'cookie-session-token',
        },
        list: [
          { itemKey: 'safe', token: 'raw-token' },
          { password: 'nested-pass', note: 'safe-note' },
        ],
      };

      const redacted = redactSensitiveData(sensitivePayload);

      // Verify all sensitive keys are redacted
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.password_hash).toBe('[REDACTED]');
      expect(redacted.totp_code).toBe('[REDACTED]');
      expect(redacted.mfa_secret).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.nested?.client_secret).toBe('[REDACTED]');
      expect(redacted.nested?.hs_session).toBe('[REDACTED]');
      expect(redacted.list?.[0]?.token).toBe('[REDACTED]');
      expect(redacted.list?.[1]?.password).toBe('[REDACTED]');

      // Verify safe fields are preserved intact
      expect(redacted.userId).toBe('usr-1');
      expect(redacted.email).toBe('candidate@test.com');
      expect(redacted.normalField).toBe('Normal Data');
      expect(redacted.nested?.accountStatus).toBe('active');
      expect(redacted.list?.[0]?.itemKey).toBe('safe');
      expect(redacted.list?.[1]?.note).toBe('safe-note');
    });

    it('should record login attempts (auth.login.success & failure) in app.audit_logs with redacted secrets', async () => {
      const mockClient = createMockClient();

      // Successful login attempt
      const successRecord = await auditLogService.logAuthAttempt({
        userId: 'usr-123',
        email: 'user@acme.com',
        role: 'company_admin',
        orgId: 'org-1',
        success: true,
        ip: '192.168.1.1',
        metadata: { passwordAttempt: 'P@ssword123', totp: '998877' }, // sensitive test values
      }, mockClient);

      expect(successRecord.action).toBe('auth.login.success');
      expect(successRecord.entity).toBe('auth');
      expect(successRecord.actorRole).toBe('company_admin');
      expect(successRecord.after?.email).toBe('user@acme.com');
      expect(successRecord.after?.success).toBe(true);
      // Secrets must be redacted
      expect(successRecord.after?.passwordAttempt).toBe('[REDACTED]');
      expect(successRecord.after?.totp).toBe('[REDACTED]');

      // Failed login attempt
      const failRecord = await auditLogService.logAuthAttempt({
        email: 'attacker@evil.com',
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ip: '203.0.113.42',
      }, mockClient);

      expect(failRecord.action).toBe('auth.login.failure');
      expect(failRecord.after?.success).toBe(false);
      expect(failRecord.after?.reason).toBe('INVALID_CREDENTIALS');

      // Verify queries targeted app.audit_logs
      const queries = mockClient.getExecutedQueries();
      expect(queries.some((q) => q.text.includes('INSERT INTO app.audit_logs'))).toBe(true);
    });

    it('should record org.created events in app.audit_logs', async () => {
      const mockClient = createMockClient();

      const orgRecord = await auditLogService.logOrgCreated({
        actorId: 'admin-super-1',
        actorRole: 'platform_admin',
        orgId: 'org-new-corp',
        orgName: 'New Corp Inc.',
        slug: 'new-corp',
        ip: '10.0.0.1',
      }, mockClient);

      expect(orgRecord.action).toBe('org.created');
      expect(orgRecord.entity).toBe('organization');
      expect(orgRecord.entityId).toBe('org-new-corp');
      expect(orgRecord.actorRole).toBe('platform_admin');
      expect(orgRecord.after?.name).toBe('New Corp Inc.');
      expect(orgRecord.after?.slug).toBe('new-corp');

      const queries = mockClient.getExecutedQueries();
      expect(queries.some((q) => q.text.includes('INSERT INTO app.audit_logs'))).toBe(true);
    });

    it('should record status changes in app.audit_logs', async () => {
      const mockClient = createMockClient();

      const statusRecord = await auditLogService.logStatusChange({
        actorId: 'admin-super-1',
        actorRole: 'platform_admin',
        orgId: 'org-target-99',
        entity: 'organization',
        entityId: 'org-target-99',
        beforeStatus: 'trial_active',
        afterStatus: 'suspended',
        reason: 'Payment non-compliance',
      }, mockClient);

      expect(statusRecord.action).toBe('organization.status_changed');
      expect(statusRecord.entity).toBe('organization');
      expect(statusRecord.entityId).toBe('org-target-99');
      expect(statusRecord.before?.status).toBe('trial_active');
      expect(statusRecord.after?.status).toBe('suspended');
      expect(statusRecord.after?.reason).toBe('Payment non-compliance');
    });

    it('should write audit log in the same database transaction as the action', async () => {
      const mockClient = createMockClient();

      // Wrap an operation inside withTenantTransaction
      await tenantContextService.withTenantTransaction(
        mockClient,
        { orgId: 'org-tenant-1', role: 'company_admin' },
        async (txClient) => {
          // Action: perform update
          await txClient.query('UPDATE app.candidates SET status = $1 WHERE id = $2', ['active', 'c-1']);

          // Audit log: called without explicit client -> automatically borrows current tx client from AsyncLocalStorage
          await auditLogService.logStatusChange({
            actorId: 'admin-1',
            actorRole: 'company_admin',
            orgId: 'org-tenant-1',
            entity: 'candidate',
            entityId: 'c-1',
            beforeStatus: 'invited',
            afterStatus: 'active',
          });
        },
      );

      const queries = mockClient.getExecutedQueries();
      // Ensure the transaction envelope contains the update and audit log together before COMMIT
      const beginIdx = queries.findIndex((q) => q.text === 'BEGIN');
      const updateIdx = queries.findIndex((q) => q.text.includes('UPDATE app.candidates'));
      const auditIdx = queries.findIndex((q) => q.text.includes('INSERT INTO app.audit_logs'));
      const commitIdx = queries.findIndex((q) => q.text === 'COMMIT');

      expect(beginIdx).toBe(0);
      expect(updateIdx).toBeGreaterThan(beginIdx);
      expect(auditIdx).toBeGreaterThan(updateIdx);
      expect(commitIdx).toBeGreaterThan(auditIdx);
    });

    it('should compute cryptographic SHA-256 tamper-evident hash chain (BR-31)', async () => {
      auditLogService.clearInMemoryRecords();

      const r1 = await auditLogService.log({
        actorId: 'user-1',
        actorRole: 'company_admin',
        orgId: 'org-1',
        action: 'assessment.create',
        entity: 'assessment',
      });

      expect(r1.prevHash).toBeNull();
      expect(r1.hash).toMatch(/^[0-9a-f]{64}$/);

      const r2 = await auditLogService.log({
        actorId: 'user-1',
        actorRole: 'company_admin',
        orgId: 'org-1',
        action: 'assessment.publish',
        entity: 'assessment',
      });

      // r2's prevHash must strictly match r1's hash
      expect(r2.prevHash).toBe(r1.hash);
      expect(r2.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(r2.hash).not.toBe(r1.hash);
    });
  });
});
