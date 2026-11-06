/**
 * Type definitions for the 9.2 Submission Artifact Bundler & Deliverable Tarball Archive Pipeline.
 * Requirement IDs: BR-11, BR-18, Migration 0014 (trg_immutable_submission), BR-22, CA-018, CO-041, CO-042, T-020, T-023.
 */

export type PatchStatus = 'complete' | 'truncated' | 'unavailable';

export interface SubmissionFileManifestEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
  mode: number;
  isBinary: boolean;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface SubmissionBundleManifest {
  manifestVersion: string; // '1.0.0'
  bundleKind: 'final_submission';
  createdAt: string; // ISO 8601 UTC
  orgId: string;
  assignmentId: string;
  workspaceId: string;
  templateRef: string;
  patchStatus: PatchStatus;
  patchSha256: string;
  patchSizeBytes: number;
  patchFilesChanged: number;
  terminalHistorySizeBytes: number;
  terminalHistorySha256?: string | undefined;
  filesCount: number;
  totalSourceSizeBytes: number;
  files: SubmissionFileManifestEntry[];
  isPartial: boolean;
  partialReasons: string[];
  skippedEntries: Array<{ path: string; reason: string }>;
  notice: string;
  t020RefMapping: {
    term: string;
    diff: string;
    file: string;
    ai: string;
    event?: string;
    test?: string;
  };
}

export interface SubmissionBundleResult {
  artifactsRef: string;
  sha256: string;
  totalBytes: number;
  manifest: SubmissionBundleManifest;
  isExisting: boolean;
}

export interface SubmissionContext {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  candidateId: string;
  templateVersionId: string | null;
  templateRef: string;
  assignmentStatus: string;
  artifactsRef: string | null;
}

export interface UnbundledAssignment {
  assignmentId: string;
  workspaceId: string;
  orgId: string;
  candidateId: string;
  submittedAt: Date;
}
