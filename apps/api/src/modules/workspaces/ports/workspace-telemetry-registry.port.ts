import type {
  UsageAggregateSummary,
  UsageQueryFilter,
  WorkspaceSessionMetadata,
  WorkspaceUsageInsertParams,
  WorkspaceUsageRecord,
} from '../workspace-telemetry.types.js';

export const WORKSPACE_TELEMETRY_REGISTRY_PORT = Symbol('WORKSPACE_TELEMETRY_REGISTRY_PORT');

export interface WorkspaceTelemetryRegistryPort {
  /**
   * Resolves session metadata (status, started_at, ended_at, org_id, assignment_id, assessment_id, candidate_id)
   * for a given workspace ID.
   */
  getWorkspaceSession(workspaceId: string): Promise<WorkspaceSessionMetadata | null>;

  /**
   * Idempotently inserts a finalized workspace usage record into app.workspace_usage.
   * Uses ON CONFLICT (workspace_id) DO NOTHING.
   * Returns true if a new row was inserted, or false if already recorded.
   */
  insertUsage(usage: WorkspaceUsageInsertParams): Promise<boolean>;

  /**
   * Retrieves the telemetry record for a specific workspace.
   */
  getUsageByWorkspace(workspaceId: string): Promise<WorkspaceUsageRecord | null>;

  /**
   * Lists usage records filtered by org, assessment, candidate, and date range with pagination.
   */
  listUsage(filter: UsageQueryFilter): Promise<{ items: WorkspaceUsageRecord[]; total: number }>;

  /**
   * Aggregates spend totals across matching sessions.
   */
  getSpendTotals(filter: UsageQueryFilter): Promise<UsageAggregateSummary>;

  /**
   * Finds workspace IDs that have completed (status in 'ended', 'destroyed' with ended_at set)
   * but do not yet have a record in app.workspace_usage.
   */
  listCompletedWithoutUsage(limit: number): Promise<string[]>;
}
