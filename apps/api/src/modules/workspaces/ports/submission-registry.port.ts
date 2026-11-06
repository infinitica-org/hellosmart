import type { SubmissionContext, UnbundledAssignment } from '../submission-bundler.types.js';

export interface SubmissionRegistryPort {
  /**
   * Retrieves workspace and assignment context for a submission run.
   */
  getWorkspaceSubmissionContext(workspaceId: string): Promise<SubmissionContext | null>;

  /**
   * Sets app.assignments.artifacts_ref exactly once after a verified upload.
   */
  recordArtifactsRef(orgId: string, assignmentId: string, artifactsRef: string): Promise<void>;

  /**
   * Lists assignments in 'submitted' status whose artifacts_ref is still NULL.
   * Scans across tenants using platform credentials for offline reconciliation.
   */
  listUnbundledSubmissions(limit: number): Promise<UnbundledAssignment[]>;
}

export const SUBMISSION_REGISTRY_PORT = Symbol('SUBMISSION_REGISTRY_PORT');
