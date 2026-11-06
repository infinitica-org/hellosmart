import type { WorkspaceSnapshotManifest } from '../autosave.types.js';

export interface WorkspaceSnapshotTarget {
  id: string;
  orgId: string;
  assignmentId: string;
  candidateId: string;
  status: string;
  mode: 'cloud' | 'chat';
  lastSnapshotAt: Date | null;
  lastSnapshotKey: string | null;
  snapshotSeq: number;
}

export interface RecordSnapshotParams {
  snapshotKey: string;
  sha256: string;
  timestamp: Date;
  seq: number;
  manifest: WorkspaceSnapshotManifest;
}

export interface WorkspaceRegistryPort {
  /**
   * Lists workspaces that are currently in an active, autosavable state
   * ('connected' or 'disconnected') whose last snapshot is older than cutoffDate.
   */
  findDueWorkspaces(cutoffDate: Date, limit?: number): Promise<WorkspaceSnapshotTarget[]>;

  /**
   * Retrieves the latest snapshot manifest for an active workspace.
   */
  getLastSnapshotManifest(workspaceId: string): Promise<WorkspaceSnapshotManifest | null>;

  /**
   * Advances the snapshot state for a workspace after a verified upload.
   * MUST be executed inside tenant context (withOrg).
   */
  recordSnapshot(workspaceId: string, orgId: string, params: RecordSnapshotParams): Promise<void>;

  /**
   * Retrieves an individual workspace snapshot target with tenant verification.
   */
  getWorkspaceById(workspaceId: string, orgId: string): Promise<WorkspaceSnapshotTarget | null>;
}

export const WORKSPACE_REGISTRY_PORT = Symbol('WORKSPACE_REGISTRY_PORT');
