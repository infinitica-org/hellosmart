import type { WorkspaceReaperRegistryPort } from '../ports/workspace-reaper-registry.port.js';
import type { ClaimedWorkspace, ReapCandidate } from '../workspace-reaper.types.js';

export class FakeWorkspaceReaperRegistry implements WorkspaceReaperRegistryPort {
  public candidates: ReapCandidate[] = [];
  public activeWorkspacesCount = 10;
  public claimsMade: string[] = [];
  public destroyedWorkspaces: Array<{ workspaceId: string; snapshotRef: string; endedAt: Date }> =
    [];
  public releasedClaims: string[] = [];
  public failNextClaim = false;

  async findReapCandidates(_options: {
    now: Date;
    disconnectedCutoff: Date;
    idleCutoff: Date;
    idleEnabled: boolean;
    limit: number;
  }): Promise<ReapCandidate[]> {
    return [...this.candidates];
  }

  async countActiveWorkspaces(): Promise<number> {
    return this.activeWorkspacesCount;
  }

  async claimWorkspace(params: {
    workspaceId: string;
    orgId: string;
    expectedStatus: string;
    expectedLastActivityAt: Date;
    now: Date;
  }): Promise<ClaimedWorkspace | null> {
    if (this.failNextClaim) {
      return null;
    }

    const candidate = this.candidates.find((c) => c.workspaceId === params.workspaceId);
    if (!candidate) {
      return null;
    }

    // Compare-and-set verification
    if (
      candidate.workspaceStatus !== params.expectedStatus ||
      candidate.lastActivityAt.getTime() !== params.expectedLastActivityAt.getTime()
    ) {
      return null;
    }

    candidate.workspaceStatus = 'ended';
    candidate.endedAt = params.now;
    this.claimsMade.push(params.workspaceId);

    return {
      workspaceId: candidate.workspaceId,
      orgId: candidate.orgId,
      assignmentId: candidate.assignmentId,
      candidateId: candidate.candidateId,
      status: 'ended',
      endedAt: params.now,
      snapshotRef: candidate.snapshotRef,
      runtimeRef: candidate.runtimeRef,
    };
  }

  async markDestroyed(params: {
    workspaceId: string;
    orgId: string;
    snapshotRef: string;
    endedAt: Date;
  }): Promise<void> {
    const candidate = this.candidates.find((c) => c.workspaceId === params.workspaceId);
    if (candidate) {
      candidate.workspaceStatus = 'destroyed';
      candidate.snapshotRef = params.snapshotRef;
      candidate.endedAt = params.endedAt;
    }
    this.destroyedWorkspaces.push({
      workspaceId: params.workspaceId,
      snapshotRef: params.snapshotRef,
      endedAt: params.endedAt,
    });
  }

  async releaseClaim(params: {
    workspaceId: string;
    orgId: string;
    originalStatus: string;
    originalEndedAt: Date | null;
  }): Promise<void> {
    const candidate = this.candidates.find((c) => c.workspaceId === params.workspaceId);
    if (candidate) {
      candidate.workspaceStatus = params.originalStatus;
      candidate.endedAt = params.originalEndedAt;
    }
    this.releasedClaims.push(params.workspaceId);
  }
}
