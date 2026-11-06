import type { ClaimedWorkspace, ReapCandidate } from '../workspace-reaper.types.js';

export interface WorkspaceReaperRegistryPort {
  /**
   * Scans cross-tenant active workspaces and returns potential reap candidates.
   */
  findReapCandidates(options: {
    now: Date;
    disconnectedCutoff: Date;
    idleCutoff: Date;
    idleEnabled: boolean;
    limit: number;
  }): Promise<ReapCandidate[]>;

  /**
   * Returns total count of active workspaces currently in progress (connected, disconnected, provisioning).
   * Used for the circuit breaker sanity calculation.
   */
  countActiveWorkspaces(): Promise<number>;

  /**
   * Performs an atomic compare-and-set claim on a workspace:
   * Sets status = 'ended', ended_at = now WHERE id = $1 AND status = $expectedStatus AND last_activity_at = $expectedLastActivity.
   * Returns ClaimedWorkspace if acquired, or null if CAS failed (e.g. candidate reconnected or status changed).
   */
  claimWorkspace(params: {
    workspaceId: string;
    orgId: string;
    expectedStatus: string;
    expectedLastActivityAt: Date;
    now: Date;
  }): Promise<ClaimedWorkspace | null>;

  /**
   * Marks a claimed workspace as destroyed and records the final snapshot reference.
   */
  markDestroyed(params: {
    workspaceId: string;
    orgId: string;
    snapshotRef: string;
    endedAt: Date;
  }): Promise<void>;

  /**
   * Releases an unfinalized claim back to its original status if teardown was aborted
   * (e.g. heartbeat guard re-triggered post-claim or snapshot verification failed).
   */
  releaseClaim(params: {
    workspaceId: string;
    orgId: string;
    originalStatus: string;
    originalEndedAt: Date | null;
  }): Promise<void>;
}

export const WORKSPACE_REAPER_REGISTRY_PORT = Symbol('WORKSPACE_REAPER_REGISTRY_PORT');
