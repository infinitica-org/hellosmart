export type ReapReason =
  | 'disconnected_timeout'
  | 'idle_timeout'
  | 'deadline_expired_submitted'
  | 'orphan_submitted'
  | 'orphan_expired'
  | 'orphan_revoked'
  | 'orphan_candidate_deleted'
  | 'stale_claim_recovery';

export type ReapSkipReason =
  | 'heartbeat_guard_active'
  | 'heartbeat_unknown'
  | 'already_terminal'
  | 'recent_activity_grace'
  | 'awaiting_auto_submit'
  | 'awaiting_bundle'
  | 'disconnected_within_threshold'
  | 'idle_within_threshold'
  | 'idle_disabled'
  | 'active_session'
  | 'claim_lost'
  | 'post_claim_guard_violation'
  | 'snapshot_failed'
  | 'circuit_breaker_triggered'
  | 'dry_run';

export type NotificationStatus = 'notified' | 'not_implemented' | 'failed';

export interface ReclaimedMetrics {
  bytesReclaimed: number;
  memoryBytesReclaimed: number;
  containersRemoved: number;
  volumesRemoved: number;
  runtimeSeconds?: number;
}

export interface ReapCandidate {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  candidateId: string;
  workspaceStatus: string;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
  snapshotRef: string | null;
  runtimeRef: string | null;
  assignmentStatus: string;
  deadlineAt: Date | null;
  extendedMinutes: number;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  artifactsRef: string | null;
  candidateDeletedAt: Date | null;
}

export interface ClaimedWorkspace {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  candidateId: string;
  status: string;
  endedAt: Date;
  snapshotRef: string | null;
  runtimeRef: string | null;
}

export interface ClassificationResult {
  eligible: boolean;
  reason?: ReapReason | undefined;
  skipReason?: ReapSkipReason | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface ReapItemResult {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  action: 'reaped' | 'dry_run' | 'skipped' | 'failed';
  reason?: ReapReason | undefined;
  skipReason?: ReapSkipReason | undefined;
  snapshotKey?: string | undefined;
  snapshotSha256?: string | undefined;
  isPartial?: boolean | undefined;
  reclaimedMetrics?: ReclaimedMetrics | undefined;
  notificationStatus?: NotificationStatus | undefined;
  error?: string | undefined;
}

export interface ReaperSweepReport {
  scanned: number;
  eligible: number;
  reaped: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  circuitBreakerTriggered: boolean;
  durationMs: number;
  results: ReapItemResult[];
}

export interface WorkspaceReaperThresholds {
  /** Minutes of disconnect before reap eligibility (ticket: 60m, proposed). */
  disconnectedTimeoutMinutes: number;
  /** Minutes of connected inactivity before reap eligibility (ticket: 15m, proposed). */
  idleTimeoutMinutes: number;
  /** Whether the idle-connected timeout is active (default false to protect quiet candidates). */
  idleEnabled: boolean;
  /** Seconds within which a fresh heartbeat protects the container (default 300s). */
  heartbeatGuardSeconds: number;
  /** Seconds of grace after launch or resume before reaping can apply (default 60s). */
  recentActivityGraceSeconds: number;
  /** Minutes after which an ended/claimed workspace is treated as abandoned mid-teardown (default 10m). */
  staleClaimTimeoutMinutes: number;
  /** Maximum fraction of active workspaces that can be reaped in one sweep before tripping circuit breaker (default 0.5). */
  circuitBreakerMaxRatio: number;
  /** Maximum number of workspaces reaped per sweep (default 50). */
  batchLimit: number;
}
