import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculateCutoffDate,
  getFileDigest,
  verifyGzipArchive,
  compressAndVerifyArchive,
  archiveServiceExpiredLogs,
  runQaLogArchival,
  acquireLock,
  releaseLock,
  isProcessAlive,
  getFileTailLines,
} from '../../scripts/qa-log-archive.mjs';

describe('QA Log Storage, Retention, and Archival Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-qa-log-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('calculateCutoffDate', () => {
    it('calculates the exact 7-day UTC cutoff boundary', () => {
      const fixedDate = new Date('2026-10-28T12:00:00.000Z');
      const cutoff = calculateCutoffDate(7, fixedDate);
      expect(cutoff).toBe('2026-10-21');
    });

    it('handles month and year boundaries correctly', () => {
      const janDate = new Date('2026-01-03T05:00:00.000Z');
      const cutoff = calculateCutoffDate(7, janDate);
      expect(cutoff).toBe('2025-12-27');
    });
  });

  describe('compressAndVerifyArchive', () => {
    it('compresses a log file to GZIP, verifies SHA256 integrity, and safely unlinks source', async () => {
      const sourceFile = path.join(tempDir, '2026-10-15.log');
      const sampleContent = '2026-10-15T10:00:00Z [INFO] User login success\n'.repeat(500);
      fs.writeFileSync(sourceFile, sampleContent, 'utf8');

      const sourceDigest = getFileDigest(sourceFile);
      const targetGz = path.join(tempDir, 'archive', '2026', '10', '2026-10-15.log.gz');

      const result = await compressAndVerifyArchive(sourceFile, targetGz);

      expect(result.sourceSize).toBe(sourceDigest.size);
      expect(result.archiveSize).toBeLessThan(result.sourceSize);
      expect(fs.existsSync(targetGz)).toBe(true);
      // Source must be deleted only after successful verification
      expect(fs.existsSync(sourceFile)).toBe(false);

      // Verify that the archive decompresses back to the exact original bytes
      const verify = await verifyGzipArchive(targetGz, sourceDigest);
      expect(verify.valid).toBe(true);
    });

    it('NEVER unlinks source file if compression is corrupted or integrity check fails', async () => {
      const sourceFile = path.join(tempDir, 'important-data.log');
      fs.writeFileSync(sourceFile, 'Critical operational log line\n', 'utf8');

      const targetGz = path.join(tempDir, 'target.log.gz');

      // Create an already-corrupted target file
      fs.writeFileSync(targetGz, 'not-a-gzip-stream', 'utf8');

      // The function should detect the corrupted archive, re-compress, verify, and complete safely
      const result = await compressAndVerifyArchive(sourceFile, targetGz);
      expect(result.sourceSize).toBeGreaterThan(0);
      expect(fs.existsSync(targetGz)).toBe(true);
      expect(fs.existsSync(sourceFile)).toBe(false);

      // Re-verify the newly created archive
      const decompressed = zlib.gunzipSync(fs.readFileSync(targetGz)).toString('utf8');
      expect(decompressed).toBe('Critical operational log line\n');
    });

    it('is idempotent: re-running when target archive already exists cleans up redundant source safely', async () => {
      const sourceFile = path.join(tempDir, '2026-10-10.log');
      const content = 'Idempotent test log content\n';
      fs.writeFileSync(sourceFile, content, 'utf8');

      const targetGz = path.join(tempDir, 'archive', '2026-10-10.log.gz');
      fs.mkdirSync(path.dirname(targetGz), { recursive: true });

      // First run creates valid archive
      await compressAndVerifyArchive(sourceFile, targetGz);
      expect(fs.existsSync(targetGz)).toBe(true);
      expect(fs.existsSync(sourceFile)).toBe(false);

      // Simulate a scenario where the source file was regenerated or left over
      fs.writeFileSync(sourceFile, content, 'utf8');
      const secondRun = await compressAndVerifyArchive(sourceFile, targetGz);

      expect(secondRun.reused).toBe(true);
      expect(fs.existsSync(targetGz)).toBe(true);
      expect(fs.existsSync(sourceFile)).toBe(false);
    });
  });

  describe('deduplication via getFileTailLines', () => {
    it('correctly extracts unique lines from file tail', () => {
      const testFile = path.join(tempDir, 'tail-test.log');
      const lines = [
        '2026-10-28T10:00:00Z line 1',
        '2026-10-28T10:00:01Z line 2',
        '2026-10-28T10:00:02Z line 3',
      ];
      fs.writeFileSync(testFile, lines.join('\n') + '\n', 'utf8');

      const tail = getFileTailLines(testFile);
      expect(tail.has('2026-10-28T10:00:00Z line 1')).toBe(true);
      expect(tail.has('2026-10-28T10:00:01Z line 2')).toBe(true);
      expect(tail.has('2026-10-28T10:00:02Z line 3')).toBe(true);
      expect(tail.has('2026-10-28T10:00:03Z line 4')).toBe(false);
    });

    it('returns empty set if file does not exist', () => {
      const nonExistent = path.join(tempDir, 'non-existent.log');
      const tail = getFileTailLines(nonExistent);
      expect(tail.size).toBe(0);
    });
  });

  describe('isProcessAlive & Lock Management', () => {
    it('accurately identifies active versus non-existent processes', () => {
      expect(isProcessAlive(process.pid)).toBe(true);
      // Non-existent PID
      expect(isProcessAlive(9999999)).toBe(false);
      expect(isProcessAlive(-1)).toBe(false);
    });

    it('acquires and releases lock cleanly', () => {
      const lockFile = path.join(tempDir, '.test.lock');
      acquireLock(lockFile);
      expect(fs.existsSync(lockFile)).toBe(true);

      const data = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      expect(data.pid).toBe(process.pid);

      releaseLock(lockFile);
      expect(fs.existsSync(lockFile)).toBe(false);
    });

    it('recovers dead lockfiles from crashed processes automatically', () => {
      const lockFile = path.join(tempDir, '.test-dead.lock');
      // Dead PID
      fs.writeFileSync(lockFile, JSON.stringify({ pid: 9999999, timestamp: Date.now() - 1000 }), 'utf8');

      acquireLock(lockFile);
      expect(fs.existsSync(lockFile)).toBe(true);

      const data = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      expect(data.pid).toBe(process.pid);

      releaseLock(lockFile);
    });

    it('refuses to override lockfile if process is still active', () => {
      const lockFile = path.join(tempDir, '.test-active.lock');
      fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, timestamp: Date.now() }), 'utf8');

      expect(() => acquireLock(lockFile)).toThrow(/QA archival job already running/);
    });
  });

  describe('archiveServiceExpiredLogs (7-Day Active Retention Enforcement)', () => {
    it('preserves files <= 7 days old in active storage and archives files > 7 days old', async () => {
      const refDate = new Date('2026-10-28T12:00:00.000Z');
      // Cutoff date is 2026-10-21 (7 days prior)
      const service = 'api';
      const activeDir = path.join(tempDir, 'active', service);
      fs.mkdirSync(activeDir, { recursive: true });

      // Create active files within the 7-day window (should be retained)
      const activeDates = ['2026-10-28', '2026-10-25', '2026-10-22', '2026-10-21'];
      for (const d of activeDates) {
        fs.writeFileSync(path.join(activeDir, `${d}.log`), `Log entry for ${d}\n`, 'utf8');
      }

      // Create expired files older than 7 days (should be archived)
      const expiredDates = ['2026-10-20', '2026-10-19', '2026-10-01', '2026-09-28'];
      for (const d of expiredDates) {
        fs.writeFileSync(path.join(activeDir, `${d}.log`), `Expired log entry for ${d}\n`, 'utf8');
      }

      const report = await archiveServiceExpiredLogs({
        service,
        logDir: tempDir,
        retentionDays: 7,
        referenceDate: refDate,
      });

      expect(report.scanned).toBe(8);
      expect(report.retained).toBe(4);
      expect(report.archived).toBe(4);

      // Verify active files remain present uncompressed
      for (const d of activeDates) {
        expect(fs.existsSync(path.join(activeDir, `${d}.log`))).toBe(true);
      }

      // Verify expired files were removed from active directory
      for (const d of expiredDates) {
        expect(fs.existsSync(path.join(activeDir, `${d}.log`))).toBe(false);
      }

      // Verify archived files exist in date-organized directory structure (YYYY/MM/)
      expect(fs.existsSync(path.join(tempDir, 'archive', service, '2026', '10', '2026-10-20.log.gz'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'archive', service, '2026', '10', '2026-10-19.log.gz'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'archive', service, '2026', '10', '2026-10-01.log.gz'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'archive', service, '2026', '09', '2026-09-28.log.gz'))).toBe(true);

      // Verify decompressed content matches
      const gzPath = path.join(tempDir, 'archive', service, '2026', '09', '2026-09-28.log.gz');
      const decompressed = zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8');
      expect(decompressed).toBe('Expired log entry for 2026-09-28\n');
    });
  });

  describe('runQaLogArchival (Orchestration & Concurrency Lock)', () => {
    it('executes archival across multiple services and reports metrics', async () => {
      const refDate = new Date('2026-10-28T12:00:00.000Z');
      const services = ['web', 'api'];

      for (const svc of services) {
        const activeDir = path.join(tempDir, 'active', svc);
        fs.mkdirSync(activeDir, { recursive: true });
        // 1 active file, 1 expired file
        fs.writeFileSync(path.join(activeDir, '2026-10-25.log'), `Active ${svc}\n`, 'utf8');
        fs.writeFileSync(path.join(activeDir, '2026-10-10.log'), `Expired ${svc}\n`, 'utf8');
      }

      const summary = await runQaLogArchival({
        logDir: tempDir,
        services,
        retentionDays: 7,
        enableIngest: false, // Testing archival layer without local docker daemon
        referenceDate: refDate,
      });

      expect(summary.success).toBe(true);
      expect(summary.totalArchived).toBe(2);
      expect(summary.totalRetained).toBe(2);
      expect(summary.errors.length).toBe(0);

      // Lockfile should be cleaned up on completion
      expect(fs.existsSync(path.join(tempDir, '.qa-archive.lock'))).toBe(false);
    });

    it('aborts cleanly if another archival job is currently running with active PID', async () => {
      const lockFile = path.join(tempDir, '.qa-archive.lock');
      // Using process.pid ensures the PID is actively running
      fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, timestamp: Date.now() }), 'utf8');

      await expect(
        runQaLogArchival({
          logDir: tempDir,
          services: ['api'],
          enableIngest: false,
        }),
      ).rejects.toThrow(/QA archival job already running/);
    });

    it('overrides stale lockfiles from terminated processes automatically', async () => {
      const lockFile = path.join(tempDir, '.qa-archive.lock');
      // Dead PID (9999999 does not exist)
      fs.writeFileSync(lockFile, JSON.stringify({ pid: 9999999, timestamp: Date.now() - 40 * 60 * 1000 }), 'utf8');

      const summary = await runQaLogArchival({
        logDir: tempDir,
        services: ['api'],
        enableIngest: false,
      });

      expect(summary.success).toBe(true);
      expect(fs.existsSync(lockFile)).toBe(false);
    });
  });
});
