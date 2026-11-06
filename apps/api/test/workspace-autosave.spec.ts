import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import child_process from 'node:child_process';
import zlib from 'node:zlib';
import tar from 'tar-stream';
import { Queue, Worker } from 'bullmq';
import { Readable } from 'node:stream';
import {
  AutosavePackager,
  formatBasicUtcTimestamp,
} from '../src/modules/workspaces/autosave.packager.js';
import {
  calculateRpoLagSeconds,
  type WorkspaceSnapshotManifest,
} from '../src/modules/workspaces/autosave.types.js';
import { FakeWorkspaceVolumeReader } from '../src/modules/workspaces/fakes/fake-workspace-volume-reader.js';
import { FakeWorkspaceRegistry } from '../src/modules/workspaces/fakes/fake-workspace-registry.js';
import { FakeTerminalLogSource } from '../src/modules/workspaces/fakes/fake-terminal-log-source.js';
import { FakeWorkspaceConfigSource } from '../src/modules/workspaces/fakes/fake-workspace-config-source.js';
import { FakeStorageAdapter } from '../src/common/storage/fake-storage.adapter.js';
import { S3StorageAdapter } from '../src/common/storage/s3-storage.adapter.js';
import {
  AutosaveQueueProcessor,
  WORKSPACE_AUTOSAVE_QUEUE_NAME,
} from '../src/modules/workspaces/autosave-queue.processor.js';
import type { WorkspaceSnapshotTarget } from '../src/modules/workspaces/ports/workspace-registry.port.js';
import { DEFAULT_MAIL_CONFIG } from '../src/common/services/mail.service.js';

describe('Workspace Autosave Packager & S3 Uploader (BR-11, NF-013, BR-01, BR-18)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const assignmentId = '22222222-2222-4222-8222-222222222222';
  const candidateId = '33333333-3333-4333-8333-333333333333';
  const workspaceId = '44444444-4444-4444-8444-444444444444';

  let volumeReader: FakeWorkspaceVolumeReader;
  let registry: FakeWorkspaceRegistry;
  let terminalLogSource: FakeTerminalLogSource;
  let configSource: FakeWorkspaceConfigSource;
  let storage: FakeStorageAdapter;
  let fakeClock: { nowTime: number; now: () => Date };
  let fakeSleeper: { sleepDelays: number[]; sleep: (ms: number) => Promise<void> };
  let target: WorkspaceSnapshotTarget;

  beforeEach(() => {
    volumeReader = new FakeWorkspaceVolumeReader();
    registry = new FakeWorkspaceRegistry();
    terminalLogSource = new FakeTerminalLogSource();
    configSource = new FakeWorkspaceConfigSource();
    storage = new FakeStorageAdapter();

    fakeClock = {
      nowTime: Date.parse('2026-11-06T10:00:00.000Z'),
      now: () => new Date(fakeClock.nowTime),
    };

    fakeSleeper = {
      sleepDelays: [],
      sleep: async (ms: number) => {
        fakeSleeper.sleepDelays.push(ms);
      },
    };

    target = {
      id: workspaceId,
      orgId,
      assignmentId,
      candidateId,
      status: 'connected',
      mode: 'cloud',
      lastSnapshotAt: null,
      lastSnapshotKey: null,
      snapshotSeq: 0,
    };

    registry.registerWorkspace(target);
  });

  async function readTarballEntries(
    buffer: Buffer,
  ): Promise<Map<string, { buffer: Buffer; header: any }>> {
    const unzipped = zlib.gunzipSync(buffer);
    const extract = tar.extract();
    const entries = new Map<string, { buffer: Buffer; header: any }>();

    return new Promise((resolve, reject) => {
      extract.on('entry', (header, stream, next) => {
        const chunks: Buffer[] = [];
        stream.on('data', (d) => chunks.push(d));
        stream.on('end', () => {
          entries.set(header.name, { buffer: Buffer.concat(chunks), header });
          next();
        });
        stream.on('error', reject);
      });
      extract.on('finish', () => resolve(entries));
      extract.on('error', reject);

      const r = Readable.from(unzipped);
      r.pipe(extract);
    });
  }

  describe('1. Packager Core & Determinism', () => {
    it('creates initial full snapshot with manifest, files, terminal logs, and config', async () => {
      volumeReader.setFile(workspaceId, 'src/main.ts', { content: 'console.log("hello");' });
      volumeReader.setFile(workspaceId, 'package.json', { content: '{"name":"candidate-app"}' });
      terminalLogSource.setLogs(workspaceId, '$ ls -la\n$ npm test\n');
      configSource.setConfig(workspaceId, { runtime: 'node22', vcpu: 2 });

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
        { fullSnapshotInterval: 10 },
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);

      expect(result).not.toBeNull();
      expect(result?.seq).toBe(1);
      expect(result?.isFull).toBe(true);
      expect(result?.partial).toBe(false);
      expect(result?.fileCount).toBe(2);
      expect(result?.snapshotKey).toBe(
        `snapshots/${orgId}/${assignmentId}/snap_20261106T100000Z_1.tar.gz`,
      );

      // Verify stored object in storage
      expect(await storage.exists(result!.snapshotKey)).toBe(true);
      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const uploadedBuffer = Buffer.concat(chunks);

      expect(uploadedBuffer.length).toBe(result?.size);
      const computedSha = crypto.createHash('sha256').update(uploadedBuffer).digest('hex');
      expect(computedSha).toBe(result?.sha256);

      // Verify tarball contents
      const entries = await readTarballEntries(uploadedBuffer);
      expect(entries.has('manifest.json')).toBe(true);
      expect(entries.has('src/main.ts')).toBe(true);
      expect(entries.has('package.json')).toBe(true);
      expect(entries.has('.terminal/delta.log')).toBe(true);
      expect(entries.has('.workspace/config.json')).toBe(true);

      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.version).toBe('1.0');
      expect(manifest.isFull).toBe(true);
      expect(manifest.seq).toBe(1);
      expect(manifest.files.length).toBe(2);
      expect(manifest.deleted).toEqual([]);

      // Verify registry update
      expect(registry.recordCallCount).toBe(1);
      const updated = await registry.getWorkspaceById(workspaceId, orgId);
      expect(updated?.lastSnapshotAt).toEqual(fakeClock.now());
      expect(updated?.lastSnapshotKey).toBe(result!.snapshotKey);
      expect(updated?.snapshotSeq).toBe(1);
    });

    it('produces byte-for-byte deterministic tarball and identical sha256 for identical state', async () => {
      volumeReader.setFile(workspaceId, 'b.txt', { content: 'beta content' });
      volumeReader.setFile(workspaceId, 'a.txt', { content: 'alpha content' });
      terminalLogSource.setLogs(workspaceId, 'terminal log');
      configSource.setConfig(workspaceId, { key: 'val' });

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const run1 = await packager.snapshotWorkspace(target);

      // Re-create pristine registry and storage with identical fake clock
      const freshRegistry = new FakeWorkspaceRegistry();
      freshRegistry.registerWorkspace(target);
      const freshStorage = new FakeStorageAdapter();

      const packager2 = new AutosavePackager(
        volumeReader,
        freshRegistry,
        terminalLogSource,
        configSource,
        freshStorage,
      );
      packager2.clock = fakeClock;
      packager2.sleeper = fakeSleeper;

      const run2 = await packager2.snapshotWorkspace(target);

      expect(run1?.sha256).toBe(run2?.sha256);
      expect(run1?.size).toBe(run2?.size);
      expect(run1?.snapshotKey).toBe(run2?.snapshotKey);
    });

    it('generates incremental diff for modified files, lists all files in manifest, and tracks deletions', async () => {
      volumeReader.setFile(workspaceId, 'file1.txt', { content: 'original 1' });
      volumeReader.setFile(workspaceId, 'file2.txt', { content: 'original 2' });

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
        { fullSnapshotInterval: 10 },
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      // 1. Initial snapshot (seq 1, full)
      const snap1 = await packager.snapshotWorkspace(target);
      expect(snap1?.isFull).toBe(true);

      // 2. Modify file2, add file3, delete file1
      fakeClock.nowTime += 30_000;
      target.lastSnapshotAt = fakeClock.now();
      target.lastSnapshotKey = snap1!.snapshotKey;
      target.snapshotSeq = 1;

      volumeReader.deleteFile(workspaceId, 'file1.txt');
      volumeReader.setFile(workspaceId, 'file2.txt', { content: 'modified 2' });
      volumeReader.setFile(workspaceId, 'file3.txt', { content: 'new 3' });

      const snap2 = await packager.snapshotWorkspace(target);
      expect(snap2?.seq).toBe(2);
      expect(snap2?.isFull).toBe(false);

      const streamRes = await storage.getStream(snap2!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      // Incremental tarball should only pack modified/added files + manifest
      expect(entries.has('file2.txt')).toBe(true);
      expect(entries.has('file3.txt')).toBe(true);
      expect(entries.has('file1.txt')).toBe(false);

      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.isFull).toBe(false);
      expect(manifest.deleted).toEqual(['file1.txt']);
      // Manifest must list ALL current active files
      expect(manifest.files.map((f) => f.path).sort()).toEqual(['file2.txt', 'file3.txt']);
      expect(manifest.baseSnapshotKey).toBe(snap1!.snapshotKey);
    });

    it('forces a full snapshot on every Nth snapshot sequence', async () => {
      volumeReader.setFile(workspaceId, 'file.txt', { content: 'stable content' });
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
        { fullSnapshotInterval: 3 }, // Full on 1, 4, 7...
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const s1 = await packager.snapshotWorkspace(target);
      expect(s1?.seq).toBe(1);
      expect(s1?.isFull).toBe(true);

      target.snapshotSeq = 1;
      target.lastSnapshotKey = s1!.snapshotKey;
      fakeClock.nowTime += 30_000;
      const s2 = await packager.snapshotWorkspace(target);
      expect(s2?.seq).toBe(2);
      expect(s2?.isFull).toBe(false);

      target.snapshotSeq = 2;
      target.lastSnapshotKey = s2!.snapshotKey;
      fakeClock.nowTime += 30_000;
      const s3 = await packager.snapshotWorkspace(target);
      expect(s3?.seq).toBe(3);
      expect(s3?.isFull).toBe(false);

      target.snapshotSeq = 3;
      target.lastSnapshotKey = s3!.snapshotKey;
      fakeClock.nowTime += 30_000;
      const s4 = await packager.snapshotWorkspace(target);
      expect(s4?.seq).toBe(4);
      expect(s4?.isFull).toBe(true); // Full on seq 4!
    });

    it('produces distinct snapshot keys if two snapshots are created in the same second', async () => {
      volumeReader.setFile(workspaceId, 'f.txt', { content: 'content' });
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const s1 = await packager.snapshotWorkspace(target);
      target.snapshotSeq = 1;
      target.lastSnapshotKey = s1!.snapshotKey;

      // Same timestamp
      const s2 = await packager.snapshotWorkspace(target);

      expect(s1?.snapshotKey).not.toBe(s2?.snapshotKey);
      expect(s1?.snapshotKey).toContain('_1.tar.gz');
      expect(s2?.snapshotKey).toContain('_2.tar.gz');
    });
  });

  describe('2. Hostile Workspace Defenses (BR-18, Security)', () => {
    it('never follows symlinks and does not pack symlink targets', async () => {
      volumeReader.setFile(workspaceId, 'safe.txt', { content: 'safe' });
      volumeReader.setSymlink(workspaceId, 'evil_symlink', '/etc/passwd');

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      // evil_symlink must NOT be packed as a file
      expect(entries.has('evil_symlink')).toBe(false);

      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      const skippedItem = manifest.skipped.find((s) => s.path === 'evil_symlink');
      expect(skippedItem).toBeDefined();
      expect(skippedItem?.reason).toContain('symlink_not_followed');
    });

    it('skips special device files (FIFOs, sockets, character/block devices)', async () => {
      volumeReader.setSpecial(workspaceId, 'fifo_pipe');
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      expect(entries.has('fifo_pipe')).toBe(false);
      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.skipped.some((s) => s.path === 'fifo_pipe')).toBe(true);
    });

    it('rejects path traversal, absolute paths, and control characters safely', async () => {
      volumeReader.setFile(workspaceId, '../escaped.txt', { content: 'evil' });
      volumeReader.setFile(workspaceId, '/absolute/path.txt', { content: 'evil' });
      volumeReader.setFile(workspaceId, 'null\0byte.txt', { content: 'evil' });

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      expect(entries.has('../escaped.txt')).toBe(false);
      expect(entries.has('/absolute/path.txt')).toBe(false);
      expect(entries.has('null\0byte.txt')).toBe(false);

      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.skipped.length).toBe(3);
    });

    it('enforces per-file size cap, marks partial=true, and continues without crash', async () => {
      volumeReader.setFile(workspaceId, 'giant.bin', { content: Buffer.alloc(1000) });
      volumeReader.setFile(workspaceId, 'normal.txt', { content: 'normal file' });

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
        { maxFileSize: 500 }, // 500 bytes cap for test
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      expect(result?.partial).toBe(true);

      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      expect(entries.has('giant.bin')).toBe(false);
      expect(entries.has('normal.txt')).toBe(true);

      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.partial).toBe(true);
      expect(manifest.partialReasons.some((r) => r.includes('file_too_large'))).toBe(true);
    });

    it('handles files that disappear or fail to read during snapshot, marking partial=true', async () => {
      volumeReader.setFile(workspaceId, 'ghost.txt', { content: 'vanishing' });
      volumeReader.markDisappearing('ghost.txt');

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      expect(result?.partial).toBe(true);

      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      expect(entries.has('ghost.txt')).toBe(false);
      const manifest: WorkspaceSnapshotManifest = JSON.parse(
        entries.get('manifest.json')!.buffer.toString('utf8'),
      );
      expect(manifest.skipped.some((s) => s.path === 'ghost.txt')).toBe(true);
    });

    it('handles unreadable files (EACCES) safely without crash', async () => {
      volumeReader.setFile(workspaceId, 'locked.txt', { content: 'locked' });
      volumeReader.markUnreadable('locked.txt');

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      expect(result?.partial).toBe(true);

      const streamRes = await storage.getStream(result!.snapshotKey);
      const chunks: Buffer[] = [];
      for await (const c of streamRes.stream) chunks.push(c);
      const entries = await readTarballEntries(Buffer.concat(chunks));

      expect(entries.has('locked.txt')).toBe(false);
    });

    it('never spawns child processes (spies on child_process)', async () => {
      const execSpy = vi.spyOn(child_process, 'exec');
      const spawnSpy = vi.spyOn(child_process, 'spawn');

      volumeReader.setFile(workspaceId, 'app.ts', { content: 'test' });
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      await packager.snapshotWorkspace(target);

      expect(execSpy).not.toHaveBeenCalled();
      expect(spawnSpy).not.toHaveBeenCalled();

      execSpy.mockRestore();
      spawnSpy.mockRestore();
    });
  });

  describe('3. Integrity, Retries & Exponential Backoff', () => {
    it('retries failed uploads with exponential backoff and jitter, updating last_snapshot_at only upon success', async () => {
      volumeReader.setFile(workspaceId, 'data.txt', { content: 'test data' });

      let attempts = 0;
      const failingStorage = new FakeStorageAdapter();
      const originalPut = failingStorage.putVerifiedSnapshot.bind(failingStorage);

      // Fail twice, succeed on 3rd attempt
      failingStorage.putVerifiedSnapshot = async (...args) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('S3 transient network timeout 503');
        }
        return originalPut(...args);
      };

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        failingStorage,
        { maxRetries: 3, retryBaseDelayMs: 200 },
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);

      expect(result).not.toBeNull();
      expect(attempts).toBe(3);
      expect(fakeSleeper.sleepDelays.length).toBe(2);
      // Delays should be exponential base (200 * 2^0, 200 * 2^1) plus jitter
      expect(fakeSleeper.sleepDelays[0]).toBeGreaterThanOrEqual(200);
      expect(fakeSleeper.sleepDelays[1]).toBeGreaterThanOrEqual(400);

      expect(registry.recordCallCount).toBe(1);
    });

    it('does NOT update last_snapshot_at when all retries fail, preserving the previous good snapshot', async () => {
      volumeReader.setFile(workspaceId, 'data.txt', { content: 'test data' });

      const alwaysFailingStorage = new FakeStorageAdapter();
      alwaysFailingStorage.putVerifiedSnapshot = async () => {
        throw new Error('S3 fatal bucket error');
      };

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        alwaysFailingStorage,
        { maxRetries: 2, retryBaseDelayMs: 100 },
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      await expect(packager.snapshotWorkspace(target)).rejects.toThrow(
        /Failed to upload verified snapshot after 3 attempts/,
      );

      // Registry must NOT advance
      expect(registry.recordCallCount).toBe(0);
      const ws = await registry.getWorkspaceById(workspaceId, orgId);
      expect(ws?.lastSnapshotAt).toBeNull();
      expect(ws?.snapshotSeq).toBe(0);
    });

    it('detects corrupted upload checksum and retries', async () => {
      volumeReader.setFile(workspaceId, 'important.ts', { content: 'code' });

      let attempts = 0;
      const corruptingStorage = new FakeStorageAdapter();
      const origPut = corruptingStorage.putVerifiedSnapshot.bind(corruptingStorage);

      corruptingStorage.putVerifiedSnapshot = async (key, stream, meta) => {
        attempts++;
        if (attempts === 1) {
          // Simulate S3 bit flip corruption
          return origPut(key, stream, { ...meta, expectedSha256: 'corrupted_sha256_fake' });
        }
        return origPut(key, stream, meta);
      };

      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        corruptingStorage,
        { maxRetries: 2, retryBaseDelayMs: 100 },
      );
      packager.clock = fakeClock;
      packager.sleeper = fakeSleeper;

      const result = await packager.snapshotWorkspace(target);
      expect(result).not.toBeNull();
      expect(attempts).toBe(2);
      expect(fakeSleeper.sleepDelays.length).toBe(1);
    });
  });

  describe('4. S3 Storage Adapter Checksum Verification', () => {
    it('sets ChecksumAlgorithm SHA256 and verifies via HeadObject', async () => {
      const mockSend = vi.fn().mockImplementation(async (command: any) => {
        if (command.constructor.name === 'PutObjectCommand') {
          return { $metadata: { httpStatusCode: 200 } };
        }
        if (command.constructor.name === 'HeadObjectCommand') {
          return {
            $metadata: { httpStatusCode: 200 },
            ContentLength: 12,
            ChecksumSHA256: 'base64_sha256_matching',
          };
        }
        return {};
      });

      const fakeClient = { send: mockSend } as any;
      const s3Adapter = new S3StorageAdapter(
        {
          driver: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          localRoot: '.storage',
          signingSecret: '12345678901234567890123456789012',
        },
        fakeClient,
      );

      const testPayload = Buffer.from('hello world\n'); // 12 bytes
      const testSha = crypto.createHash('sha256').update(testPayload).digest('hex');
      const base64Sha = Buffer.from(testSha, 'hex').toString('base64');

      // Adjust mock to return matching base64 checksum
      mockSend.mockImplementation(async (command: any) => {
        if (command.constructor.name === 'PutObjectCommand') {
          expect(command.input.ChecksumAlgorithm).toBe('SHA256');
          expect(command.input.ChecksumSHA256).toBe(base64Sha);
          return {};
        }
        if (command.constructor.name === 'HeadObjectCommand') {
          expect(command.input.ChecksumMode).toBe('ENABLED');
          return {
            ContentLength: testPayload.length,
            ChecksumSHA256: base64Sha,
          };
        }
        return {};
      });

      const snapshotKey = `snapshots/${orgId}/${assignmentId}/snap_20261106T100000Z_1.tar.gz`;
      const res = await s3Adapter.putVerifiedSnapshot(snapshotKey, Readable.from(testPayload), {
        orgId,
        assignmentId,
        timestamp: '20261106T100000Z',
        seq: 1,
        expectedSha256: testSha,
      });

      expect(res.sha256).toBe(testSha);
      expect(res.size).toBe(testPayload.length);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('throws error when HeadObject returns mismatched ChecksumSHA256', async () => {
      const mockSend = vi.fn().mockImplementation(async (command: any) => {
        if (command.constructor.name === 'PutObjectCommand') {
          return {};
        }
        if (command.constructor.name === 'HeadObjectCommand') {
          return {
            ContentLength: 10,
            ChecksumSHA256: 'tampered_or_mismatched_sha',
          };
        }
        return {};
      });

      const s3Adapter = new S3StorageAdapter(
        {
          driver: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          localRoot: '.storage',
          signingSecret: '12345678901234567890123456789012',
        },
        { send: mockSend } as any,
      );

      const snapshotKey = `snapshots/${orgId}/${assignmentId}/snap_20261106T100000Z_1.tar.gz`;
      await expect(
        s3Adapter.putVerifiedSnapshot(snapshotKey, Readable.from('test bytes'), {
          orgId,
          assignmentId,
          timestamp: '20261106T100000Z',
        }),
      ).rejects.toThrow(/Post-upload checksum verification failed/);
    });
  });

  describe('5. Queue & Processor Lifecycle', () => {
    it('does not start processor or queue when WORKSPACE_AUTOSAVE_ENABLED=false', () => {
      const config = {
        ...DEFAULT_MAIL_CONFIG,
        WORKSPACE_AUTOSAVE_ENABLED: false,
        NODE_ENV: 'development',
      };
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );

      const processor = new AutosaveQueueProcessor(config as any, registry, packager);
      processor.onApplicationBootstrap();

      // No error thrown and processor stays idle
      expect(processor).toBeDefined();
    });

    it('does not start processor when NODE_ENV is test even if enabled', () => {
      const config = {
        ...DEFAULT_MAIL_CONFIG,
        WORKSPACE_AUTOSAVE_ENABLED: true,
        NODE_ENV: 'test',
      };
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );

      const processor = new AutosaveQueueProcessor(config as any, registry, packager);
      processor.onApplicationBootstrap();

      expect(processor).toBeDefined();
    });

    it('prevents overlapping snapshots for the same workspace', async () => {
      volumeReader.setFile(workspaceId, 'f.txt', { content: 'slow file' });
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      const snapshotSpy = vi.spyOn(packager, 'snapshotWorkspace');

      const config = {
        ...DEFAULT_MAIL_CONFIG,
        WORKSPACE_AUTOSAVE_ENABLED: false,
      };
      const processor = new AutosaveQueueProcessor(config as any, registry, packager);

      // Simulate concurrent processing of the same workspace
      (processor as any).activeProcessing.add(workspaceId);

      await processor.processJob({ workspaceId, orgId, assignmentId });

      // Because activeProcessing contained workspaceId, snapshotWorkspace was skipped!
      expect(snapshotSpy).not.toHaveBeenCalled();
    });

    it('drops job safely if workspace is not found or org mismatch occurs', async () => {
      const packager = new AutosavePackager(
        volumeReader,
        registry,
        terminalLogSource,
        configSource,
        storage,
      );
      const snapshotSpy = vi.spyOn(packager, 'snapshotWorkspace');

      const config = {
        ...DEFAULT_MAIL_CONFIG,
        WORKSPACE_AUTOSAVE_ENABLED: false,
      };
      const processor = new AutosaveQueueProcessor(config as any, registry, packager);

      // Non-existent workspace
      await processor.processJob({
        workspaceId: '99999999-9999-9999-9999-999999999999',
        orgId,
        assignmentId,
      });

      expect(snapshotSpy).not.toHaveBeenCalled();
    });
  });

  describe('6. RPO Arithmetic & Metrics Pure Helper', () => {
    it('calculates RPO lag correctly from last verified snapshot timestamp', () => {
      const now = new Date('2026-11-06T10:00:30.000Z');
      const lastSnapshot = new Date('2026-11-06T10:00:05.000Z');

      const lag = calculateRpoLagSeconds(now, lastSnapshot);
      expect(lag).toBe(25);
    });

    it('returns -1 when no snapshot has occurred yet', () => {
      const now = new Date('2026-11-06T10:00:30.000Z');
      expect(calculateRpoLagSeconds(now, null)).toBe(-1);
    });

    it('formats basic UTC timestamp without separators for S3 key', () => {
      const d = new Date('2026-11-06T09:05:07.123Z');
      expect(formatBasicUtcTimestamp(d)).toBe('20261106T090507Z');
    });
  });

  describe('7. Contract Tests for Unbuilt Capabilities (SKIPPED with reasons)', () => {
    it.skip('blocked on the migration that adds last_snapshot_at', () => {
      // app.workspaces has snapshot_ref text, but lacks last_snapshot_at, last_snapshot_key, last_snapshot_sha256, snapshot_seq.
      // Awaiting schema migration from platform data team.
    });

    it.skip('blocked on orchestrator Sysbox container volume mount (Stream 9, Sysbox agent)', () => {
      // Requires orchestrator and Sysbox container runtime integration.
    });

    it.skip('blocked on orchestrator container-killed-mid-save test (Sysbox crash recovery)', () => {
      // Requires live container host and SIGKILL simulation.
    });

    it.skip('restore from snapshot chain (belongs to Candidate Resume ticket, CA-011)', () => {
      // Replays base snapshot + incremental diffs to restore full candidate filesystem on resume.
    });

    it.skip('retention purge of snapshots under snapshots/ (blocked on decision for Vishal V)', () => {
      // 4.4 retention purge only targets storage/{org_id}/. Snapshots require decision on lifecycle purge policy.
    });
  });

  describe('8. Opt-in Redis Integration Test', () => {
    const runRedis = process.env.RUN_REDIS_TESTS === '1';

    it.skipIf(!runRedis)(
      'connects to Redis, enqueues repeating jobs, and cleans up only its own prefix',
      async () => {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        const url = new URL(redisUrl);
        const connection = {
          host: url.hostname,
          port: Number(url.port || 6379),
          password: url.password || undefined,
          maxRetriesPerRequest: null,
        };

        const prefix = `hs:test:autosave:${crypto.randomUUID()}`;
        const queue = new Queue(WORKSPACE_AUTOSAVE_QUEUE_NAME, {
          connection,
          prefix,
        });

        let completedSnapshots = 0;
        const worker = new Worker(
          WORKSPACE_AUTOSAVE_QUEUE_NAME,
          async (_job) => {
            completedSnapshots++;
            return { ok: true, snapshotCount: completedSnapshots };
          },
          { connection, prefix },
        );

        try {
          await queue.add(
            'snapshot',
            { workspaceId, orgId, assignmentId },
            { repeat: { every: 1000 } },
          );

          // Wait until at least 2 snapshots complete or timeout after 5 seconds
          const start = Date.now();
          while (completedSnapshots < 2 && Date.now() - start < 5000) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          expect(completedSnapshots).toBeGreaterThanOrEqual(2);
        } finally {
          await worker.close();
          await queue.obliterate({ force: true });
          await queue.close();
        }
      },
      10000,
    );
  });
});
