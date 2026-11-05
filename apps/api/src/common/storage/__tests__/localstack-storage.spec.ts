import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { S3StorageAdapter } from '../s3-storage.adapter.js';
import type { StorageConfig } from '../storage.types.js';

const isLocalstackEnabled = process.env.RUN_LOCALSTACK_TESTS === '1';

describe.skipIf(!isLocalstackEnabled)('LocalStack S3 Integration (Opt-In)', () => {
  const rawEndpoint = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
  const urlObj = new URL(rawEndpoint);

  // Safety check: only allow execution against localhost / 127.0.0.1
  if (urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
    throw new Error(
      `LocalStack integration test refused: endpoint host ${urlObj.hostname} is not localhost/127.0.0.1`,
    );
  }

  const bucketName = `hs-test-${crypto.randomUUID().slice(0, 8)}`;
  let s3Client: S3Client;
  let adapter: S3StorageAdapter;

  const config: StorageConfig = {
    driver: 's3',
    localRoot: '.storage',
    signingSecret: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    bucket: bucketName,
    region: 'us-east-1',
    endpoint: rawEndpoint,
  };

  beforeAll(async () => {
    s3Client = new S3Client({
      endpoint: rawEndpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    // Create temporary bucket in LocalStack
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    adapter = new S3StorageAdapter(config, s3Client);
  });

  afterAll(async () => {
    if (!s3Client) return;
    try {
      // List and delete all objects in the test bucket
      const listRes = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
        }),
      );

      if (listRes.Contents && listRes.Contents.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: listRes.Contents.map((obj) => ({ Key: obj.Key })),
            },
          }),
        );
      }

      await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    } catch {
      // Best-effort cleanup
    }
  });

  it('uploads zip artifact, statelessly finds key, verifies presigned URL bytes, and proves org isolation', async () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const otherOrgId = '22222222-2222-4222-8222-222222222222';
    const assignmentId = '33333333-3333-4333-8333-333333333333';
    const objectId = '44444444-4444-4444-8444-444444444444';
    const key = `storage/${orgId}/submissions/${assignmentId}/${objectId}-deliverable.zip`;

    // Synthetic ZIP deliverable (magic bytes PK\x03\x04 + payload)
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const zipPayload = Buffer.from('Synthetic ZIP submission artifact for LocalStack test');
    const zipContent = Buffer.concat([zipHeader, zipPayload]);
    const expectedSha256 = crypto.createHash('sha256').update(zipContent).digest('hex');

    // 1. Upload artifact to LocalStack S3
    const putResult = await adapter.put(key, Readable.from([zipContent]), {
      contentType: 'application/zip',
      filename: 'deliverable.zip',
      orgId,
      assignmentId,
      objectId,
    });

    expect(putResult.size).toBe(zipContent.length);
    expect(putResult.sha256).toBe(expectedSha256);
    expect(putResult.key).toBe(key);

    // 2. Stateless prefix lookup in LocalStack S3
    const discoveredKey = await adapter.findKeyByObjectId(orgId, assignmentId, objectId);
    expect(discoveredKey).toBe(key);

    // 3. Verify presigned URL parameters
    const presignedUrl = await adapter.createDownloadUrl(
      key,
      'deliverable.zip',
      'application/zip',
      900,
    );
    expect(presignedUrl).toContain(rawEndpoint);
    expect(presignedUrl).toContain(`/${bucketName}/`);
    expect(presignedUrl).toMatch(/X-Amz-Expires=900/);

    // 4. Fetch presigned URL and compare bytes byte-for-byte
    const response = await fetch(presignedUrl);
    expect(response.status).toBe(200);
    const downloadedBuffer = Buffer.from(await response.arrayBuffer());
    expect(downloadedBuffer.equals(zipContent)).toBe(true);
    expect(downloadedBuffer.length).toBe(zipContent.length);

    // 5. Verify second org cannot discover or access first org's object
    const crossOrgDiscoveredKey = await adapter.findKeyByObjectId(
      otherOrgId,
      assignmentId,
      objectId,
    );
    expect(crossOrgDiscoveredKey).toBeNull();
  });
});
