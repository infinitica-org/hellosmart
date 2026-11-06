import type { SubmissionRegistryPort } from './ports/submission-registry.port.js';
import type { SubmissionBundlerService } from './submission-bundler.service.js';

export interface RetryReport {
  scanned: number;
  bundled: number;
  failed: number;
  errors: Array<{ assignmentId: string; workspaceId: string; error: string }>;
}

/**
 * Pure retry function that sweeps assignments in 'submitted' status whose artifacts_ref is null,
 * invoking the bundler to complete artifact generation and linking.
 * Suitable for execution by a future background cron / job without adding schedulers or queues now.
 */
export async function retryUnbundledSubmissions(
  registry: SubmissionRegistryPort,
  bundler: SubmissionBundlerService,
  limit = 25,
): Promise<RetryReport> {
  const unbundled = await registry.listUnbundledSubmissions(limit);
  let bundled = 0;
  let failed = 0;
  const errors: Array<{ assignmentId: string; workspaceId: string; error: string }> = [];

  for (const item of unbundled) {
    try {
      await bundler.bundle(item.workspaceId);
      bundled++;
    } catch (err: unknown) {
      failed++;
      errors.push({
        assignmentId: item.assignmentId,
        workspaceId: item.workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    scanned: unbundled.length,
    bundled,
    failed,
    errors,
  };
}
