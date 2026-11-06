export interface ManifestFileEntry {
  path: string;
  size: number;
  sha256: string;
  mtime: string;
}

export interface ManifestSkippedEntry {
  path: string;
  reason: string;
}

export interface WorkspaceSnapshotManifest {
  version: '1.0';
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  seq: number;
  isFull: boolean;
  baseSnapshotKey: string | null;
  timestamp: string; // ISO 8601 UTC
  files: ManifestFileEntry[];
  deleted: string[];
  skipped: ManifestSkippedEntry[];
  partial: boolean;
  partialReasons: string[];
  terminalOffset: number;
  terminalBytes: number;
  config: Record<string, unknown>;
}

export interface AutosavePackagerConfig {
  fullSnapshotInterval: number;
  maxFileSize: number;
  maxTotalSize: number;
  maxFileCount: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  excludedPatterns: string[];
}

export const DEFAULT_AUTOSAVE_CONFIG: AutosavePackagerConfig = {
  fullSnapshotInterval: 10,
  maxFileSize: 50 * 1024 * 1024, // 50 MB
  maxTotalSize: 100 * 1024 * 1024, // 100 MB
  maxFileCount: 5000,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  excludedPatterns: ['node_modules/**', '.git/**', '.cache/**', 'dist/**'],
};

export interface SnapshotResult {
  snapshotKey: string;
  sha256: string;
  size: number;
  seq: number;
  isFull: boolean;
  partial: boolean;
  durationMs: number;
  timestamp: Date;
  fileCount: number;
}

/**
 * Calculates RPO lag in seconds from the last verified snapshot.
 * Returns -1 if no snapshot has been verified yet.
 */
export function calculateRpoLagSeconds(now: Date, lastSnapshotAt: Date | null): number {
  if (!lastSnapshotAt) {
    return -1;
  }
  const diffMs = now.getTime() - lastSnapshotAt.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}
