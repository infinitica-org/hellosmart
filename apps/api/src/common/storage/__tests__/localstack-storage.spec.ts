import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageAdapter } from '../s3-storage.adapter.js';
import type { StorageConfig } from '../storage.types.js';

const isLocalstackEnabled = process.env.RUN_LOCALSTACK_TESTS === '1';

describe.skipIf(!isLocalstackEnabled)('LocalStack S3 Integration (Opt-In)', () => {
  const endpoint = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
  const bucket = 'hs-local-artifacts';

  const config: StorageConfig = {
    driver: 's3',
    localRoot: '.storage',
    signingSecret: '0123456789abcdef0123456789abcdef0123456789abcdef',
    bucket,
    region: 'us-east-1',
    endpoint,
  };

  it('connects to LocalStack S3, puts object, and generates download url', async () => {
    // Setup bucket if not already present
    const s3 = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {
      // Bucket may already exist
    }

    const adapter = new S3StorageAdapter(config);
    const key =
      'storage/11111111-1111-4111-8111-111111111111/submissions/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333-deliverable.pdf';
    const content = Buffer.from('%PDF-1.4\nLocalStack real S3 test');

    const result = await adapter.put(key, Readable.from([content]), {
      contentType: 'application/pdf',
      filename: 'deliverable.pdf',
      orgId: '11111111-1111-4111-8111-111111111111',
      assignmentId: '22222222-2222-4222-8222-222222222222',
      objectId: '33333333-3333-4333-8333-333333333333',
    });

    expect(result.size).toBe(content.length);
    expect(await adapter.exists(key)).toBe(true);

    const url = await adapter.createDownloadUrl(key, 'deliverable.pdf', 'application/pdf', 900);
    expect(url).toContain(endpoint);
  });
});
