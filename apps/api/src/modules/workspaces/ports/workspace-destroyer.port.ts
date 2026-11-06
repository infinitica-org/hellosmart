import { Injectable, Logger } from '@nestjs/common';
import type { ReclaimedMetrics } from '../workspace-reaper.types.js';

export interface WorkspaceDestroyerPort {
  /**
   * Stops the container, removes associated volumes, and reclaims compute resources.
   * Returns reclaimed host metrics.
   * Idempotent: missing container or volume is considered a success.
   */
  destroy(params: {
    orgId: string;
    workspaceId: string;
    runtimeRef?: string | null;
  }): Promise<ReclaimedMetrics>;
}

export const WORKSPACE_DESTROYER_PORT = Symbol('WORKSPACE_DESTROYER_PORT');

/**
 * Production fail-closed destroyer adapter.
 * Because the Docker/Sysbox orchestrator is not yet implemented, this adapter
 * refuses to run destruction commands.
 */
@Injectable()
export class FailClosedWorkspaceDestroyer implements WorkspaceDestroyerPort {
  private readonly logger = new Logger(FailClosedWorkspaceDestroyer.name);

  async destroy(params: {
    orgId: string;
    workspaceId: string;
    runtimeRef?: string | null;
  }): Promise<ReclaimedMetrics> {
    this.logger.error(
      `CRITICAL: Attempted to invoke real container destroyer for org=${params.orgId} ws=${params.workspaceId}, but orchestrator is not built. Refusing execution.`,
    );
    throw new Error(
      `Real orchestrator container destroyer is not configured or implemented for workspace ${params.workspaceId}`,
    );
  }
}

export class FakeWorkspaceDestroyer implements WorkspaceDestroyerPort {
  public destroyedWorkspaces: Array<{
    orgId: string;
    workspaceId: string;
    runtimeRef?: string | null;
  }> = [];

  public failNext = false;
  public metricsToReturn: ReclaimedMetrics = {
    bytesReclaimed: 52428800, // 50 MB disk
    memoryBytesReclaimed: 1073741824, // 1 GB RAM
    containersRemoved: 1,
    volumesRemoved: 1,
    runtimeSeconds: 3600,
  };

  async destroy(params: {
    orgId: string;
    workspaceId: string;
    runtimeRef?: string | null;
  }): Promise<ReclaimedMetrics> {
    if (this.failNext) {
      throw new Error(`Simulated destroyer error for workspace ${params.workspaceId}`);
    }
    this.destroyedWorkspaces.push(params);
    return { ...this.metricsToReturn };
  }
}
