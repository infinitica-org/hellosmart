import type { WorkspaceSnapshotManifest } from '../autosave.types.js';
import type {
  RecordSnapshotParams,
  WorkspaceRegistryPort,
  WorkspaceSnapshotTarget,
} from '../ports/workspace-registry.port.js';

export class FakeWorkspaceRegistry implements WorkspaceRegistryPort {
  private readonly workspaces = new Map<string, WorkspaceSnapshotTarget>();
  private readonly manifests = new Map<string, WorkspaceSnapshotManifest>();
  public recordCallCount = 0;
  public lastRecordedParams: RecordSnapshotParams | null = null;

  registerWorkspace(target: WorkspaceSnapshotTarget): void {
    this.workspaces.set(target.id, { ...target });
  }

  setManifest(workspaceId: string, manifest: WorkspaceSnapshotManifest): void {
    this.manifests.set(workspaceId, { ...manifest });
  }

  async findDueWorkspaces(cutoffDate: Date, limit = 50): Promise<WorkspaceSnapshotTarget[]> {
    const due: WorkspaceSnapshotTarget[] = [];
    for (const ws of this.workspaces.values()) {
      if (ws.status !== 'connected' && ws.status !== 'disconnected') {
        continue;
      }
      if (!ws.lastSnapshotAt || ws.lastSnapshotAt.getTime() <= cutoffDate.getTime()) {
        due.push({ ...ws });
        if (due.length >= limit) break;
      }
    }
    return due;
  }

  async getLastSnapshotManifest(workspaceId: string): Promise<WorkspaceSnapshotManifest | null> {
    const m = this.manifests.get(workspaceId);
    return m ? { ...m } : null;
  }

  async recordSnapshot(
    workspaceId: string,
    orgId: string,
    params: RecordSnapshotParams,
  ): Promise<void> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws || ws.orgId !== orgId) {
      throw new Error(`Workspace ${workspaceId} not found for org ${orgId}`);
    }

    this.recordCallCount++;
    this.lastRecordedParams = params;

    ws.lastSnapshotAt = params.timestamp;
    ws.lastSnapshotKey = params.snapshotKey;
    ws.snapshotSeq = params.seq;
    this.manifests.set(workspaceId, params.manifest);
  }

  async getWorkspaceById(
    workspaceId: string,
    orgId: string,
  ): Promise<WorkspaceSnapshotTarget | null> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws || ws.orgId !== orgId) {
      return null;
    }
    return { ...ws };
  }
}
