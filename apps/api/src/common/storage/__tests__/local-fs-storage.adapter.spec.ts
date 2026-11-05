import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  LocalFsStorageAdapter,
  signDownloadToken,
  verifyDownloadToken,
} from '../local-fs-storage.adapter.js';
import type { StorageConfig } from '../storage.types.js';

describe('LocalFsStorageAdapter', () => {
  let testRoot: string;
  let adapter: LocalFsStorageAdapter;
  const signingSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeAll(async () => {
    testRoot = path.join(os.tmpdir(), `hs-storage-test-${crypto.randomUUID()}`);
    await fs.promises.mkdir(testRoot, { recursive: true });

    const config: StorageConfig = {
      driver: 'local',
      localRoot: testRoot,
      signingSecret,
      bucket: 'hs-test-bucket',
      region: 'us-east-1',
    };
    adapter = new LocalFsStorageAdapter(config);
  });

  afterAll(async () => {
    if (fs.existsSync(testRoot)) {
      await fs.promises.rm(testRoot, { recursive: true, force: true });
    }
  });

  it('rejects path traversal keys', async () => {
    const maliciousKey = '../../etc/passwd';
    await expect(
      adapter.put(maliciousKey, Readable.from(['hello']), {
        contentType: 'text/plain',
        filename: 'passwd',
        orgId: '11111111-1111-4111-8111-111111111111',
        assignmentId: '22222222-2222-4222-8222-222222222222',
        objectId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrow(/Path traversal rejected/);
  });

  it('writes file safely, returns size and sha256, and verifies existence', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '22222222-2222-4222-8222-222222222222';
    const objectId = '33333333-3333-4333-8333-333333333333';
    const key = `storage/${orgId}/submissions/${assignmentId}/${objectId}-report.pdf`;
    const content = Buffer.from('%PDF-1.4\nTest deliverable stream content');
    const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');

    const result = await adapter.put(key, Readable.from([content]), {
      contentType: 'application/pdf',
      filename: 'report.pdf',
      orgId,
      assignmentId,
      objectId,
    });

    expect(result.size).toBe(content.length);
    expect(result.sha256).toBe(expectedSha256);
    expect(result.key).toBe(key);

    const exists = await adapter.exists(key);
    expect(exists).toBe(true);

    const getRes = await adapter.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of getRes.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString('utf8')).toBe(content.toString('utf8'));
  });

  it('statelessly discovers storage key by objectId via findKeyByObjectId', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '22222222-2222-4222-8222-222222222222';
    const objectId = '33333333-3333-4333-8333-333333333333';
    const expectedKey = `storage/${orgId}/submissions/${assignmentId}/${objectId}-report.pdf`;

    const foundKey = await adapter.findKeyByObjectId(orgId, assignmentId, objectId);
    expect(foundKey).toBe(expectedKey);

    // Non-existent objectId
    const missing = await adapter.findKeyByObjectId(
      orgId,
      assignmentId,
      '99999999-9999-4999-8999-999999999999',
    );
    expect(missing).toBeNull();

    // Cross-tenant search returns null
    const crossOrg = await adapter.findKeyByObjectId(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      assignmentId,
      objectId,
    );
    expect(crossOrg).toBeNull();
  });

  it('generates a valid download URL with HMAC-SHA256 signed token', async () => {
    const key =
      'storage/11111111-1111-4111-8111-111111111111/submissions/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333-report.pdf';
    const downloadUrl = await adapter.createDownloadUrl(key, 'report.pdf', 'application/pdf', 900);

    expect(downloadUrl).toMatch(/^\/api\/v1\/storage\/download\?token=/);
    const token = downloadUrl.split('token=')[1]!;

    const payload = verifyDownloadToken(token, signingSecret);
    expect(payload).not.toBeNull();
    expect(payload?.key).toBe(key);
    expect(payload?.filename).toBe('report.pdf');
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects tampered or expired tokens', () => {
    const payload = {
      key: 'storage/org1/file.pdf',
      orgId: 'org1',
      filename: 'file.pdf',
      contentType: 'application/pdf',
      expiresAt: Date.now() + 60000,
    };
    const validToken = signDownloadToken(payload, signingSecret);

    // Tampered payload
    const parts = validToken.split('.');
    const tamperedPayloadB64 = Buffer.from(
      JSON.stringify({ ...payload, key: 'storage/org2/malicious.pdf' }),
    ).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${parts[1]}`;
    expect(verifyDownloadToken(tamperedToken, signingSecret)).toBeNull();

    // Tampered signature
    const badSigToken = `${parts[0]}.invalidsignaturehere`;
    expect(verifyDownloadToken(badSigToken, signingSecret)).toBeNull();

    // Expired token
    const expiredPayload = {
      ...payload,
      expiresAt: Date.now() - 1000,
    };
    const expiredToken = signDownloadToken(expiredPayload, signingSecret);
    expect(verifyDownloadToken(expiredToken, signingSecret)).toBeNull();
  });

  it('safely deletes artifacts by keys with tenant scoping and path traversal guards', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '22222222-2222-4222-8222-222222222222';
    const objectId = '44444444-4444-4444-8444-444444444444';
    const key = `storage/${orgId}/submissions/${assignmentId}/${objectId}-artifact.zip`;

    await adapter.put(key, Readable.from(['zip data']), {
      contentType: 'application/zip',
      filename: 'artifact.zip',
      orgId,
      assignmentId,
      objectId,
    });
    expect(await adapter.exists(key)).toBe(true);

    // Reject cross-tenant delete attempt
    await expect(
      adapter.deleteByKeys('22222222-2222-4222-8222-222222222222', [key]),
    ).rejects.toThrow(/Tenant isolation violation/);
    expect(await adapter.exists(key)).toBe(true);

    // Successful delete
    const res = await adapter.deleteByKeys(orgId, [key]);
    expect(res.deletedCount).toBe(1);
    expect(await adapter.exists(key)).toBe(false);

    // Idempotent delete (deleting missing key does not throw)
    const idempotentRes = await adapter.deleteByKeys(orgId, [key]);
    expect(idempotentRes.deletedCount).toBe(0);
  });

  it('safely deletes artifacts by prefix rejecting invalid or root prefixes', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const key1 = `storage/${orgId}/submissions/${assignmentId}/obj1-file1.txt`;
    const key2 = `storage/${orgId}/submissions/${assignmentId}/obj2-file2.txt`;

    await adapter.put(key1, Readable.from(['file 1']), {
      contentType: 'text/plain',
      filename: 'file1.txt',
      orgId,
      assignmentId,
      objectId: 'obj1',
    });
    await adapter.put(key2, Readable.from(['file 2']), {
      contentType: 'text/plain',
      filename: 'file2.txt',
      orgId,
      assignmentId,
      objectId: 'obj2',
    });

    // Rejects empty or root prefix
    await expect(adapter.deleteByPrefix(orgId, `storage/${orgId}/`)).rejects.toThrow(
      /Invalid prefix/,
    );
    await expect(adapter.deleteByPrefix(orgId, `storage/${orgId}/../secrets`)).rejects.toThrow(
      /Path traversal/,
    );

    // Successfully delete prefix
    const delRes = await adapter.deleteByPrefix(
      orgId,
      `storage/${orgId}/submissions/${assignmentId}/`,
    );
    expect(delRes.deletedCount).toBeGreaterThanOrEqual(2);
    expect(await adapter.exists(key1)).toBe(false);
    expect(await adapter.exists(key2)).toBe(false);
  });
});
