export interface CandidateArtifactLocatorPort {
  /**
   * Locates storage keys for artifacts associated with a candidate.
   * In MMP prior to Sprint 4, candidate submission/assignment tables do not exist
   * and candidate file uploads are not permitted; thus candidates possess 0 artifacts.
   */
  findArtifactKeys(orgId: string, candidateUserId: string): Promise<string[]>;
}

export const CANDIDATE_ARTIFACT_LOCATOR_PORT = Symbol('CANDIDATE_ARTIFACT_LOCATOR_PORT');

export class EmptyCandidateArtifactLocator implements CandidateArtifactLocatorPort {
  async findArtifactKeys(_orgId: string, _candidateUserId: string): Promise<string[]> {
    return [];
  }
}

export class FakeCandidateArtifactLocator implements CandidateArtifactLocatorPort {
  private candidateKeys = new Map<string, string[]>();

  setCandidateKeys(candidateUserId: string, keys: string[]): void {
    this.candidateKeys.set(candidateUserId, keys);
  }

  async findArtifactKeys(_orgId: string, candidateUserId: string): Promise<string[]> {
    return this.candidateKeys.get(candidateUserId) ?? [];
  }
}
