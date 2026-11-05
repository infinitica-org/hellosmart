import crypto from 'node:crypto';
import { vi } from 'vitest';

export interface InMemoryUser {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string | null;
  must_reset_password: boolean;
  status: string;
  counted_against_cap_at: Date | null;
  deleted_at?: Date | null;
  created_at: Date;
}

export interface InMemoryEntitlement {
  org_id: string;
  max_candidates: number;
  pending_invite_multiplier: number;
  max_templates?: number;
}

export interface InMemoryAssessment {
  id: string;
  org_id: string;
  name: string;
  status: string;
}

export interface InMemoryAssignment {
  id: string;
  org_id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
  invite_token_hash: Buffer;
  invite_issued_at: Date;
  invite_expires_at: Date;
  invited_at: Date;
  created_at: Date;
  first_connect_at?: Date | null;
  invite_used_at?: Date | null;
}

export interface InMemoryInvitation {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  role: string;
  token_hash: Buffer;
  expires_at: Date;
}

export interface MockDbPoolOptions {
  defaultEntitlements?: boolean;
  defaultMaxCandidates?: number;
}

export function createMockDbPool(options: MockDbPoolOptions = {}) {
  const users = new Map<string, InMemoryUser>();
  const assessments = new Map<string, InMemoryAssessment>();
  const assignments = new Map<string, InMemoryAssignment>();
  const invitations = new Map<string, InMemoryInvitation>();
  const entitlements = new Map<string, InMemoryEntitlement>();
  const auditEvents: unknown[] = [];
  let simulateConcurrencyConflict = false;
  let simulateUnrelatedUniqueViolation = false;

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = typeof sql === 'string' ? sql.trim() : '';

      if (q.startsWith('BEGIN') || q.startsWith('COMMIT') || q.startsWith('ROLLBACK')) {
        return { rows: [], rowCount: 0 };
      }

      if (q.includes("set_config('app.org_id'")) {
        return { rows: [], rowCount: 0 };
      }

      // 0. Entitlements lookup
      if (q.includes('app.entitlements') && q.includes('org_id = $1')) {
        const orgId = params?.[0] as string;
        let ent = entitlements.get(orgId);
        if (!ent && options.defaultEntitlements !== false) {
          ent = {
            org_id: orgId,
            max_candidates: options.defaultMaxCandidates ?? 10,
            pending_invite_multiplier: 2.0,
            max_templates: 5,
          };
        }
        if (ent) {
          return {
            rows: [{
              max_candidates: ent.max_candidates,
              pending_invite_multiplier: ent.pending_invite_multiplier,
              max_templates: ent.max_templates ?? 5,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 0b. Launched candidate count (counted_against_cap_at IS NOT NULL)
      if (q.includes('app.users') && q.includes('counted_against_cap_at IS NOT NULL')) {
        const orgId = params?.[0] as string;
        const count = Array.from(users.values()).filter(
          (u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted' && !u.deleted_at && u.counted_against_cap_at !== null,
        ).length;
        return { rows: [{ count: count.toString() }], rowCount: 1 };
      }

      // 0c. Pending assignments count
      if (q.includes('app.assignments') && q.includes('counted_against_cap_at IS NULL')) {
        const orgId = params?.[0] as string;
        const now = new Date();
        const count = Array.from(assignments.values()).filter((a) => {
          if (a.org_id !== orgId) return false;
          if (!['invited', 'window_not_open', 'ready'].includes(a.status)) return false;
          if (a.first_connect_at) return false;
          if (a.invite_expires_at && a.invite_expires_at <= now) return false;
          const u = users.get(a.candidate_id);
          if (!u || u.status === 'deleted' || u.deleted_at) return false;
          if (u.counted_against_cap_at !== null) return false;
          return true;
        }).length;
        return { rows: [{ count: count.toString() }], rowCount: 1 };
      }

      // 0d. Count active assessments
      if (q.includes('FROM app.assessments') && q.includes("status != 'archived'")) {
        const orgId = params?.[0] as string;
        const count = Array.from(assessments.values()).filter(
          (a) => a.org_id === orgId && a.status !== 'archived',
        ).length;
        return { rows: [{ count }], rowCount: 1 };
      }

      // 1. Assessment lookup
      if (q.includes('FROM app.assessments WHERE id = $1 AND org_id = $2')) {
        const assessmentId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = assessments.get(assessmentId);
        if (match && match.org_id === orgId) {
          return { rows: [{ id: match.id, name: match.name, org_id: match.org_id, status: match.status }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 2. User lookup by email or id
      if (q.includes('FROM app.users') && q.includes('org_id = $1 AND email = $2')) {
        const orgId = params?.[0] as string;
        const email = params?.[1] as string;
        const match = Array.from(users.values()).find(
          (u) => u.org_id === orgId && u.email === email && u.status !== 'deleted',
        );
        return {
          rows: match ? [{ id: match.id, name: match.name, email: match.email, status: match.status, counted_against_cap_at: match.counted_against_cap_at, created_at: match.created_at }] : [],
          rowCount: match ? 1 : 0,
        };
      }

      if (q.includes('FROM app.users') && q.includes('id = $1 AND org_id = $2')) {
        const userId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = users.get(userId);
        if (match && match.org_id === orgId) {
          return {
            rows: [{
              id: match.id,
              name: match.name,
              email: match.email,
              role: match.role,
              status: match.status,
              must_reset_password: match.must_reset_password ?? true,
              deleted_at: match.deleted_at ?? null,
              counted_against_cap_at: match.counted_against_cap_at,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 3. User update (e.g. recordCandidateFirstLaunch)
      if (q.includes('UPDATE app.users') && q.includes('counted_against_cap_at = now()')) {
        const userId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = users.get(userId);
        if (match && match.org_id === orgId) {
          const now = new Date();
          match.counted_against_cap_at = now;
          return { rows: [{ counted_against_cap_at: now }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 4. Assignment duplicate lookup (application-level check)
      if (q.includes('FROM app.assignments WHERE org_id = $1 AND assessment_id = $2 AND candidate_id = $3')) {
        if (simulateConcurrencyConflict) {
          return { rows: [], rowCount: 0 };
        }
        const orgId = params?.[0] as string;
        const assessmentId = params?.[1] as string;
        const candidateId = params?.[2] as string;
        const match = Array.from(assignments.values()).find(
          (a) => a.org_id === orgId && a.assessment_id === assessmentId && a.candidate_id === candidateId,
        );
        return { rows: match ? [{ id: match.id }] : [], rowCount: match ? 1 : 0 };
      }

      // 5. Organization lookup
      if (q.includes('SELECT name FROM app.organizations WHERE id = $1')) {
        return { rows: [{ name: 'Acme Simulation Academy' }], rowCount: 1 };
      }

      if (q.includes('find_user_by_id')) {
        return {
          rows: [{ user_status: 'active', org_status: 'trial_active' }],
          rowCount: 1,
        };
      }

      if (q.includes('count(*)::int AS total')) {
        const orgId = params?.[0] as string;
        const matching = Array.from(users.values()).filter(
          (u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted',
        );
        const active = matching.filter((u) => u.status === 'active');
        return {
          rows: [{ total: matching.length, active: active.length }],
          rowCount: 1,
        };
      }

      if (q.includes('count(*)::text as count')) {
        const orgId = params?.[0] as string;
        const matching = Array.from(users.values()).filter(
          (u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted',
        );
        return {
          rows: [{ count: matching.length.toString() }],
          rowCount: 1,
        };
      }

      if (q.includes('total_count') && q.includes('invited_count') && q.includes('active_count')) {
        const orgId = params?.[0] as string;
        const matching = Array.from(users.values()).filter(
          (u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted',
        );
        const invited = matching.filter((u) => u.status === 'invited' || u.status === 'suspended');
        const active = matching.filter((u) => u.status === 'active');
        return {
          rows: [{
            total_count: matching.length.toString(),
            invited_count: invited.length.toString(),
            active_count: active.length.toString(),
          }],
          rowCount: 1,
        };
      }

      if (q.includes('FROM app.users') && q.includes("role = 'candidate'") && q.includes("status != 'deleted'")) {
        const orgId = params?.[0] as string;
        const matches = Array.from(users.values())
          .filter((u) => u.org_id === orgId && u.role === 'candidate' && u.status !== 'deleted')
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            status: u.status,
            counted_against_cap_at: u.counted_against_cap_at ?? null,
            created_at: u.created_at,
          }));
        return { rows: matches, rowCount: matches.length };
      }

      if (q.includes('FROM audit.events') && q.includes("action = 'assignment.submitted'")) {
        const orgId = params?.[0] as string;
        const matching = auditEvents.filter(
          (e) => (Array.isArray(e) ? e[2] === orgId && e[3] === 'assignment.submitted' : false),
        );
        return {
          rows: [{ count: matching.length }],
          rowCount: 1,
        };
      }

      if (q.includes('FROM app.entitlements WHERE org_id = $1')) {
        return {
          rows: [{ max_candidates: 25, max_templates: 5 }],
          rowCount: 1,
        };
      }

      // 6. Insert candidate user
      if (q.includes('INSERT INTO app.users')) {
        const id = params?.[0] as string;
        const org_id = params?.[1] as string;
        const email = params?.[2] as string;
        const name = params?.[3] as string;

        if (email === 'db.fail@example.com') {
          throw new Error('deadlock detected on candidate insertion');
        }

        const created_at = new Date();
        const user: InMemoryUser = {
          id,
          org_id,
          email,
          name,
          role: 'candidate',
          password_hash: null,
          must_reset_password: true,
          status: 'invited',
          counted_against_cap_at: null,
          created_at,
        };
        users.set(id, user);
        return {
          rows: [{ id, name, email, status: 'invited', created_at }],
          rowCount: 1,
        };
      }

      // 7. Insert assignment (with unique constraint enforcement)
      if (q.includes('INSERT INTO app.assignments')) {
        if (simulateUnrelatedUniqueViolation) {
          const err: any = new Error('duplicate key value violates unique constraint "some_unrelated_unique_constraint"');
          err.code = '23505';
          err.constraint = 'some_unrelated_unique_constraint';
          throw err;
        }

        const org_id = params?.[0] as string;
        const assessment_id = params?.[1] as string;
        const candidate_id = params?.[2] as string;
        const invite_token_hash = params?.[3] as Buffer;
        const invite_issued_at = params?.[4] as Date;
        const invite_expires_at = params?.[5] as Date;

        const candidateUser = users.get(candidate_id);
        if (candidateUser && candidateUser.email === 'assignment.fail@example.com') {
          throw new Error('unique constraint violation on assignment');
        }

        // Database unique constraint check: assignments_org_assessment_candidate_uq
        const duplicate = Array.from(assignments.values()).some(
          (a) => a.org_id === org_id && a.assessment_id === assessment_id && a.candidate_id === candidate_id,
        );
        if (duplicate) {
          const err: any = new Error('duplicate key value violates unique constraint "assignments_org_assessment_candidate_uq"');
          err.code = '23505';
          err.constraint = 'assignments_org_assessment_candidate_uq';
          throw err;
        }

        const id = crypto.randomUUID();
        const now = new Date();
        assignments.set(id, {
          id,
          org_id,
          assessment_id,
          candidate_id,
          status: 'invited',
          invite_token_hash,
          invite_issued_at,
          invite_expires_at,
          invited_at: now,
          created_at: now,
        });
        return {
          rows: [{ id, status: 'invited', invited_at: now, created_at: now }],
          rowCount: 1,
        };
      }

      // 8. Insert legacy account invitation
      if (q.includes('INSERT INTO app.invitations')) {
        const org_id = params?.[0] as string;
        const user_id = params?.[1] as string;
        const email = params?.[2] as string;
        const token_hash = params?.[3] as Buffer;
        const expires_at = params?.[4] as Date;
        const id = crypto.randomUUID();
        invitations.set(id, { id, org_id, user_id, email, role: 'candidate', token_hash, expires_at });
        return { rows: [{ id }], rowCount: 1 };
      }

      // 8b. Delete legacy account invitation
      if (q.includes('DELETE FROM app.invitations WHERE user_id = $1 AND org_id = $2')) {
        const userId = params?.[0] as string;
        const orgId = params?.[1] as string;
        for (const [id, inv] of invitations.entries()) {
          if (inv.user_id === userId && inv.org_id === orgId) {
            invitations.delete(id);
          }
        }
        return { rows: [], rowCount: 1 };
      }

      // 8c. Lookup candidate user by id and org
      if (q.includes('FROM app.users') && q.includes("role = 'candidate'") && q.includes('id = $1 AND org_id = $2')) {
        const id = params?.[0] as string;
        const orgId = params?.[1] as string;
        const match = users.get(id);
        if (match && match.org_id === orgId && match.role === 'candidate' && match.status !== 'deleted') {
          return {
            rows: [{ id: match.id, email: match.email, name: match.name, status: match.status, must_reset_password: match.must_reset_password }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 8d. Query candidate assessment assignments
      if (q.includes('FROM app.assignments a') && q.includes('WHERE a.id = $1 AND a.org_id = $2')) {
        const assignmentId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const a = assignments.get(assignmentId);
        if (a && a.org_id === orgId) {
          const asm = assessments.get(a.assessment_id);
          return {
            rows: [
              {
                id: a.id,
                assessment_id: a.assessment_id,
                candidate_id: a.candidate_id,
                status: a.status,
                first_connect_at: a.first_connect_at ?? null,
                assessment_name: asm?.name ?? 'Test Assessment',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (q.includes('FROM app.assignments a') && q.includes('WHERE a.candidate_id = $1 AND a.org_id = $2')) {
        const candidateId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const matched = Array.from(assignments.values())
          .filter((a) => a.candidate_id === candidateId && a.org_id === orgId)
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        const isPortalQuery = q.includes('assessmentId') || q.includes('companyName');
        const rows = matched.map((a) => {
          const asm = assessments.get(a.assessment_id);
          if (isPortalQuery) {
            return {
              id: a.id,
              assessmentId: a.assessment_id,
              title: asm?.name ?? 'Test Assessment',
              companyName: 'Acme Corp',
              workspaceMode: 'cloud',
              status: a.status,
              durationMinutes: 90,
              deadline: null,
              submittedAt: null,
              releaseResults: false,
            };
          }
          return {
            id: a.id,
            assessment_id: a.assessment_id,
            status: a.status,
            first_connect_at: a.first_connect_at ?? null,
            assessment_name: asm?.name ?? 'Test Assessment',
          };
        });
        return { rows, rowCount: rows.length };
      }

      // 8d2. Query single candidate assessment assignment for detail taking view
      if (q.includes('FROM app.assignments a') && q.includes('WHERE a.id = $1 AND a.candidate_id = $2 AND a.org_id = $3')) {
        const assignmentId = params?.[0] as string;
        const candidateId = params?.[1] as string;
        const orgId = params?.[2] as string;
        const a = assignments.get(assignmentId);
        if (a && a.candidate_id === candidateId && a.org_id === orgId) {
          const asm = assessments.get(a.assessment_id);
          return {
            rows: [
              {
                id: a.id,
                assessmentId: a.assessment_id,
                title: asm?.name ?? 'Test Assessment',
                companyName: 'Acme Corp',
                workspaceMode: 'cloud',
                status: a.status,
                timing: { durationMinutes: 90, type: 'duration' },
                aiPolicy: { enabled: true, allowedModels: ['gpt-4o'] },
                briefOverrides: {
                  scenario: 'Build a distributed resilient order processor.',
                  instructions: 'Complete task within 90 minutes with zero downtime rollback.',
                  deliverables: ['src/main.ts', 'src/worker.ts'],
                },
                deadline: null,
                firstConnectAt: a.first_connect_at ?? null,
                submittedAt: null,
                autoSubmitted: false,
                releaseResults: false,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // 8d3. Update consent and first connect
      if (q.includes('UPDATE app.assignments') && q.includes("first_connect_at = COALESCE(first_connect_at, now())")) {
        const assignmentId = params?.[0] as string;
        const a = assignments.get(assignmentId);
        if (a) {
          a.status = 'in_progress';
          a.first_connect_at = new Date();
          return { rows: [{ id: a.id, status: a.status, first_connect_at: a.first_connect_at }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 8d4. Update assessment submission
      if (q.includes('UPDATE app.assignments') && q.includes("status = 'submitted'")) {
        const assignmentId = params?.[0] as string;
        const a = assignments.get(assignmentId);
        if (a) {
          a.status = 'submitted';
          return { rows: [{ id: a.id, status: 'submitted', submitted_at: new Date() }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 8e. Atomically update assignment invite token & expiry
      if (q.includes('UPDATE app.assignments') && q.includes('SET invite_token_hash = $1')) {
        const invite_token_hash = params?.[0] as Buffer;
        const invite_issued_at = params?.[1] as Date;
        const invite_expires_at = params?.[2] as Date;
        const id = params?.[3] as string;
        const orgId = params?.[4] as string;
        const a = assignments.get(id);
        if (a && a.org_id === orgId) {
          a.invite_token_hash = invite_token_hash;
          a.invite_issued_at = invite_issued_at;
          a.invite_expires_at = invite_expires_at;
          a.invite_used_at = null;
          if (a.status === 'expired') {
            a.status = 'invited';
          }
          return { rows: [{ id: a.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // 9. Audit logging
      if (q.includes('INSERT INTO audit.events')) {
        auditEvents.push(params);
        return { rows: [{ id: 1 }], rowCount: 1 };
      }

      if (q.includes('audit.latest_event_hash')) {
        return { rows: [{ hash: Buffer.alloc(32, 1) }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };

  return {
    connect: vi.fn(async () => client),
    query: client.query,
    end: vi.fn(),
    client,
    users,
    assessments,
    assignments,
    invitations,
    entitlements,
    auditEvents,
    setSimulateConcurrencyConflict: (val: boolean) => {
      simulateConcurrencyConflict = val;
    },
    setSimulateUnrelatedUniqueViolation: (val: boolean) => {
      simulateUnrelatedUniqueViolation = val;
    },
  };
}
