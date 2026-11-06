import { Injectable, Logger } from '@nestjs/common';

export const WORKSPACE_METERING_PORT = Symbol('WORKSPACE_METERING_PORT');

export interface WorkspaceMeteringPort {
  /**
   * Measures storage consumption (in MB) for a candidate workspace session.
   * Returns null if no storage metering agent or snapshot metadata is available.
   */
  measureStorageMb(workspaceId: string): Promise<number | null>;
}

/**
 * Empty production adapter for WorkspaceMeteringPort.
 * Returns null because no host disk agent or cgroup volume meter exists yet in MMP.
 */
@Injectable()
export class NoOpWorkspaceMeteringAdapter implements WorkspaceMeteringPort {
  private readonly logger = new Logger(NoOpWorkspaceMeteringAdapter.name);

  async measureStorageMb(workspaceId: string): Promise<number | null> {
    this.logger.debug(
      `No storage metering agent configured for workspace ${workspaceId}; returning null storage_mb`,
    );
    return null;
  }
}

/**
 * In-memory fake adapter for unit and integration testing.
 */
export class FakeWorkspaceMeteringAdapter implements WorkspaceMeteringPort {
  private readonly storageMap = new Map<string, number | null>();

  public setStorageMb(workspaceId: string, mb: number | null): void {
    this.storageMap.set(workspaceId, mb);
  }

  public clear(): void {
    this.storageMap.clear();
  }

  async measureStorageMb(workspaceId: string): Promise<number | null> {
    if (this.storageMap.has(workspaceId)) {
      return this.storageMap.get(workspaceId)!;
    }
    return null;
  }
}
