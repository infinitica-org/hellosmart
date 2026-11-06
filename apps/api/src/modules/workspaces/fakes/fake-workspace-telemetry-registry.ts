import type { WorkspaceTelemetryRegistryPort } from '../ports/workspace-telemetry-registry.port.js';
import type {
  UsageAggregateSummary,
  UsageQueryFilter,
  WorkspaceSessionMetadata,
  WorkspaceUsageInsertParams,
  WorkspaceUsageRecord,
} from '../workspace-telemetry.types.js';

export class FakeWorkspaceTelemetryRegistry implements WorkspaceTelemetryRegistryPort {
  public sessions = new Map<string, WorkspaceSessionMetadata>();
  public usageMap = new Map<string, WorkspaceUsageRecord>();

  public setSession(session: WorkspaceSessionMetadata): void {
    this.sessions.set(session.workspaceId, { ...session });
  }

  public clear(): void {
    this.sessions.clear();
    this.usageMap.clear();
  }

  async getWorkspaceSession(workspaceId: string): Promise<WorkspaceSessionMetadata | null> {
    const s = this.sessions.get(workspaceId);
    return s ? { ...s } : null;
  }

  async insertUsage(usage: WorkspaceUsageInsertParams): Promise<boolean> {
    if (this.usageMap.has(usage.workspaceId)) {
      return false; // Idempotent: already exists
    }
    const record: WorkspaceUsageRecord = {
      id: `usage-${usage.workspaceId}`,
      workspaceId: usage.workspaceId,
      orgId: usage.orgId,
      assignmentId: usage.assignmentId,
      assessmentId: usage.assessmentId,
      candidateId: usage.candidateId,
      computeSeconds: usage.computeSeconds,
      computeMinutes: usage.computeMinutes,
      storageMb: usage.storageMb,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalCostUsd: usage.totalCostUsd,
      breakdown: [...usage.breakdown],
      pricingVersion: usage.pricingVersion,
      status: usage.status,
      flags: [...usage.flags],
      startedAt: usage.startedAt,
      endedAt: usage.endedAt,
      createdAt: new Date(),
    };
    this.usageMap.set(usage.workspaceId, record);
    return true;
  }

  async getUsageByWorkspace(workspaceId: string): Promise<WorkspaceUsageRecord | null> {
    const u = this.usageMap.get(workspaceId);
    return u ? { ...u } : null;
  }

  async listUsage(
    filter: UsageQueryFilter,
  ): Promise<{ items: WorkspaceUsageRecord[]; total: number }> {
    let items = Array.from(this.usageMap.values());
    if (filter.orgId) {
      items = items.filter((i) => i.orgId === filter.orgId);
    }
    if (filter.assessmentId) {
      items = items.filter((i) => i.assessmentId === filter.assessmentId);
    }
    if (filter.candidateId) {
      items = items.filter((i) => i.candidateId === filter.candidateId);
    }
    if (filter.fromDate) {
      items = items.filter((i) => i.startedAt >= filter.fromDate!);
    }
    if (filter.toDate) {
      items = items.filter((i) => i.endedAt <= filter.toDate!);
    }
    const total = items.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return {
      items: items.slice(offset, offset + limit),
      total,
    };
  }

  async getSpendTotals(filter: UsageQueryFilter): Promise<UsageAggregateSummary> {
    const { items } = await this.listUsage(filter);
    let totalComputeSeconds = 0n;
    let totalComputeMinutes = 0;
    let totalPromptTokens = 0n;
    let totalCompletionTokens = 0n;
    let totalCostMicroDollars = 0n;

    for (const item of items) {
      totalComputeSeconds += item.computeSeconds;
      totalComputeMinutes += item.computeMinutes;
      totalPromptTokens += item.promptTokens;
      totalCompletionTokens += item.completionTokens;
      for (const b of item.breakdown) {
        totalCostMicroDollars += BigInt(b.totalCostMicroDollars);
      }
    }

    const dollars = totalCostMicroDollars / 1_000_000n;
    const frac = (totalCostMicroDollars % 1_000_000n).toString().padStart(6, '0');
    const totalCostUsd = `${dollars.toString()}.${frac}`;

    return {
      totalSessions: items.length,
      totalComputeSeconds,
      totalComputeMinutes,
      totalPromptTokens,
      totalCompletionTokens,
      totalCostUsd,
    };
  }

  async listCompletedWithoutUsage(limit: number): Promise<string[]> {
    const unrecorded: string[] = [];
    for (const session of this.sessions.values()) {
      if (
        (session.status === 'ended' || session.status === 'destroyed') &&
        session.endedAt !== null &&
        !this.usageMap.has(session.workspaceId)
      ) {
        unrecorded.push(session.workspaceId);
        if (unrecorded.length >= limit) {
          break;
        }
      }
    }
    return unrecorded;
  }
}
