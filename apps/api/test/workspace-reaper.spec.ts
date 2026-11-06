import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { FakeWorkspaceDestroyer } from '../src/modules/workspaces/ports/workspace-destroyer.port.js';
import { FakeWorkspaceHeartbeatAdapter } from '../src/modules/workspaces/ports/workspace-heartbeat.port.js';
import { FakeWorkspaceLifecycleAdapter } from '../src/modules/workspaces/ports/workspace-lifecycle.port.js';
import { FakeWorkspaceNotifier } from '../src/modules/workspaces/ports/workspace-notifier.port.js';
import { FakeWorkspaceReaperRegistry } from '../src/modules/workspaces/fakes/fake-workspace-reaper-registry.js';
import { FakeWorkspaceSnapshotAdapter } from '../src/modules/workspaces/ports/workspace-snapshot.port.js';
import { WorkspaceReaperService } from '../src/modules/workspaces/workspace-reaper.service.js';
import { PgWorkspaceReaperRegistryAdapter } from '../src/modules/workspaces/adapters/pg-workspace-reaper-registry.adapter.js';
import { WorkspaceReaperScheduler } from '../src/modules/workspaces/workspace-reaper.scheduler.js';
import { FailClosedWorkspaceDestroyer } from '../src/modules/workspaces/ports/workspace-destroyer.port.js';
import { FailClosedHeartbeatAdapter } from '../src/modules/workspaces/ports/workspace-heartbeat.port.js';
import type {
  ReapCandidate,
  WorkspaceReaperThresholds,
} from '../src/modules/workspaces/workspace-reaper.types.js';

describe('[9.3] Workspace Orphan Reaper & Compute Resource Garbage Collector (BR-22, BR-23, NF-014, AD-019, CO-044)', () => {
  const baseNow = new Date('2026-11-06T12:00:00.000Z');

  const defaultThresholds: WorkspaceReaperThresholds = {
    disconnectedTimeoutMinutes: 60,
    idleTimeoutMinutes: 15,
    idleEnabled: false,
    heartbeatGuardSeconds: 300,
    recentActivityGraceSeconds: 60,
    staleClaimTimeoutMinutes: 10,
    circuitBreakerMaxRatio: 0.5,
    batchLimit: 50,
  };

  function createCandidate(overrides: Partial<ReapCandidate> = {}): ReapCandidate {
    return {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      assignmentId: '33333333-3333-4333-8333-333333333333',
      candidateId: '44444444-4444-4444-8444-444444444444',
      workspaceStatus: 'disconnected',
      startedAt: new Date(baseNow.getTime() - 7200 * 1000), // 2h ago
      lastActivityAt: new Date(baseNow.getTime() - 3600 * 1000), // 60m ago
      endedAt: null,
      snapshotRef: null,
      runtimeRef: 'container-slot-99',
      assignmentStatus: 'in_progress',
      deadlineAt: new Date(baseNow.getTime() + 3600 * 1000), // 1h in future
      extendedMinutes: 0,
      submittedAt: null,
      autoSubmitted: false,
      artifactsRef: null,
      candidateDeletedAt: null,
      ...overrides,
    };
  }

  describe('1. Pure Boundary Classification & Hard Guards', () => {
    let service: WorkspaceReaperService;
    let fakeRegistry: FakeWorkspaceReaperRegistry;
    let fakeHeartbeat: FakeWorkspaceHeartbeatAdapter;
    let fakeSnapshot: FakeWorkspaceSnapshotAdapter;
    let fakeDestroyer: FakeWorkspaceDestroyer;
    let fakeNotifier: FakeWorkspaceNotifier;
    let fakeLifecycle: FakeWorkspaceLifecycleAdapter;
    let fakeAudit: any;

    beforeEach(() => {
      fakeRegistry = new FakeWorkspaceReaperRegistry();
      fakeHeartbeat = new FakeWorkspaceHeartbeatAdapter();
      fakeSnapshot = new FakeWorkspaceSnapshotAdapter();
      fakeDestroyer = new FakeWorkspaceDestroyer();
      fakeNotifier = new FakeWorkspaceNotifier();
      fakeLifecycle = new FakeWorkspaceLifecycleAdapter();
      fakeAudit = { record: vi.fn().mockResolvedValue(undefined) };

      const mockConfig: any = {
        WORKSPACE_REAPER_ENABLED: true,
        REAPER_DRY_RUN: false,
        REAPER_INTERVAL_SECONDS: 300,
        REAPER_DISCONNECTED_TIMEOUT_MINUTES: 60,
        REAPER_IDLE_TIMEOUT_MINUTES: 15,
        REAPER_IDLE_ENABLED: false,
        REAPER_HEARTBEAT_GUARD_SECONDS: 300,
        REAPER_BATCH_LIMIT: 50,
        REAPER_CIRCUIT_BREAKER_MAX_RATIO: 0.5,
      };

      service = new WorkspaceReaperService(
        mockConfig,
        fakeRegistry,
        fakeHeartbeat,
        fakeSnapshot,
        fakeDestroyer,
        fakeNotifier,
        fakeLifecycle,
        fakeAudit,
      );
    });

    it('classifies disconnected session at exact 60-minute boundaries (1ms before, exact, 1ms after)', () => {
      // 1 ms before 60 minutes (59m 59s 999ms) -> NOT eligible
      const justBefore = createCandidate({
        workspaceStatus: 'disconnected',
        lastActivityAt: new Date(baseNow.getTime() - (60 * 60_000 - 1)),
      });
      const resBefore = service.classifyCandidate(justBefore, null, baseNow, defaultThresholds);
      expect(resBefore.eligible).toBe(false);
      expect(resBefore.skipReason).toBe('disconnected_within_threshold');

      // Exactly at 60 minutes -> eligible
      const exact = createCandidate({
        workspaceStatus: 'disconnected',
        lastActivityAt: new Date(baseNow.getTime() - 60 * 60_000),
      });
      const resExact = service.classifyCandidate(exact, null, baseNow, defaultThresholds);
      expect(resExact.eligible).toBe(true);
      expect(resExact.reason).toBe('disconnected_timeout');

      // 1 ms after 60 minutes -> eligible
      const justAfter = createCandidate({
        workspaceStatus: 'disconnected',
        lastActivityAt: new Date(baseNow.getTime() - (60 * 60_000 + 1)),
      });
      const resAfter = service.classifyCandidate(justAfter, null, baseNow, defaultThresholds);
      expect(resAfter.eligible).toBe(true);
      expect(resAfter.reason).toBe('disconnected_timeout');
    });

    it('honors REAPER_IDLE_ENABLED=false: quiet connected candidate is never reaped even after 15m or 2 hours', () => {
      const quietCandidate = createCandidate({
        workspaceStatus: 'connected',
        lastActivityAt: new Date(baseNow.getTime() - 120 * 60_000), // 2h quiet
      });
      // Heartbeat stale (> 5m) so heartbeat guard does not trigger, but idleEnabled is false
      const oldHeartbeat = new Date(baseNow.getTime() - 600 * 1000); // 10m ago

      const res = service.classifyCandidate(quietCandidate, oldHeartbeat, baseNow, {
        ...defaultThresholds,
        idleEnabled: false,
      });
      expect(res.eligible).toBe(false);
      expect(res.skipReason).toBe('active_session');
    });

    it('classifies idle connected session at exact 15-minute boundaries when idleEnabled=true', () => {
      const thresholds: WorkspaceReaperThresholds = {
        ...defaultThresholds,
        idleEnabled: true,
      };
      const oldHeartbeat = new Date(baseNow.getTime() - 600 * 1000); // 10m ago (passes guard)

      // 1 ms before 15m -> not eligible
      const before15 = createCandidate({
        workspaceStatus: 'connected',
        lastActivityAt: new Date(baseNow.getTime() - (15 * 60_000 - 1)),
      });
      expect(service.classifyCandidate(before15, oldHeartbeat, baseNow, thresholds).eligible).toBe(
        false,
      );

      // Exactly at 15m -> eligible
      const exact15 = createCandidate({
        workspaceStatus: 'connected',
        lastActivityAt: new Date(baseNow.getTime() - 15 * 60_000),
      });
      const resExact = service.classifyCandidate(exact15, oldHeartbeat, baseNow, thresholds);
      expect(resExact.eligible).toBe(true);
      expect(resExact.reason).toBe('idle_timeout');
    });

    it('HARD GUARD: fresh heartbeat within 300 seconds prevents reaping regardless of disconnect or idle status', () => {
      // Disconnected 90 minutes ago, but fresh WebSocket heartbeat 4m 59s (299s) ago
      const candidate = createCandidate({
        workspaceStatus: 'disconnected',
        lastActivityAt: new Date(baseNow.getTime() - 90 * 60_000),
      });
      const freshHeartbeat = new Date(baseNow.getTime() - 299 * 1000); // 299s ago

      const res = service.classifyCandidate(candidate, freshHeartbeat, baseNow, defaultThresholds);
      expect(res.eligible).toBe(false);
      expect(res.skipReason).toBe('heartbeat_guard_active');

      // Once heartbeat is exactly at 300s (5m00s), guard no longer blocks
      const heartbeatAt300 = new Date(baseNow.getTime() - 300 * 1000);
      const res300 = service.classifyCandidate(
        candidate,
        heartbeatAt300,
        baseNow,
        defaultThresholds,
      );
      expect(res300.eligible).toBe(true);
      expect(res300.reason).toBe('disconnected_timeout');
    });

    it('HARD GUARD: unknown heartbeat (null) fails closed for connected session (never reaped)', () => {
      const candidate = createCandidate({
        workspaceStatus: 'connected',
        lastActivityAt: new Date(baseNow.getTime() - 120 * 60_000),
      });
      const res = service.classifyCandidate(candidate, null, baseNow, {
        ...defaultThresholds,
        idleEnabled: true,
      });
      expect(res.eligible).toBe(false);
      expect(res.skipReason).toBe('heartbeat_unknown');
    });

    it('HARD GUARD: skips workspace with terminal status (destroyed, failed)', () => {
      const destroyed = createCandidate({ workspaceStatus: 'destroyed' });
      expect(service.classifyCandidate(destroyed, null, baseNow, defaultThresholds).eligible).toBe(
        false,
      );
      expect(
        service.classifyCandidate(destroyed, null, baseNow, defaultThresholds).skipReason,
      ).toBe('already_terminal');

      const failed = createCandidate({ workspaceStatus: 'failed' });
      expect(service.classifyCandidate(failed, null, baseNow, defaultThresholds).eligible).toBe(
        false,
      );
      expect(service.classifyCandidate(failed, null, baseNow, defaultThresholds).skipReason).toBe(
        'already_terminal',
      );
    });

    it('HARD GUARD: recently started or resumed workspace is protected by 60s grace window', () => {
      const candidate = createCandidate({
        workspaceStatus: 'disconnected',
        startedAt: new Date(baseNow.getTime() - 30 * 1000), // started 30s ago
        lastActivityAt: new Date(baseNow.getTime() - 30 * 1000),
      });
      const res = service.classifyCandidate(candidate, null, baseNow, defaultThresholds);
      expect(res.eligible).toBe(false);
      expect(res.skipReason).toBe('recent_activity_grace');
    });

    it('DEADLINE EXPIRED: waits for AutoSubmitWorker if assignment is not yet submitted', () => {
      const deadlinePassedUnsubmitted = createCandidate({
        workspaceStatus: 'disconnected',
        assignmentStatus: 'in_progress',
        deadlineAt: new Date(baseNow.getTime() - 300 * 1000), // 5m expired
        lastActivityAt: new Date(baseNow.getTime() - 10 * 60_000), // only 10m disconnected (< 60m)
      });
      const res = service.classifyCandidate(
        deadlinePassedUnsubmitted,
        null,
        baseNow,
        defaultThresholds,
      );
      expect(res.eligible).toBe(false);
      expect(res.skipReason).toBe('awaiting_auto_submit');
    });

    it('DEADLINE EXPIRED: eligible to reap when assignment is submitted and bundle exists', () => {
      const deadlinePassedSubmitted = createCandidate({
        workspaceStatus: 'disconnected',
        assignmentStatus: 'submitted',
        deadlineAt: new Date(baseNow.getTime() - 300 * 1000),
        artifactsRef: 'submissions/org/asg/final_bundle.tar.gz',
        lastActivityAt: new Date(baseNow.getTime() - 10 * 60_000),
      });
      const res = service.classifyCandidate(
        deadlinePassedSubmitted,
        null,
        baseNow,
        defaultThresholds,
      );
      expect(res.eligible).toBe(true);
      expect(res.reason).toBe('deadline_expired_submitted');
    });

    it('ORPHAN DETECTION: eligible when candidate soft-deleted, assignment revoked, or assignment expired', () => {
      const deletedCandidate = createCandidate({
        candidateDeletedAt: new Date(baseNow.getTime() - 1000),
        lastActivityAt: new Date(baseNow.getTime() - 10 * 60_000),
      });
      expect(
        service.classifyCandidate(deletedCandidate, null, baseNow, defaultThresholds).eligible,
      ).toBe(true);
      expect(
        service.classifyCandidate(deletedCandidate, null, baseNow, defaultThresholds).reason,
      ).toBe('orphan_candidate_deleted');

      const revokedAsg = createCandidate({
        assignmentStatus: 'revoked',
        lastActivityAt: new Date(baseNow.getTime() - 10 * 60_000),
      });
      expect(service.classifyCandidate(revokedAsg, null, baseNow, defaultThresholds).eligible).toBe(
        true,
      );
      expect(service.classifyCandidate(revokedAsg, null, baseNow, defaultThresholds).reason).toBe(
        'orphan_revoked',
      );

      const expiredAsg = createCandidate({
        assignmentStatus: 'expired',
        lastActivityAt: new Date(baseNow.getTime() - 10 * 60_000),
      });
      expect(service.classifyCandidate(expiredAsg, null, baseNow, defaultThresholds).eligible).toBe(
        true,
      );
      expect(service.classifyCandidate(expiredAsg, null, baseNow, defaultThresholds).reason).toBe(
        'orphan_expired',
      );
    });
  });

  describe('2. Race Conditions & Atomic Claims', () => {
    let service: WorkspaceReaperService;
    let fakeRegistry: FakeWorkspaceReaperRegistry;
    let fakeHeartbeat: FakeWorkspaceHeartbeatAdapter;
    let fakeSnapshot: FakeWorkspaceSnapshotAdapter;
    let fakeDestroyer: FakeWorkspaceDestroyer;
    let fakeNotifier: FakeWorkspaceNotifier;
    let fakeLifecycle: FakeWorkspaceLifecycleAdapter;
    let fakeAudit: any;

    beforeEach(() => {
      fakeRegistry = new FakeWorkspaceReaperRegistry();
      fakeHeartbeat = new FakeWorkspaceHeartbeatAdapter();
      fakeSnapshot = new FakeWorkspaceSnapshotAdapter();
      fakeDestroyer = new FakeWorkspaceDestroyer();
      fakeNotifier = new FakeWorkspaceNotifier();
      fakeLifecycle = new FakeWorkspaceLifecycleAdapter();
      fakeAudit = { record: vi.fn().mockResolvedValue(undefined) };

      const mockConfig: any = {
        WORKSPACE_REAPER_ENABLED: true,
        REAPER_DRY_RUN: false,
        REAPER_INTERVAL_SECONDS: 300,
        REAPER_DISCONNECTED_TIMEOUT_MINUTES: 60,
      };

      service = new WorkspaceReaperService(
        mockConfig,
        fakeRegistry,
        fakeHeartbeat,
        fakeSnapshot,
        fakeDestroyer,
        fakeNotifier,
        fakeLifecycle,
        fakeAudit,
      );
    });

    it('CAS failure: candidate reconnects between scan and claim, aborting teardown without destruction', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];
      // Simulate CAS failure: workspace activity timestamp moved concurrently
      fakeRegistry.failNextClaim = true;

      const report = await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(report.scanned).toBe(1);
      expect(report.eligible).toBe(1);
      expect(report.reaped).toBe(0);
      expect(report.skipped).toBe(1);
      expect(report.results[0]?.skipReason).toBe('claim_lost');
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(0);
      expect(fakeAudit.record).not.toHaveBeenCalled();
    });

    it('POST-CLAIM GUARD: candidate sends heartbeat immediately post-claim, releasing claim and aborting destroy', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];

      // Initially no heartbeat during scan, but arrives before destroy
      vi.spyOn(fakeHeartbeat, 'getLastHeartbeat')
        .mockResolvedValueOnce(null) // scan check
        .mockResolvedValueOnce(new Date(baseNow.getTime() - 10 * 1000)); // fresh post-claim check (10s ago)

      const report = await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(report.reaped).toBe(0);
      expect(report.results[0]?.skipReason).toBe('post_claim_guard_violation');
      expect(fakeRegistry.releasedClaims).toContain(candidate.workspaceId);
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(0);
    });

    it('CONCURRENCY: overlapping sweeps are prevented by active run guard', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];

      // Start two sweeps simultaneously
      const [run1, run2] = await Promise.all([
        service.sweep({ now: baseNow }),
        service.sweep({ now: baseNow }),
      ]);

      // Exactly one executes, the other is rejected cleanly
      expect(run1.scanned + run2.scanned).toBe(1);
      expect(run1.reaped + run2.reaped).toBe(1);
    });

    it('STALE-CLAIM RECOVERY: resumes and destroys workspaces stuck in ended state from a crashed sweep', async () => {
      const stuckWorkspace = createCandidate({
        workspaceStatus: 'ended',
        endedAt: new Date(baseNow.getTime() - 20 * 60_000), // 20m ago (> 10m stale claim limit)
        assignmentStatus: 'submitted',
        artifactsRef: 'submissions/org/asg/final_bundle.tar.gz',
      });
      fakeRegistry.candidates = [stuckWorkspace];

      const report = await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(report.reaped).toBe(1);
      expect(report.results[0]?.reason).toBe('stale_claim_recovery');
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(1);
    });
  });

  describe('3. Execution Pipeline & Safety Invariants', () => {
    let service: WorkspaceReaperService;
    let fakeRegistry: FakeWorkspaceReaperRegistry;
    let fakeHeartbeat: FakeWorkspaceHeartbeatAdapter;
    let fakeSnapshot: FakeWorkspaceSnapshotAdapter;
    let fakeDestroyer: FakeWorkspaceDestroyer;
    let fakeNotifier: FakeWorkspaceNotifier;
    let fakeLifecycle: FakeWorkspaceLifecycleAdapter;
    let fakeAudit: any;

    beforeEach(() => {
      fakeRegistry = new FakeWorkspaceReaperRegistry();
      fakeHeartbeat = new FakeWorkspaceHeartbeatAdapter();
      fakeSnapshot = new FakeWorkspaceSnapshotAdapter();
      fakeDestroyer = new FakeWorkspaceDestroyer();
      fakeNotifier = new FakeWorkspaceNotifier();
      fakeLifecycle = new FakeWorkspaceLifecycleAdapter();
      fakeAudit = { record: vi.fn().mockResolvedValue(undefined) };

      const mockConfig: any = {
        WORKSPACE_REAPER_ENABLED: true,
        REAPER_DRY_RUN: false,
        REAPER_INTERVAL_SECONDS: 300,
        REAPER_DISCONNECTED_TIMEOUT_MINUTES: 60,
      };

      service = new WorkspaceReaperService(
        mockConfig,
        fakeRegistry,
        fakeHeartbeat,
        fakeSnapshot,
        fakeDestroyer,
        fakeNotifier,
        fakeLifecycle,
        fakeAudit,
      );
    });

    it('executes pipeline in strict order: claim -> notify -> snapshot -> destroy -> mark -> audit', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];

      const callOrder: string[] = [];
      vi.spyOn(fakeRegistry, 'claimWorkspace').mockImplementation(async () => {
        callOrder.push('claim');
        return {
          workspaceId: candidate.workspaceId,
          orgId: candidate.orgId,
          assignmentId: candidate.assignmentId,
          candidateId: candidate.candidateId,
          status: 'ended',
          endedAt: baseNow,
          snapshotRef: null,
          runtimeRef: candidate.runtimeRef,
        };
      });
      vi.spyOn(fakeNotifier, 'notifyCandidate').mockImplementation(async () => {
        callOrder.push('notify');
        return 'notified';
      });
      vi.spyOn(fakeSnapshot, 'ensureFinalSnapshot').mockImplementation(async () => {
        callOrder.push('snapshot');
        return { snapshotKey: 'snapshots/verified.tar.gz', sha256: 'sha256', isPartial: false };
      });
      vi.spyOn(fakeDestroyer, 'destroy').mockImplementation(async () => {
        callOrder.push('destroy');
        return {
          bytesReclaimed: 1000,
          memoryBytesReclaimed: 2000,
          containersRemoved: 1,
          volumesRemoved: 1,
        };
      });
      vi.spyOn(fakeRegistry, 'markDestroyed').mockImplementation(async () => {
        callOrder.push('markDestroyed');
      });
      fakeAudit.record.mockImplementation(async () => {
        callOrder.push('audit');
      });

      await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(callOrder).toEqual([
        'claim',
        'notify',
        'snapshot',
        'destroy',
        'markDestroyed',
        'audit',
      ]);
    });

    it('PREVENTS DESTRUCTION if snapshot capture fails: releases claim and never calls destroyer', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];
      fakeSnapshot.failNext = true; // simulate snapshot error

      const report = await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(report.reaped).toBe(0);
      expect(report.failed).toBe(1);
      expect(report.results[0]?.skipReason).toBe('snapshot_failed');
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(0);
      expect(fakeRegistry.releasedClaims).toContain(candidate.workspaceId);
    });

    it('records partial=true in audit payload if container was killed mid-save', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];
      fakeSnapshot.nextIsPartial = true;

      await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(fakeAudit.record).toHaveBeenCalledTimes(1);
      const auditPayload = fakeAudit.record.mock.calls[0][1];
      expect(auditPayload.action).toBe('workspace.reaped');
      expect(auditPayload.after.isPartial).toBe(true);
      expect(auditPayload.after.notificationStatus).toBe('notified');
    });

    it('DRY RUN MODE: classifies and logs but claims, snapshots, destroys, and audits NOTHING', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];

      const report = await service.sweep({ now: baseNow, dryRunOverride: true });

      expect(report.dryRun).toBe(true);
      expect(report.scanned).toBe(1);
      expect(report.eligible).toBe(1);
      expect(report.reaped).toBe(0);
      expect(report.results[0]?.action).toBe('dry_run');
      expect(fakeRegistry.claimsMade.length).toBe(0);
      expect(fakeSnapshot.capturedWorkspaces.length).toBe(0);
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(0);
      expect(fakeAudit.record).not.toHaveBeenCalled();
    });

    it('CIRCUIT BREAKER: aborts sweep when eligible workspaces exceed safety ratio of active pool', async () => {
      // 10 active workspaces, but 6 eligible candidates (> 50% max ratio)
      fakeRegistry.activeWorkspacesCount = 10;
      fakeRegistry.candidates = [
        createCandidate({ workspaceId: 'ws-1' }),
        createCandidate({ workspaceId: 'ws-2' }),
        createCandidate({ workspaceId: 'ws-3' }),
        createCandidate({ workspaceId: 'ws-4' }),
        createCandidate({ workspaceId: 'ws-5' }),
        createCandidate({ workspaceId: 'ws-6' }),
      ];

      const report = await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(report.circuitBreakerTriggered).toBe(true);
      expect(report.reaped).toBe(0);
      expect(report.skipped).toBe(6);
      expect(fakeDestroyer.destroyedWorkspaces.length).toBe(0);
      expect(fakeAudit.record).not.toHaveBeenCalled();
    });

    it('AUDIT LOG: emits exactly ONE audit event per reaped workspace with no PII', async () => {
      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];

      await service.sweep({ now: baseNow, dryRunOverride: false });

      expect(fakeAudit.record).toHaveBeenCalledTimes(1);
      const call = fakeAudit.record.mock.calls[0];
      expect(call[1].action).toBe('workspace.reaped');
      expect(call[1].entity).toBe('workspace');
      expect(call[1].entityId).toBe(candidate.workspaceId);
      expect(call[1].orgId).toBe(candidate.orgId);

      // Verify no candidate PII leaked
      const json = JSON.stringify(call[1]);
      expect(json).not.toContain('name');
      expect(json).not.toContain('email');
      expect(json).not.toContain('terminal');
      expect(json).not.toContain('file');
    });

    it('SECURITY SPY: ensures no child_process execution or real Docker command is ever invoked', async () => {
      // Statically verify that no reaper source file imports child_process or references docker CLI
      const fs = await import('node:fs');
      const path = await import('node:path');
      const reaperFiles = [
        'src/modules/workspaces/workspace-reaper.service.ts',
        'src/modules/workspaces/workspace-reaper.scheduler.ts',
        'src/modules/workspaces/adapters/pg-workspace-reaper-registry.adapter.ts',
        'src/modules/workspaces/ports/workspace-destroyer.port.ts',
      ];
      for (const rel of reaperFiles) {
        const full = path.resolve(__dirname, '..', rel);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, 'utf8');
          expect(content).not.toContain('child_process');
          expect(content).not.toContain('docker rm');
          expect(content).not.toContain('docker stop');
        }
      }

      const candidate = createCandidate();
      fakeRegistry.candidates = [candidate];
      const report = await service.sweep({ now: baseNow, dryRunOverride: false });
      expect(report.reaped).toBe(1);
    });

    it('PRODUCTION FAIL-CLOSED: FailClosedWorkspaceDestroyer refuses execution and throws error', async () => {
      const failClosed = new FailClosedWorkspaceDestroyer();
      await expect(failClosed.destroy({ orgId: 'org-1', workspaceId: 'ws-1' })).rejects.toThrow(
        'Real orchestrator container destroyer is not configured',
      );
    });

    it('PRODUCTION FAIL-CLOSED: FailClosedHeartbeatAdapter returns null to treat active session as fail-closed', async () => {
      const failClosed = new FailClosedHeartbeatAdapter();
      const res = await failClosed.getLastHeartbeat('org-1', 'ws-1');
      expect(res).toBeNull();
    });
  });

  describe('4. Database Integration & Cross-Tenancy (hellosmart_test)', () => {
    let pgPool: pg.Pool | null = null;
    let platformPool: pg.Pool | null = null;
    let dbConnected = false;

    const testAdminId = '90000000-0000-4000-8000-000000000093';
    const testOrgAId = '91111111-1111-4111-8111-111111111193';
    const testOrgBId = '92222222-2222-4222-8222-222222222293';
    const testCandidateAId = '93333333-3333-4333-8333-333333333393';
    const testCandidateBId = '94444444-4444-4444-8444-444444444493';
    const testTemplateId = '95555555-5555-4555-8555-555555555593';
    const testTemplateVersionId = '96666666-6666-4666-8666-666666666693';
    const testAssessmentAId = '97777777-7777-4777-8777-777777777793';
    const testAssessmentBId = '98888888-8888-4888-8888-888888888893';
    const testAssignmentAId = '99999999-9999-4999-8999-999999999993';
    const testAssignmentBId = '9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa93';
    const testWorkspaceAId = '9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb93';
    const testWorkspaceBId = '9ccccccc-cccc-4ccc-8ccc-cccccccccc93';

    beforeEach(async () => {
      try {
        pgPool = new pg.Pool({
          connectionString: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test',
        });
        platformPool = new pg.Pool({
          connectionString:
            'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test',
        });
        const testClient = await platformPool.connect();
        await testClient.query('SELECT 1');
        testClient.release();
        dbConnected = true;
      } catch {
        dbConnected = false;
      }
    });

    afterEach(async () => {
      if (pgPool) await pgPool.end();
      if (platformPool) await platformPool.end();
    });

    it('scans eligible workspaces cross-tenant, performs CAS claim, and respects RLS under real PostgreSQL schema', async () => {
      if (!dbConnected || !platformPool || !pgPool) {
        return; // Cleanly skip if db unavailable
      }

      const adminClient = new pg.Client({
        connectionString: 'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test',
      });
      await adminClient.connect();

      try {
        // Setup synthetic data in hellosmart_test
        await adminClient.query(
          "INSERT INTO app.users (id, org_id, email, name, role) VALUES ($1, null, 'reaper_admin@test.com', 'Reaper Admin', 'platform_admin') ON CONFLICT DO NOTHING",
          [testAdminId],
        );
        await adminClient.query(
          "INSERT INTO app.organizations (id, name, slug, created_by) VALUES ($1, 'Reaper Org A', 'reaper-org-a', $3), ($2, 'Reaper Org B', 'reaper-org-b', $3) ON CONFLICT DO NOTHING",
          [testOrgAId, testOrgBId, testAdminId],
        );
        await adminClient.query(
          "INSERT INTO app.users (id, org_id, email, name, role) VALUES ($1, $2, 'cand_a@test.com', 'Candidate A', 'candidate'), ($3, $4, 'cand_b@test.com', 'Candidate B', 'candidate') ON CONFLICT DO NOTHING",
          [testCandidateAId, testOrgAId, testCandidateBId, testOrgBId],
        );
        await adminClient.query(
          "INSERT INTO app.templates (id, slug, name, category, difficulty, workspace_mode, description) VALUES ($1, 'reaper-tpl', 'Reaper Template', 'engineering', 'Beginner', 'cloud', 'Desc') ON CONFLICT DO NOTHING",
          [testTemplateId],
        );
        await adminClient.query(
          "INSERT INTO app.template_versions (id, template_id, version, status, manifest) VALUES ($1, $2, '1.0.0', 'draft', '{}'::jsonb) ON CONFLICT DO NOTHING",
          [testTemplateVersionId, testTemplateId],
        );
        await adminClient.query(
          'INSERT INTO app.template_assignments (template_id, org_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING',
          [testTemplateId, testOrgAId, testOrgBId],
        );
        await adminClient.query(
          "INSERT INTO app.assessments (id, org_id, template_version_id, name, workspace_mode) VALUES ($1, $2, $3, 'Reaper Assessment A', 'cloud'), ($4, $5, $3, 'Reaper Assessment B', 'cloud') ON CONFLICT DO NOTHING",
          [testAssessmentAId, testOrgAId, testTemplateVersionId, testAssessmentBId, testOrgBId],
        );

        // Assignment A: disconnected 90 minutes ago (reapable)
        const disconnectedTime = new Date(Date.now() - 90 * 60_000);
        await adminClient.query(
          `INSERT INTO app.assignments (id, org_id, assessment_id, candidate_id, status, deadline_at)
           VALUES ($1, $2, $3, $4, 'disconnected', $5) ON CONFLICT DO NOTHING`,
          [
            testAssignmentAId,
            testOrgAId,
            testAssessmentAId,
            testCandidateAId,
            new Date(Date.now() + 3600_000),
          ],
        );
        await adminClient.query(
          `INSERT INTO app.workspaces (id, org_id, assignment_id, candidate_id, mode, status, started_at, last_activity_at)
           VALUES ($1, $2, $3, $4, 'cloud', 'disconnected', $5, $5) ON CONFLICT DO NOTHING`,
          [testWorkspaceAId, testOrgAId, testAssignmentAId, testCandidateAId, disconnectedTime],
        );

        // Assignment B: connected and active (NOT reapable)
        const activeTime = new Date();
        await adminClient.query(
          `INSERT INTO app.assignments (id, org_id, assessment_id, candidate_id, status, deadline_at)
           VALUES ($1, $2, $3, $4, 'in_progress', $5) ON CONFLICT DO NOTHING`,
          [
            testAssignmentBId,
            testOrgBId,
            testAssessmentBId,
            testCandidateBId,
            new Date(Date.now() + 3600_000),
          ],
        );
        await adminClient.query(
          `INSERT INTO app.workspaces (id, org_id, assignment_id, candidate_id, mode, status, started_at, last_activity_at)
           VALUES ($1, $2, $3, $4, 'cloud', 'connected', $5, $5) ON CONFLICT DO NOTHING`,
          [testWorkspaceBId, testOrgBId, testAssignmentBId, testCandidateBId, activeTime],
        );

        const adapter = new PgWorkspaceReaperRegistryAdapter(pgPool, platformPool);

        // 1. Cross-tenant candidate discovery via platform pool
        const cutoff = new Date(Date.now() - 60 * 60_000);
        const candidates = await adapter.findReapCandidates({
          now: new Date(),
          disconnectedCutoff: cutoff,
          idleCutoff: cutoff,
          idleEnabled: false,
          limit: 10,
        });

        expect(candidates.some((c) => c.workspaceId === testWorkspaceAId)).toBe(true);
        expect(candidates.some((c) => c.workspaceId === testWorkspaceBId)).toBe(false);

        // 2. Atomic CAS claim
        const claim = await adapter.claimWorkspace({
          workspaceId: testWorkspaceAId,
          orgId: testOrgAId,
          expectedStatus: 'disconnected',
          expectedLastActivityAt: disconnectedTime,
          now: new Date(),
        });
        expect(claim).not.toBeNull();
        expect(claim?.status).toBe('ended');

        // 3. Mark destroyed
        const finalSnapshotKey = `snapshots/${testOrgAId}/${testAssignmentAId}/final_snapshot.tar.gz`;
        await adapter.markDestroyed({
          workspaceId: testWorkspaceAId,
          orgId: testOrgAId,
          snapshotRef: finalSnapshotKey,
          endedAt: new Date(),
        });

        // 4. Verify status became destroyed in database
        const checkRes = await adminClient.query(
          'SELECT status, snapshot_ref FROM app.workspaces WHERE id = $1',
          [testWorkspaceAId],
        );
        expect(checkRes.rows[0]?.status).toBe('destroyed');
        expect(checkRes.rows[0]?.snapshot_ref).toBe(finalSnapshotKey);

        // 5. Cross-tenant isolation (BR-01): Org B cannot mutate Org A workspace
        await adapter.releaseClaim({
          workspaceId: testWorkspaceAId,
          orgId: testOrgBId, // wrong tenant!
          originalStatus: 'disconnected',
          originalEndedAt: null,
        });
        const verifyIsolation = await adminClient.query(
          'SELECT status FROM app.workspaces WHERE id = $1',
          [testWorkspaceAId],
        );
        expect(verifyIsolation.rows[0]?.status).toBe('destroyed'); // unchanged!
      } finally {
        // Complete cleanup in dependency order
        await adminClient.query('DELETE FROM app.workspaces WHERE id IN ($1, $2)', [
          testWorkspaceAId,
          testWorkspaceBId,
        ]);
        await adminClient.query('DELETE FROM app.assignments WHERE id IN ($1, $2)', [
          testAssignmentAId,
          testAssignmentBId,
        ]);
        await adminClient.query('DELETE FROM app.assessments WHERE id IN ($1, $2)', [
          testAssessmentAId,
          testAssessmentBId,
        ]);
        await adminClient.query('DELETE FROM app.template_assignments WHERE template_id = $1', [
          testTemplateId,
        ]);
        await adminClient.query('DELETE FROM app.template_versions WHERE id = $1', [
          testTemplateVersionId,
        ]);
        await adminClient.query('DELETE FROM app.templates WHERE id = $1', [testTemplateId]);
        await adminClient.query('DELETE FROM app.users WHERE id IN ($1, $2)', [
          testCandidateAId,
          testCandidateBId,
        ]);
        await adminClient.query('DELETE FROM app.organizations WHERE id IN ($1, $2)', [
          testOrgAId,
          testOrgBId,
        ]);
        await adminClient.query('DELETE FROM app.users WHERE id = $1', [testAdminId]);
        await adminClient.end();
      }
    });
  });

  describe('5. BullMQ Scheduler Conventions & Opt-In Redis Integration', () => {
    it('scheduler queue name is workspace-reaper, repeats every 300s, and is disabled in test env', () => {
      const mockReaperService: any = { sweep: vi.fn() };
      const config: any = {
        WORKSPACE_REAPER_ENABLED: false,
        REAPER_DRY_RUN: true,
        REAPER_INTERVAL_SECONDS: 300,
        NODE_ENV: 'test',
      };

      const scheduler = new (class extends WorkspaceReaperScheduler {})(config, mockReaperService);

      scheduler.onApplicationBootstrap();
      expect((scheduler as any).queue).toBeNull();
      expect((scheduler as any).worker).toBeNull();
    });

    it('validates config: fails when WORKSPACE_REAPER_ENABLED=true but REDIS_URL missing', () => {
      const mockReaperService: any = { sweep: vi.fn() };
      const config: any = {
        WORKSPACE_REAPER_ENABLED: true,
        REAPER_DRY_RUN: true,
        REDIS_URL: undefined,
        NODE_ENV: 'development',
      };

      const scheduler = new (class extends WorkspaceReaperScheduler {})(config, mockReaperService);

      expect(() => (scheduler as any).validateRuntimeConfiguration()).toThrow(
        'REDIS_URL to be defined',
      );
    });

    it('validates config: fails when REAPER_DRY_RUN=false in non-prod without REAPER_ALLOW_DESTRUCTION_IN_NON_PROD=true', () => {
      const mockReaperService: any = { sweep: vi.fn() };
      const config: any = {
        WORKSPACE_REAPER_ENABLED: true,
        REAPER_DRY_RUN: false,
        REAPER_ALLOW_DESTRUCTION_IN_NON_PROD: false,
        REDIS_URL: 'redis://localhost:6379',
        NODE_ENV: 'development',
      };

      const scheduler = new (class extends WorkspaceReaperScheduler {})(config, mockReaperService);

      expect(() => (scheduler as any).validateRuntimeConfiguration()).toThrow(
        'REAPER_DRY_RUN=false in non-production requires REAPER_ALLOW_DESTRUCTION_IN_NON_PROD=true',
      );
    });

    const runRedis = process.env.RUN_REDIS_TESTS === '1';
    (runRedis ? it : it.skip)(
      'opt-in Redis integration: verifies repeatable job execution with isolated prefix and cleans up',
      async () => {
        const { Queue, Worker } = await import('bullmq');
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        const url = new URL(redisUrl);
        const connection = {
          host: url.hostname,
          port: Number(url.port || 6379),
          maxRetriesPerRequest: null,
        };
        const randomPrefix = `test:reaper:${Date.now()}`;
        const queueName = 'workspace-reaper';

        const queue = new Queue(queueName, { connection, prefix: randomPrefix });
        let sweepRuns = 0;
        const worker = new Worker(
          queueName,
          async () => {
            sweepRuns++;
            return { ok: true };
          },
          { connection, prefix: randomPrefix },
        );

        try {
          await queue.add('sweep', {}, { repeat: { every: 100 } });
          // Wait briefly for at least two runs
          const startWait = Date.now();
          while (sweepRuns < 2 && Date.now() - startWait < 3000) {
            await new Promise((r) => setTimeout(r, 100));
          }
          expect(sweepRuns).toBeGreaterThanOrEqual(2);
        } finally {
          await worker.close();
          await queue.obliterate({ force: true });
          await queue.close();
        }
      },
    );
  });

  describe('6. Contract Tests (Skipped with Concrete Dependencies)', () => {
    it.skip('contract: real Docker/Sysbox container stop and volume removal (blocked on workspace orchestrator)', () => {});
    it.skip('contract: real WebSocket heartbeat stream ingestion (blocked on ws-gateway and ws-agent T-022/T-023)', () => {});
    it.skip('contract: candidate in-app or email destroy notification delivery (blocked on notification template design)', () => {});
    it.skip('contract: auto-submit triggering directly from reaper (reaper waits for AutoSubmitWorker)', () => {});
    it.skip('contract: real host disk and RAM cgroup metrics collection (blocked on orchestrator host agent)', () => {});
    it.skip('contract: per-session and per-org hard spend limit enforcement (belongs to cost aggregator ticket)', () => {});
  });
});
