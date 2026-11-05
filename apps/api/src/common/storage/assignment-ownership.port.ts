export interface AssignmentValidationResult {
  valid: boolean;
  reason?: string;
  assignment?: {
    id: string;
    orgId: string;
    candidateId: string;
    status: 'in_progress' | 'submitted' | 'expired';
    deadlineAt: Date;
  };
}

export interface ArtifactRecord {
  objectId: string;
  key: string;
  orgId: string;
  assignmentId: string;
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface AssignmentOwnershipPort {
  /**
   * Verifies that the candidate owns the assignment, belongs to the organization,
   * is 'in_progress', and the deadline has not expired.
   */
  validateCandidateAssignment(
    candidateId: string,
    orgId: string,
    assignmentId: string,
  ): Promise<AssignmentValidationResult>;

  verifyCandidateAssignmentOwnership(
    candidateId: string,
    orgId: string,
    assignmentId: string,
  ): Promise<boolean>;

  /**
   * Resolves artifact metadata by object ID for download URL construction.
   */
  resolveArtifact(objectId: string): Promise<ArtifactRecord | null>;

  /**
   * Registers an uploaded artifact.
   */
  registerArtifact(artifact: ArtifactRecord): Promise<void>;
}

/**
 * In-memory test fake for AssignmentOwnershipPort.
 */
export class FakeAssignmentOwnershipAdapter implements AssignmentOwnershipPort {
  private readonly assignments = new Map<
    string,
    {
      id: string;
      orgId: string;
      candidateId: string;
      status: 'in_progress' | 'submitted' | 'expired';
      deadlineAt: Date;
    }
  >();

  private readonly artifacts = new Map<string, ArtifactRecord>();

  public setAssignment(assignment: {
    id: string;
    orgId: string;
    candidateId: string;
    status?: 'in_progress' | 'submitted' | 'expired';
    deadlineAt?: Date;
  }): void {
    this.assignments.set(assignment.id, {
      id: assignment.id,
      orgId: assignment.orgId,
      candidateId: assignment.candidateId,
      status: assignment.status ?? 'in_progress',
      deadlineAt: assignment.deadlineAt ?? new Date(Date.now() + 3600_000),
    });
  }

  public clear(): void {
    this.assignments.clear();
    this.artifacts.clear();
  }

  async validateCandidateAssignment(
    candidateId: string,
    orgId: string,
    assignmentId: string,
  ): Promise<AssignmentValidationResult> {
    const record = this.assignments.get(assignmentId);
    if (!record) {
      return { valid: false, reason: 'Assignment not found' };
    }
    if (record.orgId !== orgId) {
      return { valid: false, reason: 'Assignment belongs to a different organization' };
    }
    if (record.candidateId !== candidateId) {
      return { valid: false, reason: 'Candidate is not assigned to this workspace' };
    }
    if (record.status !== 'in_progress') {
      return { valid: false, reason: `Assignment is not in progress (status: ${record.status})` };
    }
    if (record.deadlineAt.getTime() < Date.now()) {
      return { valid: false, reason: 'Assignment deadline has passed' };
    }

    return { valid: true, assignment: record };
  }

  async verifyCandidateAssignmentOwnership(
    candidateId: string,
    orgId: string,
    assignmentId: string,
  ): Promise<boolean> {
    const res = await this.validateCandidateAssignment(candidateId, orgId, assignmentId);
    return res.valid;
  }

  public grantOwnership(candidateId: string, orgId: string, assignmentId: string): void {
    this.setAssignment({
      id: assignmentId,
      candidateId,
      orgId,
      status: 'in_progress',
    });
  }

  public revokeOwnership(_candidateId: string, _orgId: string, assignmentId: string): void {
    this.assignments.delete(assignmentId);
  }

  async resolveArtifact(objectId: string): Promise<ArtifactRecord | null> {
    return this.artifacts.get(objectId) ?? null;
  }

  async registerArtifact(artifact: ArtifactRecord): Promise<void> {
    this.artifacts.set(artifact.objectId, artifact);
  }
}

/**
 * Production provider: fails closed until app.assignments is implemented in Stream 2.
 */
export class FailClosedAssignmentOwnershipAdapter implements AssignmentOwnershipPort {
  async validateCandidateAssignment(
    _candidateId: string,
    _orgId: string,
    _assignmentId: string,
  ): Promise<AssignmentValidationResult> {
    return {
      valid: false,
      reason:
        'Assignment validation unavailable: app.assignments table pending Stream 2 deployment.',
    };
  }

  async verifyCandidateAssignmentOwnership(
    _candidateId: string,
    _orgId: string,
    _assignmentId: string,
  ): Promise<boolean> {
    return false;
  }

  async resolveArtifact(_objectId: string): Promise<ArtifactRecord | null> {
    return null;
  }

  async registerArtifact(_artifact: ArtifactRecord): Promise<void> {
    // No-op until app.submission_artifacts exists
  }
}
