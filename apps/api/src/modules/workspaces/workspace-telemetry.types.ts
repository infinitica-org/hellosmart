/**
 * Domain types, enums, and interfaces for Workspace Compute & AI Token Spend Telemetry.
 * Satisfies requirements: BR-23, CO-035, CO-037, AD-018, AD-025, NF-014.
 */

export type UsageStatus = 'complete' | 'partial';

export type UsageFlag =
  | 'unknown_model'
  | 'missing_pricing'
  | 'storage_not_metered'
  | 'no_end_time'
  | 'negative_duration_adjusted';

export interface ModelTokenUsage {
  model: string;
  promptTokens: bigint;
  completionTokens: bigint;
}

export interface ModelPriceEntry {
  model: string;
  inputPricePerMillionUsd: string; // e.g. "5.00" (USD decimal)
  outputPricePerMillionUsd: string; // e.g. "15.00" (USD decimal)
  inputPricePerMillionMicro: bigint; // e.g. 5_000_000_000n ($5 in micro-dollars)
  outputPricePerMillionMicro: bigint; // e.g. 15_000_000_000n ($15 in micro-dollars)
  isPlaceholder?: boolean;
}

export interface ModelSpendBreakdown {
  model: string;
  promptTokens: string; // stringified BigInt for lossless JSON
  completionTokens: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  promptCostMicroDollars: string;
  completionCostMicroDollars: string;
  totalCostMicroDollars: string;
  totalCostUsd: string; // formatted decimal e.g. "0.020000"
}

export interface WorkspaceUsageRecord {
  id: string;
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  assessmentId: string;
  candidateId: string;
  computeSeconds: bigint;
  computeMinutes: number;
  storageMb: number | null;
  promptTokens: bigint;
  completionTokens: bigint;
  totalCostUsd: string;
  breakdown: ModelSpendBreakdown[];
  pricingVersion: string;
  status: UsageStatus;
  flags: UsageFlag[];
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
}

export interface WorkspaceSessionMetadata {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  assessmentId: string;
  candidateId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface WorkspaceUsageInsertParams {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
  assessmentId: string;
  candidateId: string;
  computeSeconds: bigint;
  computeMinutes: number;
  storageMb: number | null;
  promptTokens: bigint;
  completionTokens: bigint;
  totalCostUsd: string;
  breakdown: ModelSpendBreakdown[];
  pricingVersion: string;
  status: UsageStatus;
  flags: UsageFlag[];
  startedAt: Date;
  endedAt: Date;
}

export interface UsageQueryFilter {
  orgId?: string | undefined;
  assessmentId?: string | undefined;
  candidateId?: string | undefined;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface UsageAggregateSummary {
  totalSessions: number;
  totalComputeSeconds: bigint;
  totalComputeMinutes: number;
  totalPromptTokens: bigint;
  totalCompletionTokens: bigint;
  totalCostUsd: string;
}

export interface RecordUsageResult {
  recorded: boolean;
  inserted: boolean;
  reason?: 'not_completed' | 'already_recorded' | 'workspace_not_found' | undefined;
  usage?: WorkspaceUsageRecord | undefined;
}

export interface BackfillReport {
  scanned: number;
  recorded: number;
  skipped: number;
  failed: number;
  workspaceIds: string[];
}
