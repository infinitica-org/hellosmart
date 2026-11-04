import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PgPool } from '../database/database.tokens.js';
import { PG_PLATFORM_POOL, PG_POOL } from '../database/database.tokens.js';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { STORAGE_PORT } from '../../common/storage/storage.tokens.js';
import type { StoragePort } from '../../common/storage/storage.types.js';
import {
  CANDIDATE_ARTIFACT_LOCATOR_PORT,
  type CandidateArtifactLocatorPort,
} from './candidate-artifact-locator.port.js';
import { SESSION_STORE } from '../session/session.tokens.js';
import type { SessionStore } from '../session/session.types.js';
import { withOrg, withPlatform } from '../tenancy/with-org.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import type { RetentionPurgeOrgReport, RetentionPurgeReport } from './retention-purge.types.js';

export const RETENTION_PURGE_ADVISORY_LOCK_ID = 8472938174;

export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 730;
export const DEFAULT_RETENTION_DAYS = 90;

@Injectable()
export class RetentionPurgeWorker {
  private readonly logger = new Logger(RetentionPurgeWorker.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(PG_POOL) private readonly appPool: PgPool,
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
    @Inject(STORAGE_PORT) private readonly storagePort: StoragePort,
    @Inject(CANDIDATE_ARTIFACT_LOCATOR_PORT)
    private readonly locator: CandidateArtifactLocatorPort,
    @Optional() @Inject(SESSION_STORE) private readonly sessionStore?: SessionStore,
  ) {}

  /**
   * Executes the retention purge job across all organizations.
   * Uses an advisory lock to ensure only one instance executes across replicas.
   *
   * Business Rules:
   * - BR-26: Soft-deleted candidate records purged after retention expires.
   * - BR-27: Storage artifacts deleted prior to DB row deletion.
   * - BR-31: Append-only audit log entry with non-PII aggregate counts per organization.
   */
  async run(
    options?: Partial<{ dryRun: boolean; batchSize: number }>,
  ): Promise<RetentionPurgeReport> {
    const startedAt = new Date().toISOString();
    const dryRun = options?.dryRun ?? this.config.RETENTION_PURGE_DRY_RUN;
    const batchSize = options?.batchSize ?? this.config.RETENTION_PURGE_BATCH_SIZE;

    // 1. Acquire global advisory lock via dedicated client from platform pool
    const lockClient = await this.platformPool.connect();
    let lockAcquired = false;

    try {
      const lockRes = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [RETENTION_PURGE_ADVISORY_LOCK_ID],
      );
      lockAcquired = Boolean(lockRes.rows[0]?.acquired);

      if (!lockAcquired) {
        this.logger.log('Retention purge advisory lock is held by another instance; skipping run.');
        return {
          startedAt,
          completedAt: new Date().toISOString(),
          totalOrgsProcessed: 0,
          totalCandidatesPurged: 0,
          totalObjectsDeleted: 0,
          totalFailures: 0,
          orgReports: [],
          skippedDueToLock: true,
        };
      }

      this.logger.log(
        `Starting retention purge run (dryRun: ${dryRun}, batchSize: ${batchSize})...`,
      );

      // 2. Enumerate all organizations using hs_platform connection
      const orgRows = await withPlatform(lockClient, async (tx) => {
        const res = await tx.query<{ id: string; retention_days: number | null }>(
          `SELECT id, retention_days FROM app.organizations ORDER BY created_at ASC`,
        );
        return res.rows;
      });

      const orgReports: RetentionPurgeOrgReport[] = [];
      let totalCandidatesPurged = 0;
      let totalObjectsDeleted = 0;
      let totalFailures = 0;

      // 3. Process each organization in its own tenant-scoped transaction
      for (const org of orgRows) {
        const retentionDays = org.retention_days ?? DEFAULT_RETENTION_DAYS;

        // Mirror DB constraint CHECK (retention_days BETWEEN 30 AND 730)
        if (retentionDays < MIN_RETENTION_DAYS || retentionDays > MAX_RETENTION_DAYS) {
          this.logger.warn(
            `Skipping org ${org.id}: configured retention_days (${retentionDays}) is outside allowed bounds [${MIN_RETENTION_DAYS}, ${MAX_RETENTION_DAYS}].`,
          );
          orgReports.push({
            orgId: org.id,
            retentionDays,
            candidatesPurged: 0,
            objectsDeleted: 0,
            failures: 0,
            dryRun,
            skippedReason: 'retention_days out of bounds',
          });
          continue;
        }

        const orgReport = await this.purgeOrganization(org.id, retentionDays, batchSize, dryRun);
        orgReports.push(orgReport);

        totalCandidatesPurged += orgReport.candidatesPurged;
        totalObjectsDeleted += orgReport.objectsDeleted;
        totalFailures += orgReport.failures;
      }

      const completedAt = new Date().toISOString();
      this.logger.log(
        `Retention purge run finished. Processed ${orgRows.length} orgs: ` +
          `${totalCandidatesPurged} candidates purged, ${totalObjectsDeleted} objects deleted, ` +
          `${totalFailures} failures. (dryRun: ${dryRun})`,
      );

      return {
        startedAt,
        completedAt,
        totalOrgsProcessed: orgRows.length,
        totalCandidatesPurged,
        totalObjectsDeleted,
        totalFailures,
        orgReports,
        skippedDueToLock: false,
      };
    } finally {
      if (lockAcquired) {
        try {
          await lockClient.query('SELECT pg_advisory_unlock($1)', [
            RETENTION_PURGE_ADVISORY_LOCK_ID,
          ]);
        } catch (unlockErr: any) {
          this.logger.error('Failed to release retention purge advisory lock', unlockErr?.message);
        }
      }
      lockClient.release();
    }
  }

  /**
   * Purges expired soft-deleted candidate records for a single organization inside withOrg.
   * Guarantees storage artifacts are deleted before database row deletion.
   */
  private async purgeOrganization(
    orgId: string,
    retentionDays: number,
    batchSize: number,
    dryRun: boolean,
  ): Promise<RetentionPurgeOrgReport> {
    const appClient = await this.appPool.connect();

    try {
      return await withOrg(appClient, orgId, async (tx) => {
        // Query expired soft-deleted candidates strictly older than retention boundary
        // Row deleted exactly retentionDays ago is NOT purged until strictly older (deleted_at < now() - interval)
        const candidatesRes = await tx.query<{ id: string }>(
          `SELECT id FROM app.users
           WHERE org_id = $1
             AND role = 'candidate'
             AND status = 'deleted'
             AND deleted_at IS NOT NULL
             AND deleted_at < now() - ($2 * interval '1 day')
           ORDER BY deleted_at ASC
           LIMIT $3`,
          [orgId, retentionDays, batchSize],
        );

        const candidates = candidatesRes.rows;
        let candidatesPurged = 0;
        let objectsDeleted = 0;
        let failures = 0;

        for (const candidate of candidates) {
          try {
            // Step 1: Locate artifacts via locator port
            let artifactKeys: string[] = [];
            try {
              artifactKeys = await this.locator.findArtifactKeys(orgId, candidate.id);
            } catch {
              failures++;
              continue; // If locator fails, skip candidate deletion to prevent orphan artifacts
            }

            // Step 2: Delete objects from storage FIRST (BR-27)
            if (artifactKeys.length > 0) {
              if (!dryRun) {
                const storageResult = await this.storagePort.deleteByKeys(orgId, artifactKeys);
                objectsDeleted += storageResult.deletedCount;
              } else {
                objectsDeleted += artifactKeys.length;
              }
            }

            // Step 3: Hard-delete database rows in dependency order
            if (!dryRun) {
              // Delete invitations referencing candidate first (NO ACTION FK)
              await tx.query(`DELETE FROM app.invitations WHERE user_id = $1 AND org_id = $2`, [
                candidate.id,
                orgId,
              ]);

              // Delete candidate user (password_history and mfa_backup_codes CASCADE)
              const deleteRes = await tx.query(
                `DELETE FROM app.users WHERE id = $1 AND org_id = $2`,
                [candidate.id, orgId],
              );

              if ((deleteRes.rowCount ?? 0) > 0) {
                candidatesPurged++;

                // Step 4: Defensive Redis session cleanup (non-blocking, no PII logged)
                if (this.sessionStore) {
                  try {
                    await this.sessionStore.revokeAllForUser(candidate.id);
                  } catch {
                    // Non-blocking
                  }
                }
              }
            } else {
              candidatesPurged++;
            }
          } catch {
            // Storage or DB failure for this candidate: do not abort remaining candidates
            failures++;
          }
        }

        // Step 5: Append audit log entry per organization (BR-31)
        // Must contain ONLY non-PII aggregate counts
        if (!dryRun && candidatesPurged > 0) {
          await appendAuditEvent(tx, {
            actorId: null,
            actorRole: 'system',
            orgId,
            action: 'retention.purged',
            entity: 'retention',
            entityId: orgId,
            after: {
              candidates_purged: candidatesPurged,
              objects_deleted: objectsDeleted,
              failures,
              retention_days: retentionDays,
              dry_run: false,
            },
          });
        }

        return {
          orgId,
          retentionDays,
          candidatesPurged,
          objectsDeleted,
          failures,
          dryRun,
        };
      });
    } finally {
      appClient.release();
    }
  }
}
