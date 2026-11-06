import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import tar from 'tar-stream';
import { STORAGE_PORT } from '../../common/storage/storage.tokens.js';
import type { StoragePort } from '../../common/storage/storage.types.js';
import { buildSnapshotStorageKey } from '../../common/storage/storage-keys.js';
import {
  DEFAULT_AUTOSAVE_CONFIG,
  type AutosavePackagerConfig,
  type ManifestFileEntry,
  type ManifestSkippedEntry,
  type SnapshotResult,
  type WorkspaceSnapshotManifest,
} from './autosave.types.js';
import {
  TERMINAL_LOG_SOURCE_PORT,
  type TerminalLogSourcePort,
} from './ports/terminal-log-source.port.js';
import {
  WORKSPACE_CONFIG_SOURCE_PORT,
  type WorkspaceConfigSourcePort,
} from './ports/workspace-config-source.port.js';
import {
  WORKSPACE_REGISTRY_PORT,
  type WorkspaceRegistryPort,
  type WorkspaceSnapshotTarget,
} from './ports/workspace-registry.port.js';
import {
  WORKSPACE_VOLUME_READER_PORT,
  type WorkspaceEntry,
  type WorkspaceVolumeReaderPort,
} from './ports/workspace-volume-reader.port.js';

export interface Clock {
  now(): Date;
}

export interface Sleeper {
  sleep(ms: number): Promise<void>;
}

export function formatBasicUtcTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  const seconds = pad(d.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function isValidWorkspacePath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false;
  if (p.includes('\0') || /[\x00-\x1f\x7f]/.test(p)) return false;
  const normalized = path.posix.normalize(p);
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) {
    return false;
  }
  return true;
}

function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of patterns) {
    const cleanPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
    if (cleanPattern && normalized.includes(cleanPattern)) {
      return true;
    }
  }
  return false;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

@Injectable()
export class AutosavePackager {
  private readonly logger = new Logger(AutosavePackager.name);
  public clock: Clock = { now: () => new Date() };
  public sleeper: Sleeper = { sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)) };
  private readonly options: AutosavePackagerConfig;

  constructor(
    @Inject(WORKSPACE_VOLUME_READER_PORT)
    private readonly volumeReader: WorkspaceVolumeReaderPort,
    @Inject(WORKSPACE_REGISTRY_PORT)
    private readonly registry: WorkspaceRegistryPort,
    @Inject(TERMINAL_LOG_SOURCE_PORT)
    private readonly terminalLogSource: TerminalLogSourcePort,
    @Inject(WORKSPACE_CONFIG_SOURCE_PORT)
    private readonly configSource: WorkspaceConfigSourcePort,
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
    @Optional() configOverride?: Partial<AutosavePackagerConfig>,
  ) {
    this.options = { ...DEFAULT_AUTOSAVE_CONFIG, ...(configOverride || {}) };
  }

  /**
   * Periodic packaging and verified S3 upload for an active candidate workspace.
   * Enforces RPO <= 30s (BR-11), tenant boundary (BR-01), zero audit bloat.
   */
  async snapshotWorkspace(workspace: WorkspaceSnapshotTarget): Promise<SnapshotResult | null> {
    const startTime = Date.now();
    const now = this.clock.now();

    // Workspaces must be in an active session state
    if (workspace.status !== 'connected' && workspace.status !== 'disconnected') {
      this.logger.debug(
        `Skipping workspace ${workspace.id}: status '${workspace.status}' is not active`,
      );
      return null;
    }

    // 1. Retrieve previous manifest
    const previousManifest = await this.registry.getLastSnapshotManifest(workspace.id);
    const prevSeq = previousManifest?.seq ?? workspace.snapshotSeq ?? 0;
    const seq = prevSeq + 1;

    // Full snapshot cadence: every Nth snapshot or if no previous manifest exists
    const isFull = !previousManifest || seq === 1 || seq % this.options.fullSnapshotInterval === 1;

    const baseSnapshotKey = isFull
      ? null
      : ((previousManifest?.isFull
          ? workspace.lastSnapshotKey
          : previousManifest?.baseSnapshotKey) ?? workspace.lastSnapshotKey);

    // 2. Scan workspace files safely (lstat, no symlink following)
    const rawEntries = await this.volumeReader.listEntries(workspace.id);
    const sortedEntries = [...rawEntries].sort((a, b) => a.path.localeCompare(b.path));

    const manifestFiles: ManifestFileEntry[] = [];
    const skipped: ManifestSkippedEntry[] = [];
    const partialReasons: string[] = [];
    let isPartial = false;
    let totalUncompressedBytes = 0;
    let processedFileCount = 0;

    // Archive entries to pack: sorted by name for determinism
    const entriesToPack: { name: string; buffer: Buffer }[] = [];

    const prevFileMap = new Map<string, ManifestFileEntry>();
    if (previousManifest?.files) {
      for (const f of previousManifest.files) {
        prevFileMap.set(f.path, f);
      }
    }

    for (const entry of sortedEntries) {
      if (!isValidWorkspacePath(entry.path)) {
        skipped.push({ path: entry.path, reason: 'invalid_or_traversal_path' });
        continue;
      }

      if (matchesAnyPattern(entry.path, this.options.excludedPatterns)) {
        continue;
      }

      // BR-18 hostile workspace defense: never follow symlinks
      if (entry.type === 'symlink') {
        skipped.push({
          path: entry.path,
          reason: `symlink_not_followed: target=${entry.symlinkTarget ?? 'unknown'}`,
        });
        continue;
      }

      // Skip devices, FIFOs, sockets
      if (entry.type === 'special') {
        skipped.push({ path: entry.path, reason: 'special_device_skipped' });
        continue;
      }

      if (entry.type === 'directory') {
        continue;
      }

      // Caps enforcement
      if (processedFileCount >= this.options.maxFileCount) {
        isPartial = true;
        if (!partialReasons.includes('max_file_count_exceeded')) {
          partialReasons.push('max_file_count_exceeded');
        }
        skipped.push({ path: entry.path, reason: 'max_file_count_cap_reached' });
        continue;
      }

      if (entry.size > this.options.maxFileSize) {
        isPartial = true;
        partialReasons.push(`file_too_large: ${entry.path} (${entry.size} bytes)`);
        skipped.push({ path: entry.path, reason: 'per_file_size_cap_exceeded' });
        continue;
      }

      if (totalUncompressedBytes + entry.size > this.options.maxTotalSize) {
        isPartial = true;
        if (!partialReasons.includes('max_total_size_exceeded')) {
          partialReasons.push('max_total_size_exceeded');
        }
        skipped.push({ path: entry.path, reason: 'total_uncompressed_size_cap_exceeded' });
        continue;
      }

      // Attempt reading file safely
      let fileBuffer: Buffer;
      try {
        fileBuffer = await this.volumeReader.readFile(workspace.id, entry.path);
      } catch (err: any) {
        isPartial = true;
        skipped.push({ path: entry.path, reason: `read_failed: ${err?.message}` });
        continue;
      }

      const fileSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      totalUncompressedBytes += fileBuffer.length;
      processedFileCount++;

      const fileEntry: ManifestFileEntry = {
        path: entry.path,
        size: fileBuffer.length,
        sha256: fileSha256,
        mtime: entry.mtime.toISOString(),
      };
      manifestFiles.push(fileEntry);

      // Check whether file must be packed in archive
      const prevFile = prevFileMap.get(entry.path);
      const isModifiedOrNew = !prevFile || prevFile.sha256 !== fileSha256;

      if (isFull || isModifiedOrNew) {
        entriesToPack.push({
          name: entry.path,
          buffer: fileBuffer,
        });
      }
    }

    // Identify deleted files
    const deletedPaths: string[] = [];
    if (!isFull && previousManifest?.files) {
      const currentPaths = new Set(manifestFiles.map((f) => f.path));
      for (const prev of previousManifest.files) {
        if (!currentPaths.has(prev.path)) {
          deletedPaths.push(prev.path);
        }
      }
    }

    // 3. Fetch terminal logs and workspace config
    const terminalDelta = await this.terminalLogSource.getDelta(
      workspace.id,
      previousManifest?.terminalOffset ?? 0,
    );

    if (terminalDelta.logBytes.length > 0) {
      entriesToPack.push({
        name: '.terminal/delta.log',
        buffer: terminalDelta.logBytes,
      });
    }

    const wsConfig = await this.configSource.getConfig(workspace.id);
    const configBuf = Buffer.from(JSON.stringify(wsConfig, null, 2), 'utf8');
    entriesToPack.push({
      name: '.workspace/config.json',
      buffer: configBuf,
    });

    // 4. Construct manifest.json
    const manifest: WorkspaceSnapshotManifest = {
      version: '1.0',
      workspaceId: workspace.id,
      orgId: workspace.orgId,
      assignmentId: workspace.assignmentId,
      seq,
      isFull,
      baseSnapshotKey,
      timestamp: now.toISOString(),
      files: manifestFiles,
      deleted: deletedPaths,
      skipped,
      partial: isPartial,
      partialReasons,
      terminalOffset: terminalDelta.nextOffset,
      terminalBytes: terminalDelta.logBytes.length,
      config: wsConfig,
    };

    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    entriesToPack.push({
      name: 'manifest.json',
      buffer: manifestBuf,
    });

    // Sort entries alphabetically by name for deterministic tar output
    entriesToPack.sort((a, b) => a.name.localeCompare(b.name));

    // 5. Pack into deterministic gzip tarball
    const pack = tar.pack();
    for (const e of entriesToPack) {
      pack.entry(
        {
          name: e.name,
          size: e.buffer.length,
          mode: 0o644,
          mtime: new Date(0), // Deterministic fixed mtime
          uid: 0,
          gid: 0,
          uname: '',
          gname: '',
        },
        e.buffer,
      );
    }
    pack.finalize();

    const gzip = zlib.createGzip();
    const tarballStream = pack.pipe(gzip);
    const archiveBuffer = await streamToBuffer(tarballStream);
    // Ensure gzip header mtime (bytes 4-7 per RFC 1952) is zeroed out for archive determinism
    if (archiveBuffer.length >= 10 && archiveBuffer[0] === 0x1f && archiveBuffer[1] === 0x8b) {
      archiveBuffer[4] = 0;
      archiveBuffer[5] = 0;
      archiveBuffer[6] = 0;
      archiveBuffer[7] = 0;
    }
    const archiveSha256 = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

    // 6. Build tenant-isolated S3 key: snapshots/{orgId}/{assignmentId}/snap_{timestamp}_{seq}.tar.gz
    const tsBasic = formatBasicUtcTimestamp(now);
    const snapshotKey = buildSnapshotStorageKey(
      workspace.orgId,
      workspace.assignmentId,
      tsBasic,
      seq,
    );

    // 7. Verified upload with exponential backoff & jitter
    await this.uploadWithRetry(snapshotKey, archiveBuffer, archiveSha256, {
      orgId: workspace.orgId,
      assignmentId: workspace.assignmentId,
      timestamp: tsBasic,
      seq,
    });

    // 8. Update database state only after verified upload
    await this.registry.recordSnapshot(workspace.id, workspace.orgId, {
      snapshotKey,
      sha256: archiveSha256,
      timestamp: now,
      seq,
      manifest,
    });

    const durationMs = Date.now() - startTime;

    // Structured logging: only ids, sizes, durations, counts. Zero secrets, zero file content.
    this.logger.log(
      JSON.stringify({
        event: 'workspace_snapshot_created',
        workspaceId: workspace.id,
        orgId: workspace.orgId,
        assignmentId: workspace.assignmentId,
        seq,
        isFull,
        partial: isPartial,
        fileCount: manifestFiles.length,
        archiveSize: archiveBuffer.length,
        sha256: archiveSha256,
        durationMs,
      }),
    );

    return {
      snapshotKey,
      sha256: archiveSha256,
      size: archiveBuffer.length,
      seq,
      isFull,
      partial: isPartial,
      durationMs,
      timestamp: now,
      fileCount: manifestFiles.length,
    };
  }

  private async uploadWithRetry(
    key: string,
    buffer: Buffer,
    expectedSha256: string,
    meta: { orgId: string; assignmentId: string; timestamp: string; seq: number },
  ): Promise<void> {
    let lastError: Error | null = null;
    const maxRetries = this.options.maxRetries;
    const baseDelay = this.options.retryBaseDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (typeof (this.storagePort as any).putVerifiedSnapshot === 'function') {
          await (this.storagePort as any).putVerifiedSnapshot(key, Readable.from(buffer), {
            orgId: meta.orgId,
            assignmentId: meta.assignmentId,
            timestamp: meta.timestamp,
            seq: meta.seq,
            expectedSha256,
            contentType: 'application/gzip',
          });
        } else {
          const res = await this.storagePort.put(key, Readable.from(buffer), {
            contentType: 'application/gzip',
            filename: path.posix.basename(key),
            orgId: meta.orgId,
            assignmentId: meta.assignmentId,
            objectId: `snap_${meta.timestamp}_${meta.seq}`,
          });
          if (res.sha256 !== expectedSha256) {
            throw new Error(
              `Integrity check failed: uploaded sha256 ${res.sha256} !== expected ${expectedSha256}`,
            );
          }
        }
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 50);
          const delay = baseDelay * Math.pow(2, attempt) + jitter;
          await this.sleeper.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to upload verified snapshot after ${maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }
}
