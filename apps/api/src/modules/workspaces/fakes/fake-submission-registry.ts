import type { SubmissionRegistryPort } from '../ports/submission-registry.port.js';
import type { SubmissionContext, UnbundledAssignment } from '../submission-bundler.types.js';

export class FakeSubmissionRegistryAdapter implements SubmissionRegistryPort {
  private workspaces = new Map<string, SubmissionContext>();
  private unbundled: UnbundledAssignment[] = [];
  public updateCount = 0;

  setWorkspaceContext(context: SubmissionContext): void {
    this.workspaces.set(context.workspaceId, { ...context });
  }

  setUnbundledSubmissions(items: UnbundledAssignment[]): void {
    this.unbundled = [...items];
  }

  async getWorkspaceSubmissionContext(workspaceId: string): Promise<SubmissionContext | null> {
    const ctx = this.workspaces.get(workspaceId);
    return ctx ? { ...ctx } : null;
  }

  async recordArtifactsRef(
    orgId: string,
    assignmentId: string,
    artifactsRef: string,
  ): Promise<void> {
    this.updateCount++;
    for (const ctx of this.workspaces.values()) {
      if (ctx.orgId === orgId && ctx.assignmentId === assignmentId) {
        if (ctx.artifactsRef && ctx.artifactsRef !== artifactsRef) {
          throw new Error(`Cannot overwrite existing artifacts_ref '${ctx.artifactsRef}'`);
        }
        ctx.artifactsRef = artifactsRef;
      }
    }
    this.unbundled = this.unbundled.filter((u) => u.assignmentId !== assignmentId);
  }

  async listUnbundledSubmissions(limit: number): Promise<UnbundledAssignment[]> {
    return this.unbundled.slice(0, limit);
  }
}
