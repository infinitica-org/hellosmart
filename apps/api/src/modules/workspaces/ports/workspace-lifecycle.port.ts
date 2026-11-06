import { Injectable, Logger } from '@nestjs/common';

export interface WorkspaceLifecyclePort {
  /**
   * Invalidates local workspace caches (e.g. editor state, cached files) on the workspace host.
   */
  invalidateWorkspaceCache(orgId: string, workspaceId: string): Promise<void>;

  /**
   * Signals the workspace orchestrator that the container is ready for graceful termination/reaping.
   * Note: This does NOT modify workspace DB status; status was already set to 'ended' upon submit.
   */
  signalReadyForTermination(orgId: string, workspaceId: string): Promise<void>;
}

export const WORKSPACE_LIFECYCLE_PORT = Symbol('WORKSPACE_LIFECYCLE_PORT');

@Injectable()
export class EmptyWorkspaceLifecycleAdapter implements WorkspaceLifecyclePort {
  private readonly logger = new Logger(EmptyWorkspaceLifecycleAdapter.name);

  async invalidateWorkspaceCache(orgId: string, workspaceId: string): Promise<void> {
    this.logger.log(`[WorkspaceLifecycle] Cache invalidated for org=${orgId} ws=${workspaceId}`);
  }

  async signalReadyForTermination(orgId: string, workspaceId: string): Promise<void> {
    this.logger.log(
      `[WorkspaceLifecycle] Container marked ready for termination for org=${orgId} ws=${workspaceId}`,
    );
  }
}

export class FakeWorkspaceLifecycleAdapter implements WorkspaceLifecyclePort {
  public invalidatedWorkspaces: string[] = [];
  public terminatedWorkspaces: string[] = [];

  async invalidateWorkspaceCache(orgId: string, workspaceId: string): Promise<void> {
    this.invalidatedWorkspaces.push(`${orgId}/${workspaceId}`);
  }

  async signalReadyForTermination(orgId: string, workspaceId: string): Promise<void> {
    this.terminatedWorkspaces.push(`${orgId}/${workspaceId}`);
  }
}
