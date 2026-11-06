import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CURRENT_PRICING_VERSION,
  calculateModelBreakdown,
  formatMicroDollarsToUsd,
} from './pricing/model-pricing.config.js';
import { TOKEN_USAGE_PORT, type TokenUsagePort } from './ports/token-usage.port.js';
import {
  WORKSPACE_METERING_PORT,
  type WorkspaceMeteringPort,
} from './ports/workspace-metering.port.js';
import {
  WORKSPACE_TELEMETRY_REGISTRY_PORT,
  type WorkspaceTelemetryRegistryPort,
} from './ports/workspace-telemetry-registry.port.js';
import type {
  BackfillReport,
  ModelSpendBreakdown,
  RecordUsageResult,
  UsageAggregateSummary,
  UsageFlag,
  UsageQueryFilter,
  UsageStatus,
  WorkspaceUsageRecord,
} from './workspace-telemetry.types.js';

@Injectable()
export class WorkspaceTelemetryService {
  private readonly logger = new Logger(WorkspaceTelemetryService.name);

  constructor(
    @Inject(WORKSPACE_TELEMETRY_REGISTRY_PORT)
    private readonly registry: WorkspaceTelemetryRegistryPort,
    @Inject(TOKEN_USAGE_PORT)
    private readonly tokenUsage: TokenUsagePort,
    @Inject(WORKSPACE_METERING_PORT)
    private readonly metering: WorkspaceMeteringPort,
  ) {}

  /**
   * Finalizes compute and AI token spend aggregation for a completed workspace session.
   * Strictly idempotent: uses ON CONFLICT (workspace_id) DO NOTHING; first completed call wins.
   *
   * Billable window requirement:
   * Only records when status is in ('ended', 'destroyed') AND ended_at is populated.
   */
  async recordSessionUsage(workspaceId: string): Promise<RecordUsageResult> {
    const session = await this.registry.getWorkspaceSession(workspaceId);
    if (!session) {
      this.logger.warn(
        `Workspace ${workspaceId} not found when attempting to record usage telemetry`,
      );
      return { recorded: false, inserted: false, reason: 'workspace_not_found' };
    }

    if ((session.status !== 'ended' && session.status !== 'destroyed') || !session.endedAt) {
      this.logger.debug(
        `Workspace ${workspaceId} has status '${session.status}' with endedAt=${session.endedAt}; not eligible for usage finalization`,
      );
      return { recorded: false, inserted: false, reason: 'not_completed' };
    }

    // Compute billable duration in exact seconds and derived minutes
    const startedMs = session.startedAt.getTime();
    const endedMs = session.endedAt.getTime();
    const rawElapsedMs = endedMs - startedMs;

    const flags: UsageFlag[] = [];
    let computeSeconds = 0n;

    if (rawElapsedMs < 0) {
      flags.push('negative_duration_adjusted');
      this.logger.warn(
        `Workspace ${workspaceId} has negative duration (started=${session.startedAt.toISOString()}, ended=${session.endedAt.toISOString()}); clamped to 0s`,
      );
      computeSeconds = 0n;
    } else {
      computeSeconds = BigInt(Math.floor(rawElapsedMs / 1000));
    }

    // Derive integer minutes (round half up; 0 seconds = 0 minutes; not min-1)
    const computeMinutes = Math.round(Number(computeSeconds) / 60);

    // Collect token usage from AI proxy
    const modelUsages = await this.tokenUsage.getTokenUsageByWorkspace(workspaceId);

    // Collect storage usage
    const storageMb = await this.metering.measureStorageMb(workspaceId);
    if (storageMb === null) {
      flags.push('storage_not_metered');
    }

    let promptTokensSum = 0n;
    let completionTokensSum = 0n;
    let totalMicroDollarsSum = 0n;
    const breakdown: ModelSpendBreakdown[] = [];
    let hasUnknownModel = false;

    for (const usage of modelUsages) {
      const { breakdown: itemBreakdown, isUnknown } = calculateModelBreakdown(
        usage.model,
        usage.promptTokens,
        usage.completionTokens,
      );
      breakdown.push(itemBreakdown);
      promptTokensSum += usage.promptTokens;
      completionTokensSum += usage.completionTokens;
      totalMicroDollarsSum += BigInt(itemBreakdown.totalCostMicroDollars);

      if (isUnknown) {
        hasUnknownModel = true;
      }
    }

    if (hasUnknownModel) {
      flags.push('unknown_model');
    }

    const totalCostUsd = formatMicroDollarsToUsd(totalMicroDollarsSum);
    const status: UsageStatus = hasUnknownModel ? 'partial' : 'complete';

    const inserted = await this.registry.insertUsage({
      workspaceId: session.workspaceId,
      orgId: session.orgId,
      assignmentId: session.assignmentId,
      assessmentId: session.assessmentId,
      candidateId: session.candidateId,
      computeSeconds,
      computeMinutes,
      storageMb,
      promptTokens: promptTokensSum,
      completionTokens: completionTokensSum,
      totalCostUsd,
      breakdown,
      pricingVersion: CURRENT_PRICING_VERSION,
      status,
      flags,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    });

    const usageRecord = await this.registry.getUsageByWorkspace(workspaceId);

    if (inserted) {
      this.logger.log(
        `Recorded usage for workspace ${workspaceId}: duration=${computeMinutes}m, tokensIn=${promptTokensSum}, tokensOut=${completionTokensSum}, cost=$${totalCostUsd}`,
      );
    } else {
      this.logger.debug(`Usage record already exists for workspace ${workspaceId}; no-op`);
    }

    return {
      recorded: true,
      inserted,
      usage: usageRecord ?? undefined,
      reason: inserted ? undefined : 'already_recorded',
    };
  }

  /**
   * Identifies completed sessions that lack usage records.
   */
  async listCompletedWithoutUsage(limit: number): Promise<string[]> {
    return this.registry.listCompletedWithoutUsage(limit);
  }

  /**
   * Pure injectable retry/backfill function.
   * Scans completed sessions without usage records and aggregates telemetry.
   */
  async backfillCompletedSessions(limit = 100): Promise<BackfillReport> {
    const workspaceIds = await this.listCompletedWithoutUsage(limit);
    let recorded = 0;
    let skipped = 0;
    let failed = 0;

    for (const id of workspaceIds) {
      try {
        const res = await this.recordSessionUsage(id);
        if (res.recorded && res.inserted) {
          recorded++;
        } else {
          skipped++;
        }
      } catch (err: unknown) {
        failed++;
        this.logger.error(`Failed to backfill usage telemetry for workspace ${id}:`, err);
      }
    }

    return {
      scanned: workspaceIds.length,
      recorded,
      skipped,
      failed,
      workspaceIds,
    };
  }

  // --- Read-Side Service Queries (CO-037, AD-018, AD-025) ---

  async getUsageByWorkspace(workspaceId: string): Promise<WorkspaceUsageRecord | null> {
    return this.registry.getUsageByWorkspace(workspaceId);
  }

  async getUsageByOrganization(
    orgId: string,
    filter: Omit<UsageQueryFilter, 'orgId'> = {},
  ): Promise<{ items: WorkspaceUsageRecord[]; total: number }> {
    return this.registry.listUsage({ ...filter, orgId });
  }

  async getUsageByAssessment(
    orgId: string,
    assessmentId: string,
    filter: Omit<UsageQueryFilter, 'orgId' | 'assessmentId'> = {},
  ): Promise<{ items: WorkspaceUsageRecord[]; total: number }> {
    return this.registry.listUsage({ ...filter, orgId, assessmentId });
  }

  async getUsageByCandidate(
    orgId: string,
    candidateId: string,
    filter: Omit<UsageQueryFilter, 'orgId' | 'candidateId'> = {},
  ): Promise<{ items: WorkspaceUsageRecord[]; total: number }> {
    return this.registry.listUsage({ ...filter, orgId, candidateId });
  }

  async getSpendTotals(filter: UsageQueryFilter = {}): Promise<UsageAggregateSummary> {
    return this.registry.getSpendTotals(filter);
  }
}
