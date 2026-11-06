import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  CURRENT_PRICING_VERSION,
  MODEL_PRICING_MATRIX,
  calculateModelBreakdown,
  computeTokenCostMicroDollars,
  formatMicroDollarsToUsd,
} from '../src/modules/workspaces/pricing/model-pricing.config.js';
import { FakeTokenUsageAdapter } from '../src/modules/workspaces/ports/token-usage.port.js';
import { FakeWorkspaceMeteringAdapter } from '../src/modules/workspaces/ports/workspace-metering.port.js';
import { FakeWorkspaceTelemetryRegistry } from '../src/modules/workspaces/fakes/fake-workspace-telemetry-registry.js';
import { WorkspaceTelemetryService } from '../src/modules/workspaces/workspace-telemetry.service.js';
import { PgWorkspaceTelemetryRegistryAdapter } from '../src/modules/workspaces/adapters/pg-workspace-telemetry-registry.adapter.js';
import { withOrg, withUserSession } from '../src/modules/tenancy/with-org.js';
import pg from 'pg';

async function checkDbConnection(): Promise<boolean> {
  try {
    const probe = new pg.Pool({
      connectionString: 'postgres://hs_owner:hs_owner_local@localhost:5432/hellosmart_test',
      connectionTimeoutMillis: 1000,
      max: 1,
    });
    const client = await probe.connect();
    await client.query('SELECT 1');
    client.release();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const isDbAvailable = await checkDbConnection();

describe('Workspace Compute & AI Token Spend Telemetry (BR-23, CO-035, CO-037, AD-018, NF-014)', () => {
  // ---------------------------------------------------------------------------
  // 1. Pure Unit Tests: Time & Duration Math
  // ---------------------------------------------------------------------------
  describe('Compute Duration Math', () => {
    it('calculates exact minutes for round minute durations', () => {
      const start = new Date('2026-11-06T10:00:00.000Z');
      const end120 = new Date('2026-11-06T10:02:00.000Z');
      const sec120 = BigInt(Math.floor((end120.getTime() - start.getTime()) / 1000));
      expect(sec120).toBe(120n);
      expect(Math.round(Number(sec120) / 60)).toBe(2);

      const end3600 = new Date('2026-11-06T11:00:00.000Z');
      const sec3600 = BigInt(Math.floor((end3600.getTime() - start.getTime()) / 1000));
      expect(sec3600).toBe(3600n);
      expect(Math.round(Number(sec3600) / 60)).toBe(60);
    });

    it('implements round-half-up for sub-minute durations (zero stays zero; not min-1)', () => {
      // 0 seconds -> 0 minutes
      expect(Math.round(0 / 60)).toBe(0);

      // 29 seconds -> rounds down to 0 minutes
      expect(Math.round(29 / 60)).toBe(0);

      // 30 seconds -> rounds half up to 1 minute
      expect(Math.round(30 / 60)).toBe(1);

      // 31 seconds -> rounds up to 1 minute
      expect(Math.round(31 / 60)).toBe(1);

      // 89 seconds (1m 29s) -> rounds down to 1 minute
      expect(Math.round(89 / 60)).toBe(1);

      // 90 seconds (1m 30s) -> rounds half up to 2 minutes
      expect(Math.round(90 / 60)).toBe(2);
    });

    it('accurately measures very long sessions (e.g. 48 hours)', () => {
      const hours48Sec = 48n * 3600n;
      expect(hours48Sec).toBe(172800n);
      expect(Math.round(Number(hours48Sec) / 60)).toBe(2880);
    });

    it('correctly calculates durations across UTC month and leap year boundaries', () => {
      const endOfFeb = new Date('2028-02-29T23:55:00.000Z');
      const startOfMar = new Date('2028-03-01T00:05:00.000Z');
      const elapsedSec = BigInt(Math.floor((startOfMar.getTime() - endOfFeb.getTime()) / 1000));
      expect(elapsedSec).toBe(600n);
      expect(Math.round(Number(elapsedSec) / 60)).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Pure Unit Tests: Money Math (BigInt Micro-Dollars, Zero Float Drift)
  // ---------------------------------------------------------------------------
  describe('Money & Token Pricing Math (BigInt Integer Micro-Dollars)', () => {
    it('computes exact zero cost for zero tokens', () => {
      const cost = computeTokenCostMicroDollars(0n, 5_000_000n);
      expect(cost).toBe(0n);
      expect(formatMicroDollarsToUsd(cost)).toBe('0.000000');
    });

    it('computes exact cost for 1,000,000 tokens at $5.00/M (exactly $5.000000)', () => {
      // 1M prompt tokens @ $5.00/1M = 5,000,000 micro-dollars ($5.00)
      const cost = computeTokenCostMicroDollars(1_000_000n, 5_000_000n);
      expect(cost).toBe(5_000_000n);
      expect(formatMicroDollarsToUsd(cost)).toBe('5.000000');
    });

    it('computes exact cost for 1,000,000 tokens at $15.00/M (exactly $15.000000)', () => {
      const cost = computeTokenCostMicroDollars(1_000_000n, 15_000_000n);
      expect(cost).toBe(15_000_000n);
      expect(formatMicroDollarsToUsd(cost)).toBe('15.000000');
    });

    it('applies round-half-up to integer micro-dollars for fractional token pricing', () => {
      // 1 token at $5.00/1M ($0.000005 per token = 5 micro-dollars):
      const cost1 = computeTokenCostMicroDollars(1n, 5_000_000n);
      expect(cost1).toBe(5n);
      expect(formatMicroDollarsToUsd(cost1)).toBe('0.000005');

      // 999,999 tokens at $5.00/1M = 4.999995 USD = 4,999,995 micro-dollars
      const cost999 = computeTokenCostMicroDollars(999_999n, 5_000_000n);
      expect(cost999).toBe(4_999_995n);
      expect(formatMicroDollarsToUsd(cost999)).toBe('4.999995');
    });

    it('handles very large token counts without 64-bit integer overflow', () => {
      // 500,000,000 tokens at $15.00/M = $7,500.00
      const largeTokens = 500_000_000n;
      const cost = computeTokenCostMicroDollars(largeTokens, 15_000_000n);
      expect(cost).toBe(7_500_000_000n); // 7.5 billion micro-dollars = $7,500.00
      expect(formatMicroDollarsToUsd(cost)).toBe('7500.000000');
    });

    it('returns $0.000000 and unknown flag for unknown models while keeping token counts', () => {
      const res = calculateModelBreakdown('unregistered-custom-llm', 12345n, 67890n);
      expect(res.isUnknown).toBe(true);
      expect(res.breakdown.model).toBe('unregistered-custom-llm');
      expect(res.breakdown.promptTokens).toBe('12345');
      expect(res.breakdown.completionTokens).toBe('67890');
      expect(res.breakdown.totalCostMicroDollars).toBe('0');
      expect(res.breakdown.totalCostUsd).toBe('0.000000');
    });

    it('safely handles hostile model names (e.g. SQL injection attempts)', () => {
      const maliciousModel = "gpt-4o'; DROP TABLE app.workspace_usage; --";
      const res = calculateModelBreakdown(maliciousModel, 100n, 200n);
      expect(res.isUnknown).toBe(true);
      expect(res.breakdown.model).toBe(maliciousModel);
      expect(res.breakdown.totalCostUsd).toBe('0.000000');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. In-Memory Service Logic (State Transitions, Idempotency, Backfill)
  // ---------------------------------------------------------------------------
  describe('WorkspaceTelemetryService (In-Memory)', () => {
    let registry: FakeWorkspaceTelemetryRegistry;
    let tokenUsage: FakeTokenUsageAdapter;
    let metering: FakeWorkspaceMeteringAdapter;
    let service: WorkspaceTelemetryService;

    beforeAll(() => {
      registry = new FakeWorkspaceTelemetryRegistry();
      tokenUsage = new FakeTokenUsageAdapter();
      metering = new FakeWorkspaceMeteringAdapter();
      service = new WorkspaceTelemetryService(registry, tokenUsage, metering);
    });

    it('returns not_completed when workspace is still active (status = connected)', async () => {
      const wsId = '11111111-1111-4111-8111-111111111111';
      registry.setSession({
        workspaceId: wsId,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'connected',
        startedAt: new Date(Date.now() - 60_000),
        endedAt: null,
      });

      const res = await service.recordSessionUsage(wsId);
      expect(res.recorded).toBe(false);
      expect(res.reason).toBe('not_completed');
    });

    it('returns not_completed when ended_at is null even if status is ended', async () => {
      const wsId = '22222222-2222-4222-8222-222222222222';
      registry.setSession({
        workspaceId: wsId,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'ended',
        startedAt: new Date(Date.now() - 60_000),
        endedAt: null,
      });

      const res = await service.recordSessionUsage(wsId);
      expect(res.recorded).toBe(false);
      expect(res.reason).toBe('not_completed');
    });

    it('records completed workspace session with itemized usage and token spend', async () => {
      const wsId = '33333333-3333-4333-8333-333333333333';
      const start = new Date('2026-11-06T10:00:00.000Z');
      const end = new Date('2026-11-06T10:30:00.000Z'); // 30 mins = 1800s

      registry.setSession({
        workspaceId: wsId,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'ended',
        startedAt: start,
        endedAt: end,
      });

      tokenUsage.setWorkspaceTokens(wsId, [
        { model: 'gpt-4o', promptTokens: 100_000n, completionTokens: 50_000n },
      ]);
      metering.setStorageMb(wsId, 250);

      const res = await service.recordSessionUsage(wsId);
      expect(res.recorded).toBe(true);
      expect(res.inserted).toBe(true);
      expect(res.usage).toBeDefined();

      const usage = res.usage!;
      expect(usage.computeSeconds).toBe(1800n);
      expect(usage.computeMinutes).toBe(30);
      expect(usage.storageMb).toBe(250);
      expect(usage.promptTokens).toBe(100_000n);
      expect(usage.completionTokens).toBe(50_000n);
      // 100,000 @ $5/M = $0.50. 50,000 @ $15/M = $0.75. Total = $1.250000
      expect(usage.totalCostUsd).toBe('1.250000');
      expect(usage.pricingVersion).toBe(CURRENT_PRICING_VERSION);
      expect(usage.status).toBe('complete');
      expect(usage.flags).toEqual([]);
    });

    it('idempotently handles second call (first call wins, no-op return)', async () => {
      const wsId = '33333333-3333-4333-8333-333333333333';
      const res2 = await service.recordSessionUsage(wsId);
      expect(res2.recorded).toBe(true);
      expect(res2.inserted).toBe(false);
      expect(res2.reason).toBe('already_recorded');
    });

    it('flags storage_not_metered when metering port returns null', async () => {
      const wsId = '44444444-4444-4444-8444-444444444444';
      registry.setSession({
        workspaceId: wsId,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'destroyed',
        startedAt: new Date('2026-11-06T10:00:00Z'),
        endedAt: new Date('2026-11-06T10:15:00Z'),
      });
      metering.setStorageMb(wsId, null);

      const res = await service.recordSessionUsage(wsId);
      expect(res.recorded).toBe(true);
      expect(res.usage?.storageMb).toBeNull();
      expect(res.usage?.flags).toContain('storage_not_metered');
      expect(res.usage?.status).toBe('complete');
    });

    it('flags unknown_model and marks partial when unpriced model is used', async () => {
      const wsId = '55555555-5555-4555-8555-555555555555';
      registry.setSession({
        workspaceId: wsId,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'ended',
        startedAt: new Date('2026-11-06T10:00:00Z'),
        endedAt: new Date('2026-11-06T10:10:00Z'),
      });
      tokenUsage.setWorkspaceTokens(wsId, [
        { model: 'unknown-vendor-llm', promptTokens: 5000n, completionTokens: 1000n },
      ]);

      const res = await service.recordSessionUsage(wsId);
      expect(res.recorded).toBe(true);
      expect(res.usage?.flags).toContain('unknown_model');
      expect(res.usage?.status).toBe('partial');
      expect(res.usage?.totalCostUsd).toBe('0.000000');
    });

    it('backfills completed sessions that lack usage records', async () => {
      const wsA = '66666666-6666-4666-8666-666666666666';
      const wsB = '77777777-7777-4777-8777-777777777777';
      registry.setSession({
        workspaceId: wsA,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'ended',
        startedAt: new Date('2026-11-06T10:00:00Z'),
        endedAt: new Date('2026-11-06T10:05:00Z'),
      });
      registry.setSession({
        workspaceId: wsB,
        orgId: 'org-1',
        assignmentId: 'asg-1',
        assessmentId: 'asm-1',
        candidateId: 'cand-1',
        status: 'destroyed',
        startedAt: new Date('2026-11-06T10:00:00Z'),
        endedAt: new Date('2026-11-06T10:20:00Z'),
      });

      const report = await service.backfillCompletedSessions(10);
      expect(report.scanned).toBe(2);
      expect(report.recorded).toBe(2);
      expect(report.failed).toBe(0);

      // Running backfill again returns 0 recorded
      const report2 = await service.backfillCompletedSessions(10);
      expect(report2.scanned).toBe(0);
      expect(report2.recorded).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Database Integration Tests on hellosmart_test
  // ---------------------------------------------------------------------------
  describe.runIf(isDbAvailable)('Database Integration Tests (hellosmart_test)', () => {
    const adminUrl = 'postgres://hs_owner:hs_owner_local@localhost:5432/hellosmart_test';
    const appUrl = 'postgres://hs_app:hs_app_local@localhost:5432/hellosmart_test';
    const platformUrl = 'postgres://hs_platform:hs_platform_local@localhost:5432/hellosmart_test';

    let adminPool: Pool;
    let appPool: Pool;
    let platformPool: Pool;
    let adapter: PgWorkspaceTelemetryRegistryAdapter;
    let fakeTokenUsage: FakeTokenUsageAdapter;
    let fakeMetering: FakeWorkspaceMeteringAdapter;
    let dbService: WorkspaceTelemetryService;

    // Test UUIDs
    const orgAId = 'a0000000-0000-4000-8000-000000000001';
    const orgBId = 'b0000000-0000-4000-8000-000000000002';
    const adminAId = 'a1111111-1111-4111-8111-111111111111';
    const candAId = 'a2222222-2222-4222-8222-222222222222';
    const templateId = 'a3333333-3333-4333-8333-333333333333';
    const versionId = 'a4444444-4444-4444-8444-444444444444';
    const assessmentAId = 'a5555555-5555-4555-8555-555555555555';
    const assignmentAId = 'a6666666-6666-4666-8666-666666666666';
    const workspaceAId = 'a7777777-7777-4777-8777-777777777777';

    beforeAll(async () => {
      adminPool = new pg.Pool({ connectionString: adminUrl });
      appPool = new pg.Pool({ connectionString: appUrl });
      platformPool = new pg.Pool({ connectionString: platformUrl });

      adapter = new PgWorkspaceTelemetryRegistryAdapter(platformPool);
      fakeTokenUsage = new FakeTokenUsageAdapter();
      fakeMetering = new FakeWorkspaceMeteringAdapter();
      dbService = new WorkspaceTelemetryService(adapter, fakeTokenUsage, fakeMetering);

      // Clean setup in dependency order using hs_owner
      const adminClient = await adminPool.connect();
      try {
        await adminClient.query(`DELETE FROM app.workspace_usage WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.workspaces WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.assignments WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.assessments WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.template_assignments WHERE template_id = $1`, [
          templateId,
        ]);
        await adminClient.query(`DELETE FROM app.template_versions WHERE template_id = $1`, [
          templateId,
        ]);
        await adminClient.query(`DELETE FROM app.templates WHERE id = $1`, [templateId]);
        await adminClient.query(`DELETE FROM app.users WHERE org_id IN ($1, $2)`, [orgAId, orgBId]);
        await adminClient.query(`DELETE FROM app.organizations WHERE id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);

        // Insert Org A and Admin User
        await adminClient.query(
          `INSERT INTO app.organizations (id, name, slug, status, created_by)
           VALUES ($1, 'Telemetry Org A', 'telemetry-org-a', 'paid_active', $2)`,
          [orgAId, adminAId],
        );
        await adminClient.query(
          `INSERT INTO app.users (id, org_id, email, name, role, status)
           VALUES ($1, $2, 'admin.a@telemetry.test', 'Admin A', 'company_admin', 'active')`,
          [adminAId, orgAId],
        );

        // Insert Candidate A
        await adminClient.query(
          `INSERT INTO app.users (id, org_id, email, name, role, status)
           VALUES ($1, $2, 'cand.a@telemetry.test', 'Candidate A', 'candidate', 'active')`,
          [candAId, orgAId],
        );

        // Insert Template & DRAFT Version (ON CONFLICT DO NOTHING to handle immutable template triggers)
        await adminClient.query(
          `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description)
           VALUES ($1, 'telemetry-template', 'Telemetry Template', 'Engineering', 'Intermediate', 'cloud', 'Template for telemetry tests')
           ON CONFLICT (id) DO NOTHING`,
          [templateId],
        );
        await adminClient.query(
          `INSERT INTO app.template_versions (id, template_id, version, status, manifest)
           VALUES ($1, $2, '1.0.0', 'draft', '{}'::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [versionId, templateId],
        );
        await adminClient.query(
          `INSERT INTO app.template_assignments (template_id, org_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [templateId, orgAId],
        );

        // Insert Assessment
        await adminClient.query(
          `INSERT INTO app.assessments (id, org_id, template_version_id, name, workspace_mode, status)
           VALUES ($1, $2, $3, 'Telemetry Assessment', 'cloud', 'draft')`,
          [assessmentAId, orgAId, versionId],
        );

        // Insert Assignment
        await adminClient.query(
          `INSERT INTO app.assignments (id, org_id, assessment_id, candidate_id, status)
           VALUES ($1, $2, $3, $4, 'submitted')`,
          [assignmentAId, orgAId, assessmentAId, candAId],
        );

        // Insert Completed Workspace
        const start = new Date('2026-11-06T10:00:00.000Z');
        const end = new Date('2026-11-06T10:45:00.000Z'); // 45m = 2700s
        await adminClient.query(
          `INSERT INTO app.workspaces (id, org_id, assignment_id, candidate_id, mode, status, started_at, ended_at)
           VALUES ($1, $2, $3, $4, 'cloud', 'ended', $5, $6)`,
          [workspaceAId, orgAId, assignmentAId, candAId, start, end],
        );
      } finally {
        adminClient.release();
      }
    });

    afterAll(async () => {
      // Clean up all synthetic rows in reverse dependency order using hs_owner
      const adminClient = await adminPool.connect();
      try {
        await adminClient.query(`DELETE FROM app.workspace_usage WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.workspaces WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.assignments WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.assessments WHERE org_id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
        await adminClient.query(`DELETE FROM app.template_assignments WHERE template_id = $1`, [
          templateId,
        ]);
        await adminClient.query(`DELETE FROM app.template_versions WHERE template_id = $1`, [
          templateId,
        ]);
        await adminClient.query(`DELETE FROM app.templates WHERE id = $1`, [templateId]);
        await adminClient.query(`DELETE FROM app.users WHERE org_id IN ($1, $2)`, [orgAId, orgBId]);
        await adminClient.query(`DELETE FROM app.organizations WHERE id IN ($1, $2)`, [
          orgAId,
          orgBId,
        ]);
      } finally {
        adminClient.release();
        await adminPool.end();
        await appPool.end();
        await platformPool.end();
      }
    });

    it('persists a complete workspace usage record in PostgreSQL via withPlatform', async () => {
      fakeTokenUsage.setWorkspaceTokens(workspaceAId, [
        { model: 'gpt-4o', promptTokens: 200_000n, completionTokens: 100_000n },
      ]);
      fakeMetering.setStorageMb(workspaceAId, 500);

      const res = await dbService.recordSessionUsage(workspaceAId);
      expect(res.recorded).toBe(true);
      expect(res.inserted).toBe(true);

      const record = await adapter.getUsageByWorkspace(workspaceAId);
      expect(record).not.toBeNull();
      expect(record?.workspaceId).toBe(workspaceAId);
      expect(record?.orgId).toBe(orgAId);
      expect(record?.assessmentId).toBe(assessmentAId);
      expect(record?.candidateId).toBe(candAId);
      expect(record?.computeSeconds).toBe(2700n);
      expect(record?.computeMinutes).toBe(45);
      expect(record?.storageMb).toBe(500);
      expect(record?.promptTokens).toBe(200_000n);
      expect(record?.completionTokens).toBe(100_000n);
      // 200k @ $5 = $1.00. 100k @ $15 = $1.50. Total = $2.500000
      expect(record?.totalCostUsd).toBe('2.500000');
      expect(record?.pricingVersion).toBe('v1');
      expect(record?.status).toBe('complete');
    });

    it('enforces idempotency on duplicate recordSessionUsage calls', async () => {
      const res = await dbService.recordSessionUsage(workspaceAId);
      expect(res.recorded).toBe(true);
      expect(res.inserted).toBe(false);
      expect(res.reason).toBe('already_recorded');
    });

    it('enforces immutability: trigger blocks direct UPDATE on app.workspace_usage', async () => {
      const adminClient = await adminPool.connect();
      try {
        let updateErr = null;
        try {
          await adminClient.query(
            `UPDATE app.workspace_usage SET compute_minutes = 999 WHERE workspace_id = $1`,
            [workspaceAId],
          );
        } catch (e: any) {
          updateErr = e.message;
        }
        expect(updateErr).toContain('app.workspace_usage records are append-only and immutable');
      } finally {
        adminClient.release();
      }
    });

    it('enforces RLS: company_admin of Org A can read own usage records', async () => {
      const appClient = await appPool.connect();
      try {
        await withUserSession(appClient, orgAId, adminAId, 'company_admin', async (tx) => {
          const res = await tx.query(`SELECT * FROM app.workspace_usage WHERE workspace_id = $1`, [
            workspaceAId,
          ]);
          expect(res.rowCount).toBe(1);
        });
      } finally {
        appClient.release();
      }
    });

    it('enforces RLS: candidate session of Org A is BLOCKED from reading usage records', async () => {
      const appClient = await appPool.connect();
      try {
        await withUserSession(appClient, orgAId, candAId, 'candidate', async (tx) => {
          const res = await tx.query(`SELECT * FROM app.workspace_usage WHERE workspace_id = $1`, [
            workspaceAId,
          ]);
          expect(res.rowCount).toBe(0);
        });
      } finally {
        appClient.release();
      }
    });

    it('enforces RLS: cross-tenant isolation blocks Org B from reading Org A usage records', async () => {
      const appClient = await appPool.connect();
      try {
        const dummyAdminB = 'b1111111-1111-4111-8111-111111111111';
        await withUserSession(appClient, orgBId, dummyAdminB, 'company_admin', async (tx) => {
          const res = await tx.query(`SELECT * FROM app.workspace_usage WHERE workspace_id = $1`, [
            workspaceAId,
          ]);
          expect(res.rowCount).toBe(0);
        });
      } finally {
        appClient.release();
      }
    });

    it('enforces RLS: company role cannot directly INSERT into app.workspace_usage', async () => {
      const appClient = await appPool.connect();
      try {
        let insertErr = null;
        await withUserSession(appClient, orgAId, adminAId, 'company_admin', async (tx) => {
          try {
            await tx.query(
              `INSERT INTO app.workspace_usage (
                 workspace_id, org_id, assignment_id, assessment_id, candidate_id,
                 compute_seconds, compute_minutes, started_at, ended_at
               ) VALUES ($1, $2, $3, $4, $5, 100, 2, now(), now())`,
              [
                'c0000000-0000-4000-8000-000000000001',
                orgAId,
                assignmentAId,
                assessmentAId,
                candAId,
              ],
            );
          } catch (e: any) {
            insertErr = e.message;
          }
        });
        expect(insertErr).toContain('violates row-level security policy');
      } finally {
        appClient.release();
      }
    });

    it('enforces CHECK constraints: rejects negative values and reversed timestamps', async () => {
      const adminClient = await adminPool.connect();
      try {
        // Negative compute_seconds
        await expect(
          adminClient.query(
            `INSERT INTO app.workspace_usage (
               workspace_id, org_id, assignment_id, assessment_id, candidate_id,
               compute_seconds, compute_minutes, started_at, ended_at
             ) VALUES ($1, $2, $3, $4, $5, -50, 1, now(), now())`,
            ['c0000000-0000-4000-8000-000000000002', orgAId, assignmentAId, assessmentAId, candAId],
          ),
        ).rejects.toThrow('chk_workspace_usage_compute_sec_non_neg');

        // Reversed timestamps
        await expect(
          adminClient.query(
            `INSERT INTO app.workspace_usage (
               workspace_id, org_id, assignment_id, assessment_id, candidate_id,
               compute_seconds, compute_minutes, started_at, ended_at
             ) VALUES ($1, $2, $3, $4, $5, 60, 1, '2026-11-06T12:00:00Z', '2026-11-06T11:00:00Z')`,
            ['c0000000-0000-4000-8000-000000000003', orgAId, assignmentAId, assessmentAId, candAId],
          ),
        ).rejects.toThrow('chk_workspace_usage_timestamps');
      } finally {
        adminClient.release();
      }
    });

    it('queries telemetry aggregates by organization and by assessment', async () => {
      const orgUsage = await dbService.getUsageByOrganization(orgAId);
      expect(orgUsage.total).toBe(1);
      expect(orgUsage.items[0]?.assessmentId).toBe(assessmentAId);

      const asmUsage = await dbService.getUsageByAssessment(orgAId, assessmentAId);
      expect(asmUsage.total).toBe(1);
      expect(asmUsage.items[0]?.workspaceId).toBe(workspaceAId);

      const totals = await dbService.getSpendTotals({ orgId: orgAId });
      expect(totals.totalSessions).toBe(1);
      expect(totals.totalComputeMinutes).toBe(45);
      expect(totals.totalCostUsd).toBe('2.500000');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Skipped Contract Tests (Documenting Pending Phase 2/Stream Capabilities)
  // ---------------------------------------------------------------------------
  describe('Pending Contract Specifications (Phase 2 / External Integrations)', () => {
    it.skip('blocked on AI proxy migration creating app.ai_messages table', () => {
      // Contract test for PgTokenUsageAdapter reading real app.ai_messages with GROUP BY model.
      // Expected schema: workspace_id UUID, model TEXT, tokens_in INT, tokens_out INT.
    });

    it.skip('blocked on host cgroups/Sysbox container telemetry agent for real CPU/memory metering', () => {
      // Real CPU milliseconds and peak memory bytes telemetry from Docker/Sysbox runtime.
    });

    it.skip('blocked on Super Admin spend dashboard OpenAPI path definition in openapi.yaml', () => {
      // Platform spend tracking dashboard route (e.g. GET /admin/workspaces/spend).
    });

    it.skip('blocked on Razorpay/Stripe billing invoice generator integration', () => {
      // Automated generation of itemized GST invoices from app.workspace_usage totals.
    });

    it.skip('blocked on retroactive model pricing update adjustment migration', () => {
      // Price renegotiation adjustments must be inserted as new adjustment rows, preserving immutability.
    });

    it.skip('blocked on submitAssessment and reapWorkspace call-site wiring', () => {
      // Wire dbService.recordSessionUsage(workspaceId) into candidate-assessments.service.ts and workspace-reaper.service.ts.
    });
  });
});
