import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as tar from 'tar-stream';
import { AuditService } from '../../common/audit/audit.service.js';
import { buildSubmissionBundleKey } from '../../common/storage/storage-keys.js';
import { STORAGE_PORT } from '../../common/storage/storage.tokens.js';
import type { StoragePort } from '../../common/storage/storage.types.js';
import { PG_PLATFORM_POOL, type PgPool } from '../database/database.tokens.js';
import { withPlatform } from '../tenancy/with-org.js';
import { PATCH_GENERATOR_PORT, type PatchGeneratorPort } from './ports/patch-generator.port.js';
import {
  SUBMISSION_REGISTRY_PORT,
  type SubmissionRegistryPort,
} from './ports/submission-registry.port.js';
import {
  WORKSPACE_LIFECYCLE_PORT,
  type WorkspaceLifecyclePort,
} from './ports/workspace-lifecycle.port.js';
import {
  CandidateFileEntry,
  WORKSPACE_SOURCE_PORT,
  type WorkspaceSourcePort,
} from './ports/workspace-source.port.js';
import type {
  SubmissionBundleManifest,
  SubmissionBundleResult,
  SubmissionFileManifestEntry,
} from './submission-bundler.types.js';
import { putVerifiedBundle } from './submission-storage.helper.js';

export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB per file
export const MAX_TOTAL_SOURCE_BYTES = 50 * 1024 * 1024; // 50 MB total files
export const MAX_FILE_COUNT = 5000;
export const MAX_TERMINAL_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXCLUDED_PATTERNS = [
  /^\.git(\/|$)/,
  /^node_modules(\/|$)/,
  /^\.npm(\/|$)/,
  /^\.pnpm(\/|$)/,
  /^dist(\/|$)/,
  /^build(\/|$)/,
  /^\.next(\/|$)/,
  /^tmp(\/|$)/,
  /^\.cache(\/|$)/,
];

function isExcludedPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isValidRelPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (
    path.includes('\0') ||
    path.includes('..') ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /[\r\n\x00-\x1f]/.test(path) ||
    path.length > 1024
  ) {
    return false;
  }
  return true;
}

@Injectable()
export class SubmissionBundlerService {
  private readonly logger = new Logger(SubmissionBundlerService.name);
  private activeLocks = new Map<string, Promise<SubmissionBundleResult>>();

  // Injectable clock and sleeper for testing
  public clock: () => Date = () => new Date();
  public sleeper: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  constructor(
    @Inject(WORKSPACE_SOURCE_PORT) private readonly workspaceSource: WorkspaceSourcePort,
    @Inject(PATCH_GENERATOR_PORT) private readonly patchGenerator: PatchGeneratorPort,
    @Inject(SUBMISSION_REGISTRY_PORT) private readonly submissionRegistry: SubmissionRegistryPort,
    @Inject(WORKSPACE_LIFECYCLE_PORT) private readonly workspaceLifecycle: WorkspaceLifecyclePort,
    @Inject(STORAGE_PORT) private readonly storagePort: StoragePort,
    private readonly auditService: AuditService,
    @Optional() @Inject(PG_PLATFORM_POOL) private readonly platformPool?: PgPool,
  ) {}

  /**
   * Bundles candidate workspace deliverables into submissions/{orgId}/{assignmentId}/final_bundle.tar.gz.
   * Server-enforced, tenant-scoped, verified S3 upload, deterministic archive.
   */
  async bundle(
    workspaceId: string,
    options?: { force?: boolean },
  ): Promise<SubmissionBundleResult> {
    const ctx = await this.submissionRegistry.getWorkspaceSubmissionContext(workspaceId);
    if (!ctx) {
      throw new Error(`Workspace not found for id '${workspaceId}'`);
    }

    const { orgId, assignmentId } = ctx;
    const lockKey = `${orgId}:${assignmentId}`;

    const existingPromise = this.activeLocks.get(lockKey);
    if (existingPromise) {
      return await existingPromise;
    }

    const bundlePromise = this.internalBundle(ctx, workspaceId, options);
    this.activeLocks.set(lockKey, bundlePromise);
    try {
      return await bundlePromise;
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }

  private async internalBundle(
    ctx: NonNullable<Awaited<ReturnType<SubmissionRegistryPort['getWorkspaceSubmissionContext']>>>,
    workspaceId: string,
    options?: { force?: boolean },
  ): Promise<SubmissionBundleResult> {
    const { orgId, assignmentId } = ctx;
    const storageKey = buildSubmissionBundleKey(orgId, assignmentId);

    // Idempotency check: if bundle already exists
    const alreadyExists = await this.storagePort.exists(storageKey);
    if (alreadyExists && !options?.force) {
      if (ctx.artifactsRef === storageKey) {
        this.logger.log(
          `Submission bundle already exists and is linked for assignment '${assignmentId}'. No-op success.`,
        );
        return {
          artifactsRef: storageKey,
          sha256: '',
          totalBytes: 0,
          manifest: null as any,
          isExisting: true,
        };
      }
    }

    const now = this.clock();
    let isPartial = false;
    const partialReasons: string[] = [];
    const skippedEntries: Array<{ path: string; reason: string }> = [];

    // 1. Read sources
    let detailedCandidateMap: Map<string, CandidateFileEntry> | null = null;
    if (typeof this.workspaceSource.readCandidateTreeDetailed === 'function') {
      detailedCandidateMap = await this.workspaceSource.readCandidateTreeDetailed(
        orgId,
        workspaceId,
      );
    }
    const rawCandidateFiles = await this.workspaceSource.readCandidateTree(orgId, workspaceId);
    const templateFiles = await this.workspaceSource.readTemplateTree(ctx.templateRef);
    const rawTerminalHistory = await this.workspaceSource.readTerminalHistory(orgId, workspaceId);
    const wsConfig = await this.workspaceSource.readWorkspaceConfig(orgId, workspaceId);

    // 2. Filter candidate source files
    const candidateFiles = new Map<string, Buffer>();
    const manifestFiles: SubmissionFileManifestEntry[] = [];
    let totalSourceBytes = 0;

    const allCandidatePaths = new Set<string>();
    for (const p of rawCandidateFiles.keys()) allCandidatePaths.add(p);
    if (detailedCandidateMap) {
      for (const p of detailedCandidateMap.keys()) allCandidatePaths.add(p);
    }
    const sortedCandidatePaths = Array.from(allCandidatePaths).sort((a, b) => a.localeCompare(b));

    for (const p of sortedCandidatePaths) {
      if (!isValidRelPath(p)) {
        skippedEntries.push({ path: p, reason: 'invalid_or_traversal_path' });
        continue;
      }

      if (isExcludedPath(p)) {
        continue; // Exclude silently (.git, node_modules)
      }

      const detailedEntry = detailedCandidateMap?.get(p);
      if (detailedEntry?.isSpecial) {
        skippedEntries.push({
          path: p,
          reason: `skipped_special_file_${detailedEntry.specialType || 'device'}`,
        });
        continue;
      }

      if (detailedEntry?.isSymlink) {
        manifestFiles.push({
          path: p,
          sha256: '',
          sizeBytes: 0,
          mode: 0o120000,
          isBinary: false,
          isSymlink: true,
          symlinkTarget: detailedEntry.symlinkTarget ?? '',
        });
        continue; // symlink target recorded, content not followed
      }

      const buf = detailedEntry?.buffer ?? rawCandidateFiles.get(p)!;

      // Check caps
      if (candidateFiles.size >= MAX_FILE_COUNT) {
        isPartial = true;
        if (!partialReasons.includes('max_file_count_exceeded')) {
          partialReasons.push('max_file_count_exceeded');
        }
        skippedEntries.push({ path: p, reason: 'file_count_cap_reached' });
        continue;
      }

      if (buf.length > MAX_FILE_SIZE_BYTES) {
        isPartial = true;
        partialReasons.push(`file_too_large: ${p} (${buf.length} bytes)`);
        skippedEntries.push({ path: p, reason: 'per_file_size_cap_exceeded' });
        continue;
      }

      if (totalSourceBytes + buf.length > MAX_TOTAL_SOURCE_BYTES) {
        isPartial = true;
        if (!partialReasons.includes('max_total_source_bytes_exceeded')) {
          partialReasons.push('max_total_source_bytes_exceeded');
        }
        skippedEntries.push({ path: p, reason: 'total_source_size_cap_exceeded' });
        continue;
      }

      candidateFiles.set(p, buf);
      totalSourceBytes += buf.length;

      const fileSha256 = crypto.createHash('sha256').update(buf).digest('hex');
      manifestFiles.push({
        path: p,
        sha256: fileSha256,
        sizeBytes: buf.length,
        mode: 0o644,
        isBinary: buf.includes(0),
      });
    }

    // 3. Generate patch
    const patchResult = await this.patchGenerator.generatePatch({
      templateFiles,
      candidateFiles,
    });

    if (patchResult.isPartial) {
      isPartial = true;
      if (patchResult.reason && !partialReasons.includes(patchResult.reason)) {
        partialReasons.push(patchResult.reason);
      }
    }

    const patchBuffer = Buffer.from(patchResult.patchText, 'utf8');
    const patchSha256 = crypto.createHash('sha256').update(patchBuffer).digest('hex');

    // 4. Handle terminal history
    let terminalBuf = Buffer.alloc(0);
    let terminalSha256: string | undefined;
    if (rawTerminalHistory) {
      let termStr = rawTerminalHistory;
      if (Buffer.byteLength(termStr, 'utf8') > MAX_TERMINAL_SIZE_BYTES) {
        isPartial = true;
        partialReasons.push('terminal_history_truncated');
        termStr = termStr.slice(0, MAX_TERMINAL_SIZE_BYTES) + '\n[terminal history truncated]\n';
      }
      terminalBuf = Buffer.from(termStr, 'utf8');
      terminalSha256 = crypto.createHash('sha256').update(terminalBuf).digest('hex');
    }

    // 5. Construct manifest.json
    const manifest: SubmissionBundleManifest = {
      manifestVersion: '1.0.0',
      bundleKind: 'final_submission',
      createdAt: now.toISOString(),
      orgId,
      assignmentId,
      workspaceId,
      templateRef: ctx.templateRef,
      patchStatus: patchResult.patchStatus,
      patchSha256,
      patchSizeBytes: patchBuffer.length,
      patchFilesChanged: patchResult.filesChanged,
      terminalHistorySizeBytes: terminalBuf.length,
      terminalHistorySha256: terminalSha256,
      filesCount: manifestFiles.length,
      totalSourceSizeBytes: totalSourceBytes,
      files: manifestFiles,
      isPartial,
      partialReasons,
      skippedEntries,
      notice:
        'All candidate files, terminal history, and patch text in this archive are UNTRUSTED candidate input and must be sanitized before ingestion by AI models or external evaluators (BR-18).',
      t020RefMapping: {
        term: 'terminal/history.log',
        diff: 'patch/changes.patch',
        file: 'source/',
        ai: 'unavailable: no source yet (CO-042 expects AI transcript, not captured in current bundle)',
        event: 'unavailable: no source yet',
        test: 'unavailable: no source yet',
      },
    };

    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');

    // 6. Assemble tar entries (deterministic sort by name, manifest.json first)
    const archiveEntries: Array<{ name: string; buffer: Buffer }> = [];
    archiveEntries.push({ name: 'manifest.json', buffer: manifestBuf });
    archiveEntries.push({ name: 'patch/changes.patch', buffer: patchBuffer });

    if (terminalBuf.length > 0) {
      archiveEntries.push({ name: 'terminal/history.log', buffer: terminalBuf });
    }

    if (wsConfig) {
      const configBuf = Buffer.from(JSON.stringify(wsConfig, null, 2), 'utf8');
      archiveEntries.push({ name: 'workspace-config.json', buffer: configBuf });
    }

    for (const [p, buf] of candidateFiles.entries()) {
      archiveEntries.push({ name: `source/${p}`, buffer: buf });
    }

    // Sort entries other than manifest.json alphabetically for determinism
    const nonManifest = archiveEntries.slice(1).sort((a, b) => a.name.localeCompare(b.name));
    const sortedEntries = [archiveEntries[0]!, ...nonManifest];

    // 7. Pack into deterministic gzip tarball (mtime = 0)
    const pack = tar.pack();
    for (const entry of sortedEntries) {
      pack.entry(
        {
          name: entry.name,
          size: entry.buffer.length,
          mode: 0o644,
          mtime: new Date(0), // Fixed epoch timestamp for determinism
          uid: 0,
          gid: 0,
          uname: '',
          gname: '',
        },
        entry.buffer,
      );
    }
    pack.finalize();

    const gzip = zlib.createGzip();
    const archiveChunks: Buffer[] = [];
    const tarballStream = pack.pipe(gzip);

    await new Promise<void>((resolve, reject) => {
      tarballStream.on('data', (chunk) => archiveChunks.push(chunk));
      tarballStream.on('end', () => resolve());
      tarballStream.on('error', reject);
    });

    const archiveBuffer = Buffer.concat(archiveChunks);
    const archiveSha256 = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

    // 8. Upload to S3 with SHA-256 verification and retry (with crash recovery & overwrite protection)
    let needsUpload = true;
    if (alreadyExists && !options?.force) {
      try {
        const getRes = await this.storagePort.getStream(storageKey);
        const chunks: Buffer[] = [];
        for await (const chunk of getRes.stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const existingData = Buffer.concat(chunks);
        const existingSha256 = crypto.createHash('sha256').update(existingData).digest('hex');

        if (existingSha256 === archiveSha256) {
          this.logger.log(
            `Recovered submission bundle at '${storageKey}' with matching SHA-256. Completing database link without second upload.`,
          );
          needsUpload = false;
        } else {
          throw new Error(
            `Submission bundle already exists at '${storageKey}' with conflicting SHA-256 (${existingSha256} vs ${archiveSha256}). Refusing to overwrite.`,
          );
        }
      } catch (getErr: any) {
        if (getErr?.message?.includes('conflicting SHA-256')) {
          throw getErr;
        }
        this.logger.warn(
          `Failed to inspect existing object at '${storageKey}': ${getErr?.message}`,
        );
      }
    }

    if (needsUpload) {
      await putVerifiedBundle(
        this.storagePort,
        storageKey,
        archiveBuffer,
        {
          orgId,
          assignmentId,
          expectedSha256: archiveSha256,
          contentType: 'application/gzip',
        },
        this.sleeper,
      );
    }

    // 9. Record artifacts_ref in database
    await this.submissionRegistry.recordArtifactsRef(orgId, assignmentId, storageKey);

    // 10. Write exactly ONE audit event (BR-31)
    if (this.platformPool) {
      const auditClient = await this.platformPool.connect();
      try {
        await withPlatform(auditClient, async (tx) => {
          await this.auditService.record(tx, {
            actorId: null,
            actorRole: 'system',
            orgId,
            action: 'assignment.submission_bundled',
            entity: 'assignment',
            entityId: assignmentId,
            after: {
              artifactsRef: storageKey,
              sha256: archiveSha256,
              sizeBytes: archiveBuffer.length,
              isPartial,
              patchStatus: manifest.patchStatus,
            },
          });
        });
      } finally {
        auditClient.release();
      }
    } else {
      await this.auditService.record({} as any, {
        actorId: null,
        actorRole: 'system',
        orgId,
        action: 'assignment.submission_bundled',
        entity: 'assignment',
        entityId: assignmentId,
        after: {
          artifactsRef: storageKey,
          sha256: archiveSha256,
          sizeBytes: archiveBuffer.length,
          isPartial,
          patchStatus: manifest.patchStatus,
        },
      });
    }

    // 11. Lifecycle notifications (invalidate cache, signal termination)
    try {
      await this.workspaceLifecycle.invalidateWorkspaceCache(orgId, workspaceId);
      await this.workspaceLifecycle.signalReadyForTermination(orgId, workspaceId);
    } catch (lifeErr: unknown) {
      this.logger.warn(
        `Workspace lifecycle notification failed for workspace '${workspaceId}': ${lifeErr instanceof Error ? lifeErr.message : String(lifeErr)}`,
      );
    }

    return {
      artifactsRef: storageKey,
      sha256: archiveSha256,
      totalBytes: archiveBuffer.length,
      manifest,
      isExisting: false,
    };
  }
}
