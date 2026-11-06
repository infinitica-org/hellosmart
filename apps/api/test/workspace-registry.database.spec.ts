import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgWorkspaceRegistryAdapter } from '../src/modules/workspaces/adapters/pg-workspace-registry.adapter.js';
import { withOrg } from '../src/modules/tenancy/with-org.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test';
const DATABASE_PLATFORM_URL =
  process.env.DATABASE_PLATFORM_URL ??
  'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test';
const DATABASE_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

let appPool: pg.Pool;
let platformPool: pg.Pool;
let adminPool: pg.Pool;
let adapter: PgWorkspaceRegistryAdapter;
let isDbAvailable = false;

interface DatabaseTestContext {
  orgAlphaId: string;
  orgBetaId: string;
  adminAlphaId: string;
  adminBetaId: string;
  candidateAlpha1Id: string;
  candidateAlpha2Id: string;
  candidateAlpha3Id: string;
  candidateBeta1Id: string;
  templateAlphaId: string;
  templateBetaId: string;
  versionAlphaId: string;
  versionBetaId: string;
  assessmentAlphaId: string;
  assessmentBetaId: string;
  assignmentAlpha1Id: string;
  assignmentAlpha2Id: string;
  assignmentAlpha3Id: string;
  assignmentBeta1Id: string;
  workspaceAlpha1Id: string;
  workspaceAlpha2Id: string;
  workspaceAlpha3Id: string;
  workspaceBeta1Id: string;
  initialAuditCount: number;
}

let ctx: DatabaseTestContext;

async function checkDbConnection(): Promise<boolean> {
  try {
    const probe = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 3000,
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

isDbAvailable = await checkDbConnection();

describe
  .runIf(isDbAvailable)
  .sequential(
    'Workspace Registry Database Adapter (app.workspaces & RLS on hellosmart_test)',
    () => {
      beforeAll(async () => {
        appPool = new pg.Pool({ connectionString: DATABASE_URL });
        platformPool = new pg.Pool({ connectionString: DATABASE_PLATFORM_URL });
        adminPool = new pg.Pool({ connectionString: DATABASE_ADMIN_URL });

        adapter = new PgWorkspaceRegistryAdapter(appPool, platformPool);

        const nonce = crypto.randomBytes(4).toString('hex');
        const orgAlphaSlug = `ws-reg-alpha-${nonce}`;
        const orgBetaSlug = `ws-reg-beta-${nonce}`;

        const adminClient = await adminPool.connect();
        try {
          // Record initial audit count to assert zero audit bloat
          const auditRes = await adminClient.query('SELECT COUNT(*)::int AS cnt FROM audit.events');
          const initialAuditCount = auditRes.rows[0].cnt;

          // 1. Create Organizations
          const alphaOrgRes = await adminClient.query(
            `INSERT INTO app.organizations (name, slug, status, created_by)
           VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
           RETURNING id`,
            [`Ws Reg Alpha ${nonce}`, orgAlphaSlug],
          );
          const orgAlphaId = alphaOrgRes.rows[0].id;

          const betaOrgRes = await adminClient.query(
            `INSERT INTO app.organizations (name, slug, status, created_by)
           VALUES ($1, $2, 'paid_active', '00000000-0000-4000-8000-000000000001')
           RETURNING id`,
            [`Ws Reg Beta ${nonce}`, orgBetaSlug],
          );
          const orgBetaId = betaOrgRes.rows[0].id;

          // 2. Entitlements
          await adminClient.query(
            `INSERT INTO app.entitlements (org_id, max_templates, max_candidates)
           VALUES ($1, 10, 50), ($2, 10, 50)`,
            [orgAlphaId, orgBetaId],
          );

          // 3. Users: Company Admins & Candidates
          const adminAlphaId = crypto.randomUUID();
          const adminBetaId = crypto.randomUUID();
          const candidateAlpha1Id = crypto.randomUUID();
          const candidateAlpha2Id = crypto.randomUUID();
          const candidateAlpha3Id = crypto.randomUUID();
          const candidateBeta1Id = crypto.randomUUID();

          await adminClient.query(
            `INSERT INTO app.users (id, org_id, email, name, role, status)
           VALUES
             ($1, $2, $3, 'Admin Alpha', 'company_admin', 'active'),
             ($4, $5, $6, 'Admin Beta', 'company_admin', 'active'),
             ($7, $2, $8, 'Candidate Alpha 1', 'candidate', 'active'),
             ($9, $2, $10, 'Candidate Alpha 2', 'candidate', 'active'),
             ($11, $2, $12, 'Candidate Alpha 3', 'candidate', 'active'),
             ($13, $5, $14, 'Candidate Beta 1', 'candidate', 'active')`,
            [
              adminAlphaId,
              orgAlphaId,
              `admin.alpha.${nonce}@test.com`,
              adminBetaId,
              orgBetaId,
              `admin.beta.${nonce}@test.com`,
              candidateAlpha1Id,
              `candidate.alpha1.${nonce}@test.com`,
              candidateAlpha2Id,
              `candidate.alpha2.${nonce}@test.com`,
              candidateAlpha3Id,
              `candidate.alpha3.${nonce}@test.com`,
              candidateBeta1Id,
              `candidate.beta1.${nonce}@test.com`,
            ],
          );

          // 4. Templates & DRAFT Versions (BR-03: draft versions only)
          const templateAlphaId = crypto.randomUUID();
          const templateBetaId = crypto.randomUUID();
          const versionAlphaId = crypto.randomUUID();
          const versionBetaId = crypto.randomUUID();

          await adminClient.query(
            `INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description)
           VALUES
             ($1, $2, 'Template Alpha', 'Engineering', 'Intermediate', 'cloud', 'Test Description'),
             ($3, $4, 'Template Beta', 'Engineering', 'Intermediate', 'chat', 'Test Description')`,
            [templateAlphaId, `tpl-alpha-${nonce}`, templateBetaId, `tpl-beta-${nonce}`],
          );

          await adminClient.query(
            `INSERT INTO app.template_versions (id, template_id, version, status, manifest)
           VALUES
             ($1, $2, '1.0.0', 'draft', '{}'::jsonb),
             ($3, $4, '1.0.0', 'draft', '{}'::jsonb)`,
            [versionAlphaId, templateAlphaId, versionBetaId, templateBetaId],
          );

          await adminClient.query(
            `INSERT INTO app.template_assignments (template_id, org_id)
           VALUES ($1, $2), ($3, $4)`,
            [templateAlphaId, orgAlphaId, templateBetaId, orgBetaId],
          );

          // 5. Assessments
          const assessmentAlphaId = crypto.randomUUID();
          const assessmentBetaId = crypto.randomUUID();

          await adminClient.query(
            `INSERT INTO app.assessments (id, org_id, template_version_id, name, workspace_mode, status)
           VALUES
             ($1, $2, $3, 'Assessment Alpha', 'cloud', 'draft'),
             ($4, $5, $6, 'Assessment Beta', 'chat', 'draft')`,
            [
              assessmentAlphaId,
              orgAlphaId,
              versionAlphaId,
              assessmentBetaId,
              orgBetaId,
              versionBetaId,
            ],
          );

          // 6. Assignments
          const assignmentAlpha1Id = crypto.randomUUID();
          const assignmentAlpha2Id = crypto.randomUUID();
          const assignmentAlpha3Id = crypto.randomUUID();
          const assignmentBeta1Id = crypto.randomUUID();

          await adminClient.query(
            `INSERT INTO app.assignments (id, org_id, assessment_id, candidate_id, status)
           VALUES
             ($1, $2, $3, $4, 'in_progress'),
             ($5, $2, $3, $6, 'in_progress'),
             ($7, $2, $3, $8, 'in_progress'),
             ($9, $10, $11, $12, 'in_progress')`,
            [
              assignmentAlpha1Id,
              orgAlphaId,
              assessmentAlphaId,
              candidateAlpha1Id,
              assignmentAlpha2Id,
              candidateAlpha2Id,
              assignmentAlpha3Id,
              candidateAlpha3Id,
              assignmentBeta1Id,
              orgBetaId,
              assessmentBetaId,
              candidateBeta1Id,
            ],
          );

          // 7. Workspaces (0014 statuses: connected, disconnected, ended)
          const workspaceAlpha1Id = crypto.randomUUID();
          const workspaceAlpha2Id = crypto.randomUUID();
          const workspaceAlpha3Id = crypto.randomUUID();
          const workspaceBeta1Id = crypto.randomUUID();

          await adminClient.query(
            `INSERT INTO app.workspaces (id, org_id, assignment_id, candidate_id, mode, status, last_activity_at, snapshot_ref)
           VALUES
             ($1, $2, $3, $4, 'cloud', 'connected', now() - interval '2 minutes', 'snapshots/orgA/snap_1.tar.gz'),
             ($5, $2, $6, $7, 'cloud', 'disconnected', now() - interval '1 minute', null),
             ($8, $2, $9, $10, 'cloud', 'ended', now() - interval '5 minutes', null),
             ($11, $12, $13, $14, 'chat', 'connected', now() - interval '30 seconds', 'snapshots/orgB/snap_1.tar.gz')`,
            [
              workspaceAlpha1Id,
              orgAlphaId,
              assignmentAlpha1Id,
              candidateAlpha1Id,
              workspaceAlpha2Id,
              assignmentAlpha2Id,
              candidateAlpha2Id,
              workspaceAlpha3Id,
              assignmentAlpha3Id,
              candidateAlpha3Id,
              workspaceBeta1Id,
              orgBetaId,
              assignmentBeta1Id,
              candidateBeta1Id,
            ],
          );

          ctx = {
            orgAlphaId,
            orgBetaId,
            adminAlphaId,
            adminBetaId,
            candidateAlpha1Id,
            candidateAlpha2Id,
            candidateAlpha3Id,
            candidateBeta1Id,
            templateAlphaId,
            templateBetaId,
            versionAlphaId,
            versionBetaId,
            assessmentAlphaId,
            assessmentBetaId,
            assignmentAlpha1Id,
            assignmentAlpha2Id,
            assignmentAlpha3Id,
            assignmentBeta1Id,
            workspaceAlpha1Id,
            workspaceAlpha2Id,
            workspaceAlpha3Id,
            workspaceBeta1Id,
            initialAuditCount,
          };
        } finally {
          adminClient.release();
        }
      });

      afterAll(async () => {
        if (adminPool && ctx) {
          const adminClient = await adminPool.connect();
          try {
            await adminClient.query('BEGIN');

            // Clean up in strict reverse dependency order
            await adminClient.query('DELETE FROM app.workspaces WHERE id IN ($1, $2, $3, $4)', [
              ctx.workspaceAlpha1Id,
              ctx.workspaceAlpha2Id,
              ctx.workspaceAlpha3Id,
              ctx.workspaceBeta1Id,
            ]);

            await adminClient.query('DELETE FROM app.assignments WHERE id IN ($1, $2, $3, $4)', [
              ctx.assignmentAlpha1Id,
              ctx.assignmentAlpha2Id,
              ctx.assignmentAlpha3Id,
              ctx.assignmentBeta1Id,
            ]);

            await adminClient.query('DELETE FROM app.assessments WHERE id IN ($1, $2)', [
              ctx.assessmentAlphaId,
              ctx.assessmentBetaId,
            ]);

            await adminClient.query(
              'DELETE FROM app.template_assignments WHERE org_id IN ($1, $2)',
              [ctx.orgAlphaId, ctx.orgBetaId],
            );

            // DRAFT versions can be deleted directly without session_replication_role
            await adminClient.query('DELETE FROM app.template_versions WHERE id IN ($1, $2)', [
              ctx.versionAlphaId,
              ctx.versionBetaId,
            ]);

            await adminClient.query('DELETE FROM app.templates WHERE id IN ($1, $2)', [
              ctx.templateAlphaId,
              ctx.templateBetaId,
            ]);

            await adminClient.query('DELETE FROM app.users WHERE id IN ($1, $2, $3, $4, $5, $6)', [
              ctx.adminAlphaId,
              ctx.adminBetaId,
              ctx.candidateAlpha1Id,
              ctx.candidateAlpha2Id,
              ctx.candidateAlpha3Id,
              ctx.candidateBeta1Id,
            ]);

            await adminClient.query('DELETE FROM app.entitlements WHERE org_id IN ($1, $2)', [
              ctx.orgAlphaId,
              ctx.orgBetaId,
            ]);

            await adminClient.query('DELETE FROM app.organizations WHERE id IN ($1, $2)', [
              ctx.orgAlphaId,
              ctx.orgBetaId,
            ]);

            await adminClient.query('COMMIT');

            // Assert zero residual rows for all created records
            const countWs = await adminClient.query(
              'SELECT COUNT(*)::int AS cnt FROM app.workspaces WHERE id IN ($1, $2, $3, $4)',
              [
                ctx.workspaceAlpha1Id,
                ctx.workspaceAlpha2Id,
                ctx.workspaceAlpha3Id,
                ctx.workspaceBeta1Id,
              ],
            );
            expect(countWs.rows[0].cnt).toBe(0);

            const countAsg = await adminClient.query(
              'SELECT COUNT(*)::int AS cnt FROM app.assignments WHERE id IN ($1, $2, $3, $4)',
              [
                ctx.assignmentAlpha1Id,
                ctx.assignmentAlpha2Id,
                ctx.assignmentAlpha3Id,
                ctx.assignmentBeta1Id,
              ],
            );
            expect(countAsg.rows[0].cnt).toBe(0);

            const countAssess = await adminClient.query(
              'SELECT COUNT(*)::int AS cnt FROM app.assessments WHERE id IN ($1, $2)',
              [ctx.assessmentAlphaId, ctx.assessmentBetaId],
            );
            expect(countAssess.rows[0].cnt).toBe(0);

            const countOrgs = await adminClient.query(
              'SELECT COUNT(*)::int AS cnt FROM app.organizations WHERE id IN ($1, $2)',
              [ctx.orgAlphaId, ctx.orgBetaId],
            );
            expect(countOrgs.rows[0].cnt).toBe(0);

            // Assert that audit.events count was NOT changed
            const finalAudit = await adminClient.query(
              'SELECT COUNT(*)::int AS cnt FROM audit.events',
            );
            expect(finalAudit.rows[0].cnt).toBe(ctx.initialAuditCount);
          } catch (err) {
            await adminClient.query('ROLLBACK').catch(() => {});
            throw err;
          } finally {
            adminClient.release();
          }
        }

        await appPool?.end();
        await platformPool?.end();
        await adminPool?.end();
      });

      it('findDueWorkspaces lists active workspaces across tenants using hs_platform, excluding ended ones', async () => {
        const dueWorkspaces = await adapter.findDueWorkspaces(new Date(), 50);

        const createdIds = [
          ctx.workspaceAlpha1Id,
          ctx.workspaceAlpha2Id,
          ctx.workspaceAlpha3Id,
          ctx.workspaceBeta1Id,
        ];
        const matching = dueWorkspaces.filter((w) => createdIds.includes(w.id));

        // Must include workspaceAlpha1 (connected), workspaceAlpha2 (disconnected), workspaceBeta1 (connected)
        // Must NOT include workspaceAlpha3 (ended)
        expect(matching.length).toBe(3);

        const foundAlpha1 = matching.find((w) => w.id === ctx.workspaceAlpha1Id);
        expect(foundAlpha1).toBeDefined();
        expect(foundAlpha1?.status).toBe('connected');
        expect(foundAlpha1?.orgId).toBe(ctx.orgAlphaId);
        expect(foundAlpha1?.assignmentId).toBe(ctx.assignmentAlpha1Id);
        expect(foundAlpha1?.mode).toBe('cloud');
        expect(foundAlpha1?.lastSnapshotKey).toBe('snapshots/orgA/snap_1.tar.gz');

        const foundAlpha2 = matching.find((w) => w.id === ctx.workspaceAlpha2Id);
        expect(foundAlpha2).toBeDefined();
        expect(foundAlpha2?.status).toBe('disconnected');
        expect(foundAlpha2?.lastSnapshotKey).toBeNull();

        const foundBeta1 = matching.find((w) => w.id === ctx.workspaceBeta1Id);
        expect(foundBeta1).toBeDefined();
        expect(foundBeta1?.status).toBe('connected');
        expect(foundBeta1?.orgId).toBe(ctx.orgBetaId);
        expect(foundBeta1?.mode).toBe('chat');

        const foundAlpha3 = matching.find((w) => w.id === ctx.workspaceAlpha3Id);
        expect(foundAlpha3).toBeUndefined();
      });

      it('getWorkspaceById retrieves workspace within tenant boundary (hs_app with withOrg)', async () => {
        const ws = await adapter.getWorkspaceById(ctx.workspaceAlpha1Id, ctx.orgAlphaId);
        expect(ws).not.toBeNull();
        expect(ws?.id).toBe(ctx.workspaceAlpha1Id);
        expect(ws?.orgId).toBe(ctx.orgAlphaId);
        expect(ws?.mode).toBe('cloud');
        expect(ws?.status).toBe('connected');
      });

      it('RLS makes each organization workspaces strictly invisible to others (BR-01)', async () => {
        // 1. Adapter getWorkspaceById returns null when querying with different orgId
        const crossTenantResult = await adapter.getWorkspaceById(
          ctx.workspaceAlpha1Id,
          ctx.orgBetaId,
        );
        expect(crossTenantResult).toBeNull();

        // 2. Direct query on appPool under withOrg(orgBetaId) returns 0 rows for Alpha workspace
        const client = await appPool.connect();
        try {
          await withOrg(client, ctx.orgBetaId, async (tx) => {
            await tx.query("SELECT set_config('app.user_role', 'company_admin', true)");
            const res = await tx.query('SELECT * FROM app.workspaces WHERE id = $1', [
              ctx.workspaceAlpha1Id,
            ]);
            expect(res.rows).toHaveLength(0);
          });
        } finally {
          client.release();
        }
      });

      it('recordSnapshot throws explicit error stating it is blocked on migration', async () => {
        await expect(
          adapter.recordSnapshot(ctx.workspaceAlpha1Id, ctx.orgAlphaId, {
            snapshotKey: 'snapshots/test/snap.tar.gz',
            sha256: 'abc123',
            timestamp: new Date(),
            seq: 1,
            manifest: {} as any,
          }),
        ).rejects.toThrow(/blocked on the migration adding last_snapshot_at/);
      });

      it.skip('blocked on the migration that adds last_snapshot_at', async () => {
        // Contract placeholder: when migration adds last_snapshot_at, last_snapshot_key,
        // last_snapshot_sha256, and snapshot_seq to app.workspaces, recordSnapshot will execute
        // UPDATE app.workspaces SET last_snapshot_at = $1 ...
      });
    },
  );
