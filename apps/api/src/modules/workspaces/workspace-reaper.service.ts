import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import {
  WORKSPACE_DESTROYER_PORT,
  type WorkspaceDestroyerPort,
} from './ports/workspace-destroyer.port.js';
import {
  WORKSPACE_HEARTBEAT_PORT,
  type WorkspaceHeartbeatPort,
} from './ports/workspace-heartbeat.port.js';
import {
  WORKSPACE_LIFECYCLE_PORT,
  type WorkspaceLifecyclePort,
} from './ports/workspace-lifecycle.port.js';
import {
  WORKSPACE_NOTIFIER_PORT,
  type WorkspaceNotifierPort,
} from './ports/workspace-notifier.port.js';
import {
  WORKSPACE_REAPER_REGISTRY_PORT,
  type WorkspaceReaperRegistryPort,
} from './ports/workspace-reaper-registry.port.js';
import {
  WORKSPACE_SNAPSHOT_PORT,
  type WorkspaceSnapshotPort,
} from './ports/workspace-snapshot.port.js';
import type {
  ClassificationResult,
  ReapCandidate,
  ReapItemResult,
  ReaperSweepReport,
  WorkspaceReaperThresholds,
} from './workspace-reaper.types.js';

@Injectable()
export class WorkspaceReaperService {
  private readonly logger = new Logger(WorkspaceReaperService.name);
  private isSweepRunning = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(WORKSPACE_REAPER_REGISTRY_PORT)
    private readonly registry: WorkspaceReaperRegistryPort,
    @Inject(WORKSPACE_HEARTBEAT_PORT)
    private readonly heartbeatPort: WorkspaceHeartbeatPort,
    @Inject(WORKSPACE_SNAPSHOT_PORT)
    private readonly snapshotPort: WorkspaceSnapshotPort,
    @Inject(WORKSPACE_DESTROYER_PORT)
    private readonly destroyerPort: WorkspaceDestroyerPort,
    @Inject(WORKSPACE_NOTIFIER_PORT)
    private readonly notifierPort: WorkspaceNotifierPort,
    @Inject(WORKSPACE_LIFECYCLE_PORT)
    private readonly lifecyclePort: WorkspaceLifecyclePort,
    private readonly audit: AuditService,
  ) {}

  public getThresholds(): WorkspaceReaperThresholds {
    return {
      disconnectedTimeoutMinutes: this.config.REAPER_DISCONNECTED_TIMEOUT_MINUTES ?? 60,
      idleTimeoutMinutes: this.config.REAPER_IDLE_TIMEOUT_MINUTES ?? 15,
      idleEnabled: this.config.REAPER_IDLE_ENABLED ?? false,
      heartbeatGuardSeconds: this.config.REAPER_HEARTBEAT_GUARD_SECONDS ?? 300,
      recentActivityGraceSeconds: 60,
      staleClaimTimeoutMinutes: 10,
      circuitBreakerMaxRatio: this.config.REAPER_CIRCUIT_BREAKER_MAX_RATIO ?? 0.5,
      batchLimit: this.config.REAPER_BATCH_LIMIT ?? 50,
    };
  }

  /**
   * Pure classification function evaluated against injected clock and thresholds.
   * Enforces hard guards (active heartbeat, fail-closed unknown heartbeat, grace, terminal state)
   * before checking reap reasons (disconnected timeout, idle timeout, deadline expired, orphan).
   */
  public classifyCandidate(
    candidate: ReapCandidate,
    lastHeartbeatAt: Date | null,
    now: Date,
    thresholds: WorkspaceReaperThresholds,
  ): ClassificationResult {
    // Hard Guard 1: Terminal status cannot be reaped again
    if (candidate.workspaceStatus === 'destroyed' || candidate.workspaceStatus === 'failed') {
      return { eligible: false, skipReason: 'already_terminal' };
    }

    // Hard Guard 2: Stale claim recovery for workspaces left in 'ended' state
    if (candidate.workspaceStatus === 'ended') {
      const isConcluded =
        candidate.assignmentStatus === 'submitted' ||
        candidate.assignmentStatus === 'expired' ||
        candidate.assignmentStatus === 'revoked' ||
        candidate.candidateDeletedAt !== null;

      if (isConcluded) {
        // If already snapshotted/bundled or stale past threshold, eligible to finalize destruction
        const staleLimitMs = thresholds.staleClaimTimeoutMinutes * 60_000;
        const endedAgeMs = candidate.endedAt ? now.getTime() - candidate.endedAt.getTime() : 0;
        if (candidate.artifactsRef || candidate.snapshotRef || endedAgeMs >= staleLimitMs) {
          return { eligible: true, reason: 'stale_claim_recovery' };
        }
        return { eligible: false, skipReason: 'awaiting_bundle' };
      }
      return { eligible: false, skipReason: 'already_terminal' };
    }

    // Hard Guard 3: Heartbeat Active Guard (5-minute rule)
    // Never reaps a container that has an active WebSocket heartbeat within the last 5 minutes
    if (lastHeartbeatAt !== null) {
      const elapsedSeconds = (now.getTime() - lastHeartbeatAt.getTime()) / 1000;
      if (elapsedSeconds < thresholds.heartbeatGuardSeconds) {
        return { eligible: false, skipReason: 'heartbeat_guard_active' };
      }
    }

    // Hard Guard 4: Fail-closed Unknown Heartbeat Guard
    // If a session is connected, unknown heartbeat MUST fail closed (treat as active, never reap)
    if (candidate.workspaceStatus === 'connected' && lastHeartbeatAt === null) {
      return { eligible: false, skipReason: 'heartbeat_unknown' };
    }

    // Hard Guard 5: Recent Activity Grace Window
    const startedAgeSeconds = (now.getTime() - candidate.startedAt.getTime()) / 1000;
    const lastActivityAgeSeconds = (now.getTime() - candidate.lastActivityAt.getTime()) / 1000;
    if (
      startedAgeSeconds < thresholds.recentActivityGraceSeconds ||
      lastActivityAgeSeconds < thresholds.recentActivityGraceSeconds
    ) {
      return { eligible: false, skipReason: 'recent_activity_grace' };
    }

    // Reason 1: Assessment Deadline Expired
    if (candidate.deadlineAt !== null && now >= candidate.deadlineAt) {
      if (candidate.assignmentStatus === 'submitted') {
        if (candidate.artifactsRef !== null || candidate.snapshotRef !== null) {
          return { eligible: true, reason: 'deadline_expired_submitted' };
        }
        return { eligible: false, skipReason: 'awaiting_bundle' };
      }
      // If assignment has not been auto-submitted yet, wait for AutoSubmitWorker
      return { eligible: false, skipReason: 'awaiting_auto_submit' };
    }

    // Reason 2: Orphan (Candidate soft-deleted, Assignment submitted/expired/revoked)
    if (candidate.candidateDeletedAt !== null) {
      return { eligible: true, reason: 'orphan_candidate_deleted' };
    }
    if (candidate.assignmentStatus === 'submitted') {
      if (candidate.artifactsRef !== null || candidate.snapshotRef !== null) {
        return { eligible: true, reason: 'orphan_submitted' };
      }
      return { eligible: false, skipReason: 'awaiting_bundle' };
    }
    if (candidate.assignmentStatus === 'expired') {
      return { eligible: true, reason: 'orphan_expired' };
    }
    if (candidate.assignmentStatus === 'revoked') {
      return { eligible: true, reason: 'orphan_revoked' };
    }

    // Reason 3: Disconnected Timeout (default 60 minutes)
    if (candidate.workspaceStatus === 'disconnected') {
      const disconnectedMinutes = (now.getTime() - candidate.lastActivityAt.getTime()) / 60_000;
      if (disconnectedMinutes >= thresholds.disconnectedTimeoutMinutes) {
        return { eligible: true, reason: 'disconnected_timeout' };
      }
      return { eligible: false, skipReason: 'disconnected_within_threshold' };
    }

    // Reason 4: Idle Connected Timeout (default 15 minutes, disabled by default)
    if (thresholds.idleEnabled && candidate.workspaceStatus === 'connected') {
      const idleMinutes = (now.getTime() - candidate.lastActivityAt.getTime()) / 60_000;
      if (idleMinutes >= thresholds.idleTimeoutMinutes) {
        return { eligible: true, reason: 'idle_timeout' };
      }
      return { eligible: false, skipReason: 'idle_within_threshold' };
    }

    return { eligible: false, skipReason: 'active_session' };
  }

  /**
   * Executes a periodic reaper sweep across all tenants.
   */
  public async sweep(options?: {
    now?: Date;
    dryRunOverride?: boolean;
  }): Promise<ReaperSweepReport> {
    const startTime = Date.now();
    const now = options?.now ?? new Date();
    const thresholds = this.getThresholds();
    const isDryRun = options?.dryRunOverride ?? this.config.REAPER_DRY_RUN ?? true;

    if (this.isSweepRunning) {
      this.logger.warn('Reaper sweep already in progress; skipping concurrent invocation');
      return {
        scanned: 0,
        eligible: 0,
        reaped: 0,
        skipped: 0,
        failed: 0,
        dryRun: isDryRun,
        circuitBreakerTriggered: false,
        durationMs: 0,
        results: [],
      };
    }

    this.isSweepRunning = true;
    try {
      const disconnectedCutoff = new Date(
        now.getTime() - thresholds.disconnectedTimeoutMinutes * 60_000,
      );
      const idleCutoff = new Date(now.getTime() - thresholds.idleTimeoutMinutes * 60_000);

      const candidates = await this.registry.findReapCandidates({
        now,
        disconnectedCutoff,
        idleCutoff,
        idleEnabled: thresholds.idleEnabled,
        limit: thresholds.batchLimit,
      });

      // Classify each candidate
      const classified: Array<{
        candidate: ReapCandidate;
        classification: ClassificationResult;
        heartbeatAt: Date | null;
      }> = [];

      for (const candidate of candidates) {
        const heartbeatAt = await this.heartbeatPort.getLastHeartbeat(
          candidate.orgId,
          candidate.workspaceId,
        );
        const classification = this.classifyCandidate(candidate, heartbeatAt, now, thresholds);
        classified.push({ candidate, classification, heartbeatAt });
      }

      const eligibleList = classified.filter((c) => c.classification.eligible);
      const activeWorkspacesCount = await this.registry.countActiveWorkspaces();

      // Circuit Breaker check
      // Abort if eligible candidates exceed safety ratio of active pool
      const maxAllowed = Math.max(
        Math.floor(activeWorkspacesCount * thresholds.circuitBreakerMaxRatio),
        5,
      );
      if (activeWorkspacesCount > 0 && eligibleList.length > maxAllowed) {
        this.logger.error(
          `CIRCUIT BREAKER TRIGGERED: ${eligibleList.length} workspaces eligible for reaping out of ${activeWorkspacesCount} active (limit: ${maxAllowed}). Aborting sweep to prevent mass destruction.`,
        );
        return {
          scanned: candidates.length,
          eligible: eligibleList.length,
          reaped: 0,
          skipped: candidates.length,
          failed: 0,
          dryRun: isDryRun,
          circuitBreakerTriggered: true,
          durationMs: Date.now() - startTime,
          results: candidates.map((c) => ({
            workspaceId: c.workspaceId,
            orgId: c.orgId,
            assignmentId: c.assignmentId,
            action: 'skipped',
            skipReason: 'circuit_breaker_triggered',
          })),
        };
      }

      const results: ReapItemResult[] = [];
      let reapedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const item of classified) {
        const { candidate, classification } = item;

        if (!classification.eligible) {
          skippedCount++;
          results.push({
            workspaceId: candidate.workspaceId,
            orgId: candidate.orgId,
            assignmentId: candidate.assignmentId,
            action: 'skipped',
            skipReason: classification.skipReason,
          });
          continue;
        }

        // Dry Run Mode: classify and log only
        if (isDryRun) {
          skippedCount++;
          results.push({
            workspaceId: candidate.workspaceId,
            orgId: candidate.orgId,
            assignmentId: candidate.assignmentId,
            action: 'dry_run',
            reason: classification.reason,
          });
          this.logger.log(
            `[DRY RUN] Would reap workspace ${candidate.workspaceId} (org=${candidate.orgId}, reason=${classification.reason})`,
          );
          continue;
        }

        // Real Execution Pipeline
        try {
          const itemResult = await this.executeReapPipeline(
            candidate,
            classification.reason!,
            thresholds,
            now,
          );
          results.push(itemResult);
          if (itemResult.action === 'reaped') {
            reapedCount++;
          } else if (itemResult.action === 'failed') {
            failedCount++;
          } else {
            skippedCount++;
          }
        } catch (err: unknown) {
          failedCount++;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Reap pipeline failed for workspace ${candidate.workspaceId}: ${message}`,
          );
          results.push({
            workspaceId: candidate.workspaceId,
            orgId: candidate.orgId,
            assignmentId: candidate.assignmentId,
            action: 'failed',
            reason: classification.reason,
            error: message,
          });
        }
      }

      this.logger.log(
        `Reaper sweep completed: scanned=${candidates.length}, eligible=${eligibleList.length}, reaped=${reapedCount}, skipped=${skippedCount}, failed=${failedCount}, dryRun=${isDryRun}`,
      );

      return {
        scanned: candidates.length,
        eligible: eligibleList.length,
        reaped: reapedCount,
        skipped: skippedCount,
        failed: failedCount,
        dryRun: isDryRun,
        circuitBreakerTriggered: false,
        durationMs: Date.now() - startTime,
        results,
      };
    } finally {
      this.isSweepRunning = false;
    }
  }

  /**
   * Executes the strictly ordered, fail-closed per-workspace teardown pipeline:
   * 1. Atomic CAS claim (status -> 'ended')
   * 2. Post-claim heartbeat guard re-check
   * 3. Candidate notification (BR-22)
   * 4. Final verified snapshot capture/verification (fail-closed if missing)
   * 5. Container & volume destruction via destroyer port
   * 6. Database transition to 'destroyed'
   * 7. Append-only audit record ('workspace.reaped')
   * 8. Lifecycle cache invalidation & termination signal
   */
  private async executeReapPipeline(
    candidate: ReapCandidate,
    reason: ReapCandidate['workspaceStatus'] extends string
      ? ClassificationResult['reason']
      : never,
    thresholds: WorkspaceReaperThresholds,
    now: Date,
  ): Promise<ReapItemResult> {
    // Step 1: Atomic CAS claim
    const claim = await this.registry.claimWorkspace({
      workspaceId: candidate.workspaceId,
      orgId: candidate.orgId,
      expectedStatus: candidate.workspaceStatus,
      expectedLastActivityAt: candidate.lastActivityAt,
      now,
    });

    if (!claim) {
      this.logger.warn(
        `Atomic claim failed for workspace ${candidate.workspaceId} (state changed concurrently); skipping`,
      );
      return {
        workspaceId: candidate.workspaceId,
        orgId: candidate.orgId,
        assignmentId: candidate.assignmentId,
        action: 'skipped',
        skipReason: 'claim_lost',
      };
    }

    // Step 2: Post-claim guard re-check
    // Verify candidate did not send a heartbeat immediately as claim was acquiring
    const freshHeartbeat = await this.heartbeatPort.getLastHeartbeat(
      candidate.orgId,
      candidate.workspaceId,
    );
    if (freshHeartbeat !== null) {
      const elapsedSeconds = (now.getTime() - freshHeartbeat.getTime()) / 1000;
      if (elapsedSeconds < thresholds.heartbeatGuardSeconds) {
        this.logger.warn(
          `Fresh heartbeat detected post-claim for workspace ${candidate.workspaceId} (${elapsedSeconds}s ago); releasing claim and aborting teardown`,
        );
        await this.registry.releaseClaim({
          workspaceId: candidate.workspaceId,
          orgId: candidate.orgId,
          originalStatus: candidate.workspaceStatus,
          originalEndedAt: candidate.endedAt,
        });
        return {
          workspaceId: candidate.workspaceId,
          orgId: candidate.orgId,
          assignmentId: candidate.assignmentId,
          action: 'skipped',
          skipReason: 'post_claim_guard_violation',
        };
      }
    }

    // Step 3: Candidate Notification (BR-22)
    const notificationStatus = await this.notifierPort.notifyCandidate({
      orgId: candidate.orgId,
      workspaceId: candidate.workspaceId,
      candidateId: candidate.candidateId,
      reason: reason ?? 'reaped',
    });

    // Step 4: Ensure Final Verified Snapshot
    const snapshotResult = await this.snapshotPort.ensureFinalSnapshot({
      workspace: candidate,
      now,
    });

    if (!snapshotResult) {
      this.logger.error(
        `Final snapshot verification failed for workspace ${candidate.workspaceId}; releasing claim and aborting destruction to prevent data loss`,
      );
      await this.registry.releaseClaim({
        workspaceId: candidate.workspaceId,
        orgId: candidate.orgId,
        originalStatus: candidate.workspaceStatus,
        originalEndedAt: candidate.endedAt,
      });
      return {
        workspaceId: candidate.workspaceId,
        orgId: candidate.orgId,
        assignmentId: candidate.assignmentId,
        action: 'failed',
        skipReason: 'snapshot_failed',
        notificationStatus,
        error: 'Snapshot capture or verification failed',
      };
    }

    // Step 5: Stop container & remove volume via destroyer port
    const reclaimedMetrics = await this.destroyerPort.destroy({
      orgId: candidate.orgId,
      workspaceId: candidate.workspaceId,
      runtimeRef: candidate.runtimeRef,
    });

    // Step 6: Mark workspace destroyed in DB
    await this.registry.markDestroyed({
      workspaceId: candidate.workspaceId,
      orgId: candidate.orgId,
      snapshotRef: snapshotResult.snapshotKey,
      endedAt: now,
    });

    // Step 7: Emit append-only audit event ('workspace.reaped')
    await this.audit.record(undefined as any, {
      actorId: null,
      actorRole: 'system',
      orgId: candidate.orgId,
      action: 'workspace.reaped',
      entity: 'workspace',
      entityId: candidate.workspaceId,
      after: {
        workspaceId: candidate.workspaceId,
        assignmentId: candidate.assignmentId,
        reason,
        thresholds: {
          disconnectedTimeoutMinutes: thresholds.disconnectedTimeoutMinutes,
          idleTimeoutMinutes: thresholds.idleTimeoutMinutes,
          heartbeatGuardSeconds: thresholds.heartbeatGuardSeconds,
        },
        snapshotKey: snapshotResult.snapshotKey,
        snapshotSha256: snapshotResult.sha256,
        isPartial: snapshotResult.isPartial,
        notificationStatus,
        reclaimedMetrics,
        dryRun: false,
      },
    });

    // Step 8: Invalidate cache & signal termination to lifecycle port
    try {
      await this.lifecyclePort.signalReadyForTermination(candidate.orgId, candidate.workspaceId);
      await this.lifecyclePort.invalidateWorkspaceCache(candidate.orgId, candidate.workspaceId);
    } catch (err: unknown) {
      this.logger.warn(
        `Lifecycle signal warning for workspace ${candidate.workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      workspaceId: candidate.workspaceId,
      orgId: candidate.orgId,
      assignmentId: candidate.assignmentId,
      action: 'reaped',
      reason,
      snapshotKey: snapshotResult.snapshotKey,
      snapshotSha256: snapshotResult.sha256,
      isPartial: snapshotResult.isPartial,
      reclaimedMetrics,
      notificationStatus,
    };
  }
}
