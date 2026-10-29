#!/usr/bin/env node
/**
 * QA Log Storage, Retention, and Archival Engine (HelloSmart.ai)
 *
 * Operational Responsibilities:
 * 1. Ingests stdout/stderr container logs from Docker Compose without requiring privileged access.
 * 2. Maintains active log files partitioned by service and date (YYYY-MM-DD.log).
 * 3. Enforces strict 7-day active retention: keeps the most recent 7 days uncompressed in active storage.
 * 4. Archives older logs to persistent local storage: <log-dir>/archive/<service>/<YYYY>/<MM>/<date>.log.gz.
 * 5. Compresses archives (GZIP) and cryptographically verifies integrity (SHA256 & byte size match)
 *    before deleting any active source log file.
 * 6. Guarantees idempotency: repeated runs do not duplicate or skip records.
 * 7. Recovers gracefully from container restarts, rotated logs, and interrupted archival runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';

export const DEFAULT_SERVICES = ['web', 'api', 'worker', 'ai-proxy', 'reviewer', 'ws-gateway'];
export const DEFAULT_RETENTION_DAYS = 7;
export const DEFAULT_LOG_DIR = process.env.QA_LOG_DIR || '/srv/hellosmart/logs';
export const DEFAULT_COMPOSE_FILE = process.env.QA_COMPOSE_FILE || 'infra/qa-vps/docker-compose.qa.yml';

/**
 * Calculates the UTC date cutoff for active retention.
 * Files strictly older than (cutoffDate) are eligible for archival.
 * Files on or after cutoffDate remain active.
 */
export function calculateCutoffDate(retentionDays = DEFAULT_RETENTION_DAYS, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(ref.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().split('T')[0];
}

/**
 * Computes the SHA256 checksum and byte size of a file in a memory-bounded streaming manner.
 */
export function getFileDigest(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for digest: ${filePath}`);
  }
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  let totalBytes = 0;
  let bytesRead = 0;
  try {
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }
  return {
    sha256: hash.digest('hex'),
    size: totalBytes,
  };
}

/**
 * Verifies that a GZIP archive decompresses cleanly and matches the original uncompressed digest in a memory-bounded streaming manner.
 */
export async function verifyGzipArchive(gzPath, expectedDigest) {
  if (!fs.existsSync(gzPath)) {
    return { valid: false, error: 'Archive file does not exist' };
  }

  try {
    const stat = fs.statSync(gzPath);
    if (stat.size < 10) {
      return { valid: false, error: 'Archive file is too small to be valid GZIP' };
    }

    const hash = crypto.createHash('sha256');
    let decompressedSize = 0;

    const readStream = fs.createReadStream(gzPath);
    const gunzip = zlib.createGunzip();

    gunzip.on('data', (chunk) => {
      hash.update(chunk);
      decompressedSize += chunk.length;
    });

    await pipeline(readStream, gunzip);

    if (decompressedSize !== expectedDigest.size) {
      return {
        valid: false,
        error: `Decompressed size mismatch: expected ${expectedDigest.size}, got ${decompressedSize}`,
      };
    }

    const digest = hash.digest('hex');
    if (digest !== expectedDigest.sha256) {
      return {
        valid: false,
        error: `Decompressed SHA256 mismatch: expected ${expectedDigest.sha256}, got ${digest}`,
      };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Compresses an uncompressed file to GZIP, verifies integrity, and only then deletes the source.
 * Idempotent: If target archive already exists and is verified valid, deletes source safely.
 */
export async function compressAndVerifyArchive(sourcePath, targetGzPath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  const sourceDigest = getFileDigest(sourcePath);
  const targetDir = path.dirname(targetGzPath);
  fs.mkdirSync(targetDir, { recursive: true });

  // If destination already exists, test if it is already a valid archive of this source
  if (fs.existsSync(targetGzPath)) {
    const existingCheck = await verifyGzipArchive(targetGzPath, sourceDigest);
    if (existingCheck.valid) {
      // Archive is already valid and complete; safely remove leftover active source
      fs.unlinkSync(sourcePath);
      return {
        reused: true,
        sourceSize: sourceDigest.size,
        archiveSize: fs.statSync(targetGzPath).size,
      };
    }
    // Existing archive was corrupted or from an older partial run; remove corrupted archive to re-compress
    fs.unlinkSync(targetGzPath);
  }

  // Stream compression into a temporary atomic file (.tmp.gz)
  const tmpGzPath = `${targetGzPath}.tmp.${Date.now()}`;
  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(tmpGzPath);
  const gzipStream = zlib.createGzip({ level: 9 });

  try {
    await pipeline(readStream, gzipStream, writeStream);
  } catch (err) {
    if (fs.existsSync(tmpGzPath)) {
      fs.unlinkSync(tmpGzPath);
    }
    throw new Error(`Compression failed for ${sourcePath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Cryptographically verify decompressed tmp file matches source byte-for-byte
  const verification = await verifyGzipArchive(tmpGzPath, sourceDigest);
  if (!verification.valid) {
    if (fs.existsSync(tmpGzPath)) {
      fs.unlinkSync(tmpGzPath);
    }
    throw new Error(`Archive integrity verification failed for ${tmpGzPath}: ${verification.error}`);
  }

  // Atomic rename to final archive path
  fs.renameSync(tmpGzPath, targetGzPath);

  // SAFE DELETION SAFEGUARD: Only delete source after verified atomic rename
  fs.unlinkSync(sourcePath);

  const archiveStat = fs.statSync(targetGzPath);
  return {
    reused: false,
    sourceSize: sourceDigest.size,
    archiveSize: archiveStat.size,
    sha256: sourceDigest.sha256,
  };
}

/**
 * Inspects the tail of a log file to extract recently appended lines for deduplication.
 */
export function getFileTailLines(filePath, maxBytes = 64 * 1024) {
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return new Set();
    const bytesToRead = Math.min(stat.size, maxBytes);
    const startPos = stat.size - bytesToRead;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buffer, 0, bytesToRead, startPos);
    fs.closeSync(fd);
    const text = buffer.toString('utf8');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return new Set(lines);
  } catch {
    return new Set();
  }
}

/**
 * Checks whether a process with the given PID is currently active.
 * Uses signal 0 which performs error-checking without actually terminating the process.
 */
export function isProcessAlive(pid) {
  if (typeof pid !== 'number' || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err.code === 'ESRCH') return false; // No such process
    if (err.code === 'EPERM') return true;  // Process exists but belongs to another user
    return false;
  }
}

/**
 * Atomically acquires a file lock for QA archival using O_CREAT | O_EXCL.
 * Inspects existing locks: if the recorded PID is dead or invalid, recycles the stale lockfile.
 * Never removes a lock if the recorded PID is still actively running.
 */
export function acquireLock(lockFile) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.writeFileSync(
        lockFile,
        JSON.stringify({ pid: process.pid, timestamp: Date.now() }),
        { flag: 'wx', encoding: 'utf8' },
      );
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      let lockData = null;
      try {
        const content = fs.readFileSync(lockFile, 'utf8');
        lockData = JSON.parse(content);
      } catch {
        // Corrupted or empty lockfile
      }

      if (lockData && typeof lockData.pid === 'number') {
        const alive = isProcessAlive(lockData.pid);
        if (alive) {
          const ageSec = Math.round((Date.now() - (lockData.timestamp || 0)) / 1000);
          throw new Error(
            `QA archival job already running with PID ${lockData.pid} (started ${ageSec}s ago). Exiting.`,
          );
        }
      }

      // Lock belongs to a terminated process or file is corrupted: safely clean up and retry
      try {
        fs.unlinkSync(lockFile);
      } catch {
        // Ignored if unlinked concurrently
      }
    }
  }
  throw new Error(`Failed to acquire QA archival lock on ${lockFile} after resolving stale locks.`);
}

/**
 * Releases the QA archival lockfile if and only if it belongs to the current process.
 */
export function releaseLock(lockFile) {
  try {
    if (fs.existsSync(lockFile)) {
      const content = fs.readFileSync(lockFile, 'utf8');
      const lockData = JSON.parse(content);
      if (lockData.pid === process.pid) {
        fs.unlinkSync(lockFile);
      }
    }
  } catch {
    // Ignore error on cleanup
  }
}

/**
 * Extracts logs from Docker Compose for a service since the last saved cursor timestamp.
 * Appends output to active daily log files (<logDir>/active/<service>/<YYYY-MM-DD>.log).
 */
export function ingestServiceDockerLogs({
  service,
  logDir = DEFAULT_LOG_DIR,
  composeFile = DEFAULT_COMPOSE_FILE,
  sinceOverride = null,
}) {
  const stateDir = path.join(logDir, 'state');
  const activeDir = path.join(logDir, 'active', service);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(activeDir, { recursive: true });

  const cursorFile = path.join(stateDir, `${service}.cursor`);
  let since = sinceOverride;

  if (!since && fs.existsSync(cursorFile)) {
    const saved = fs.readFileSync(cursorFile, 'utf8').trim();
    if (saved) {
      since = saved;
    }
  }

  const args = ['compose', '-f', composeFile, 'logs', '--timestamps', '--no-color'];
  if (since) {
    args.push(`--since=${since}`);
  }
  args.push(service);

  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to execute docker compose logs for ${service}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`docker compose logs exited with code ${result.status} for ${service}: ${result.stderr}`);
  }

  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);
  let latestTimestamp = since;
  const dayBuckets = new Map();

  for (const line of lines) {
    // Docker --timestamps format: 2026-10-28T10:15:30.123456789Z ...
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) continue;

    const tsPart = line.slice(0, spaceIdx);
    const dateMatch = tsPart.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (!dateMatch) continue;

    const dateKey = dateMatch[1];
    if (!dayBuckets.has(dateKey)) {
      dayBuckets.set(dateKey, []);
    }
    dayBuckets.get(dateKey).push(line);

    if (!latestTimestamp || tsPart > latestTimestamp) {
      latestTimestamp = tsPart;
    }
  }

  // Append lines to daily active files with deduplication against file tail
  for (const [dateKey, bucketLines] of dayBuckets.entries()) {
    const dailyPath = path.join(activeDir, `${dateKey}.log`);
    const existingTail = getFileTailLines(dailyPath);
    const linesToAppend = bucketLines.filter((l) => !existingTail.has(l.trim()));
    if (linesToAppend.length > 0) {
      fs.appendFileSync(dailyPath, linesToAppend.join('\n') + '\n', 'utf8');
    }
  }

  // Update cursor atomically
  if (latestTimestamp && latestTimestamp !== since) {
    const tmpCursor = `${cursorFile}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpCursor, latestTimestamp, 'utf8');
    fs.renameSync(tmpCursor, cursorFile);
  }

  return {
    linesIngested: lines.length,
    latestTimestamp,
    daysUpdated: Array.from(dayBuckets.keys()),
  };
}

/**
 * Evaluates active log files for a service and archives any file strictly older than the 7-day retention cutoff.
 */
export async function archiveServiceExpiredLogs({
  service,
  logDir = DEFAULT_LOG_DIR,
  retentionDays = DEFAULT_RETENTION_DAYS,
  referenceDate = new Date(),
}) {
  const activeDir = path.join(logDir, 'active', service);
  const archiveBaseDir = path.join(logDir, 'archive', service);
  const cutoffDateStr = calculateCutoffDate(retentionDays, referenceDate);

  if (!fs.existsSync(activeDir)) {
    return {
      service,
      scanned: 0,
      archived: 0,
      retained: 0,
      details: [],
    };
  }

  const entries = fs.readdirSync(activeDir).filter((f) => f.endsWith('.log'));
  const details = [];
  let archivedCount = 0;
  let retainedCount = 0;

  for (const file of entries) {
    const dateMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})\.log$/);
    if (!dateMatch) {
      continue;
    }

    const fileDateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const sourcePath = path.join(activeDir, file);

    // Active retention invariant: files >= cutoff remain in active storage
    if (fileDateStr >= cutoffDateStr) {
      retainedCount++;
      details.push({
        file,
        status: 'active',
        reason: `Within ${retentionDays}-day active retention window (file date: ${fileDateStr} >= cutoff: ${cutoffDateStr})`,
      });
      continue;
    }

    // Older files are archived to <archiveDir>/YYYY/MM/YYYY-MM-DD.log.gz
    const [year, month] = [dateMatch[1], dateMatch[2]];
    const targetGzPath = path.join(archiveBaseDir, year, month, `${fileDateStr}.log.gz`);

    const result = await compressAndVerifyArchive(sourcePath, targetGzPath);
    archivedCount++;
    details.push({
      file,
      status: 'archived',
      target: targetGzPath,
      sourceSize: result.sourceSize,
      archiveSize: result.archiveSize,
      compressionRatio: ((1 - result.archiveSize / result.sourceSize) * 100).toFixed(1) + '%',
    });
  }

  return {
    service,
    scanned: entries.length,
    archived: archivedCount,
    retained: retainedCount,
    cutoffDate: cutoffDateStr,
    details,
  };
}

/**
 * Top-level orchestrator: runs ingestion (if enabled) and archival across all configured services with lockfile.
 */
export async function runQaLogArchival(options = {}) {
  const {
    logDir = DEFAULT_LOG_DIR,
    services = DEFAULT_SERVICES,
    retentionDays = DEFAULT_RETENTION_DAYS,
    composeFile = DEFAULT_COMPOSE_FILE,
    enableIngest = true,
    referenceDate = new Date(),
  } = options;

  fs.mkdirSync(logDir, { recursive: true });
  const lockFile = path.join(logDir, '.qa-archive.lock');

  // Concurrency guard: atomically acquire lock, recovering stale locks only if PID is dead
  acquireLock(lockFile);

  const summary = {
    startedAt: new Date().toISOString(),
    logDir,
    retentionDays,
    cutoffDate: calculateCutoffDate(retentionDays, referenceDate),
    services: {},
    totalArchived: 0,
    totalRetained: 0,
    errors: [],
  };

  try {
    for (const service of services) {
      const serviceReport = {
        ingest: null,
        archival: null,
        error: null,
      };

      if (enableIngest) {
        try {
          serviceReport.ingest = ingestServiceDockerLogs({
            service,
            logDir,
            composeFile,
          });
        } catch (err) {
          serviceReport.error = err instanceof Error ? err.message : String(err);
          summary.errors.push(`[${service} ingest] ${serviceReport.error}`);
        }
      }

      try {
        serviceReport.archival = await archiveServiceExpiredLogs({
          service,
          logDir,
          retentionDays,
          referenceDate,
        });
        summary.totalArchived += serviceReport.archival.archived;
        summary.totalRetained += serviceReport.archival.retained;
      } catch (err) {
        serviceReport.error = err instanceof Error ? err.message : String(err);
        summary.errors.push(`[${service} archival] ${serviceReport.error}`);
      }

      summary.services[service] = serviceReport;
    }
  } finally {
    releaseLock(lockFile);
  }

  summary.completedAt = new Date().toISOString();
  summary.success = summary.errors.length === 0;
  return summary;
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  const args = process.argv.slice(2);
  const helpFlag = args.includes('--help') || args.includes('-h');
  if (helpFlag) {
    console.log(`
HelloSmart QA Log Archival Tool
Usage: node scripts/qa-log-archive.mjs [options]

Options:
  --log-dir <path>         Root log directory (default: ${DEFAULT_LOG_DIR})
  --retention-days <num>   Active retention in days (default: ${DEFAULT_RETENTION_DAYS})
  --no-ingest              Skip Docker compose log ingestion (archive active files only)
  --services <csv>         Comma-separated list of services (default: ${DEFAULT_SERVICES.join(',')})
  --compose-file <path>    Path to docker-compose file (default: ${DEFAULT_COMPOSE_FILE})
  --help, -h               Show this help message
`);
    process.exit(0);
  }

  const getArgValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const logDir = getArgValue('--log-dir') || DEFAULT_LOG_DIR;
  const retentionDays = parseInt(getArgValue('--retention-days') || String(DEFAULT_RETENTION_DAYS), 10);
  const servicesArg = getArgValue('--services');
  const services = servicesArg ? servicesArg.split(',').map((s) => s.trim()) : DEFAULT_SERVICES;
  const composeFile = getArgValue('--compose-file') || DEFAULT_COMPOSE_FILE;
  const enableIngest = !args.includes('--no-ingest');

  runQaLogArchival({
    logDir,
    retentionDays,
    services,
    composeFile,
    enableIngest,
  })
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      if (!summary.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal archival error:', err);
      process.exit(1);
    });
}
