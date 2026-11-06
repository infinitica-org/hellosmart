import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AutosavePackager } from '../autosave.packager.js';
import type { ReapCandidate } from '../workspace-reaper.types.js';
import { STORAGE_PORT } from '../../../common/storage/storage.tokens.js';
import type { StoragePort } from '../../../common/storage/storage.types.js';

export interface FinalSnapshotResult {
  snapshotKey: string;
  sha256: string;
  isPartial: boolean;
}

export interface WorkspaceSnapshotPort {
  /**
   * Ensures that a verified snapshot of the workspace exists in storage before teardown.
   * If a valid snapshot already exists, returns its metadata.
   * If not, invokes the packager to capture a final snapshot.
   * Returns null if snapshot creation/verification fails (destroy must NOT proceed).
   */
  ensureFinalSnapshot(params: {
    workspace: ReapCandidate;
    now: Date;
  }): Promise<FinalSnapshotResult | null>;
}

export const WORKSPACE_SNAPSHOT_PORT = Symbol('WORKSPACE_SNAPSHOT_PORT');

@Injectable()
export class AutosaveSnapshotAdapter implements WorkspaceSnapshotPort {
  private readonly logger = new Logger(AutosaveSnapshotAdapter.name);

  constructor(
    @Optional() private readonly packager?: AutosavePackager,
    @Optional() @Inject(STORAGE_PORT) private readonly storage?: StoragePort,
  ) {}

  async ensureFinalSnapshot(params: {
    workspace: ReapCandidate;
    now: Date;
  }): Promise<FinalSnapshotResult | null> {
    const { workspace } = params;

    // 1. If 9.2 submission bundle exists on assignment, that is the primary verified artifact
    if (workspace.artifactsRef) {
      return {
        snapshotKey: workspace.artifactsRef,
        sha256: 'bundle-verified',
        isPartial: false,
      };
    }

    // 2. If a snapshot_ref is already recorded on the workspace, verify presence in storage
    if (workspace.snapshotRef) {
      if (this.storage) {
        try {
          const res = await this.storage.getStream(workspace.snapshotRef);
          if (res) {
            return {
              snapshotKey: workspace.snapshotRef,
              sha256: 'snapshot-ref-verified',
              isPartial: false,
            };
          }
        } catch {
          this.logger.warn(
            `Snapshot ${workspace.snapshotRef} missing from storage; re-capturing final snapshot`,
          );
        }
      } else {
        return {
          snapshotKey: workspace.snapshotRef,
          sha256: 'snapshot-ref-recorded',
          isPartial: false,
        };
      }
    }

    // 3. Capture a final snapshot via 9.1 AutosavePackager if available
    if (this.packager) {
      try {
        const packagerResult = await this.packager.snapshotWorkspace({
          id: workspace.workspaceId,
          orgId: workspace.orgId,
          assignmentId: workspace.assignmentId,
          candidateId: workspace.candidateId,
          mode: 'cloud',
          status: workspace.workspaceStatus,
          lastSnapshotAt: workspace.lastActivityAt,
          lastSnapshotKey: workspace.snapshotRef,
          snapshotSeq: 1,
        });

        if (packagerResult && packagerResult.snapshotKey) {
          return {
            snapshotKey: packagerResult.snapshotKey,
            sha256: packagerResult.sha256,
            isPartial: packagerResult.partial ?? false,
          };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Final snapshot creation failed for workspace ${workspace.workspaceId}: ${message}`,
        );
        return null;
      }
    }

    this.logger.warn(
      `No snapshot packager available and no verified snapshot exists for workspace ${workspace.workspaceId}; aborting teardown`,
    );
    return null;
  }
}

export class FakeWorkspaceSnapshotAdapter implements WorkspaceSnapshotPort {
  public failNext = false;
  public nextIsPartial = false;
  public capturedWorkspaces: string[] = [];

  async ensureFinalSnapshot(params: {
    workspace: ReapCandidate;
    now: Date;
  }): Promise<FinalSnapshotResult | null> {
    if (this.failNext) {
      return null;
    }

    const { workspace } = params;
    this.capturedWorkspaces.push(workspace.workspaceId);

    if (workspace.artifactsRef) {
      return {
        snapshotKey: workspace.artifactsRef,
        sha256: 'fake-bundle-sha256',
        isPartial: this.nextIsPartial,
      };
    }

    const key =
      workspace.snapshotRef ??
      `snapshots/${workspace.orgId}/${workspace.assignmentId}/final_snapshot.tar.gz`;
    return {
      snapshotKey: key,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      isPartial: this.nextIsPartial,
    };
  }
}
