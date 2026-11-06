import { Injectable, Logger } from '@nestjs/common';

export interface WorkspaceHeartbeatPort {
  /**
   * Retrieves the timestamp of the last active WebSocket heartbeat for a workspace.
   * Returns null if no heartbeat data is known/available.
   */
  getLastHeartbeat(orgId: string, workspaceId: string): Promise<Date | null>;
}

export const WORKSPACE_HEARTBEAT_PORT = Symbol('WORKSPACE_HEARTBEAT_PORT');

/**
 * Production fail-closed heartbeat adapter.
 * Since ws-gateway and ws-agent (T-022, T-023) do not yet exist, returns null.
 * Under the reaper's safety rules, unknown heartbeat causes connected sessions to fail-closed (never reaped).
 */
@Injectable()
export class FailClosedHeartbeatAdapter implements WorkspaceHeartbeatPort {
  private readonly logger = new Logger(FailClosedHeartbeatAdapter.name);

  async getLastHeartbeat(orgId: string, workspaceId: string): Promise<Date | null> {
    this.logger.debug(
      `Heartbeat lookup for org=${orgId} ws=${workspaceId}: signal not yet available (fail-closed)`,
    );
    return null;
  }
}

export class FakeWorkspaceHeartbeatAdapter implements WorkspaceHeartbeatPort {
  private readonly heartbeats = new Map<string, Date>();

  setHeartbeat(workspaceId: string, timestamp: Date): void {
    this.heartbeats.set(workspaceId, timestamp);
  }

  clearHeartbeat(workspaceId: string): void {
    this.heartbeats.delete(workspaceId);
  }

  async getLastHeartbeat(_orgId: string, workspaceId: string): Promise<Date | null> {
    return this.heartbeats.get(workspaceId) ?? null;
  }
}
