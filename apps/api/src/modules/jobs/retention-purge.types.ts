export interface RetentionPurgeOrgReport {
  orgId: string;
  retentionDays: number;
  candidatesPurged: number;
  objectsDeleted: number;
  failures: number;
  dryRun: boolean;
  skippedReason?: string | undefined;
}

export interface RetentionPurgeReport {
  startedAt: string;
  completedAt: string;
  totalOrgsProcessed: number;
  totalCandidatesPurged: number;
  totalObjectsDeleted: number;
  totalFailures: number;
  orgReports: RetentionPurgeOrgReport[];
  skippedDueToLock?: boolean | undefined;
}

/**
 * Purge target registry defining which entities are subject to automated retention deletion.
 * In MMP, 'candidates' is implemented.
 * 'submissions' will be enabled in Sprint 4 when app.submissions and app.assignments are provisioned.
 */
export type RetentionPurgeTarget = 'candidates' | 'submissions';

export interface PurgeTargetRegistry {
  enabledTargets: RetentionPurgeTarget[];
}
