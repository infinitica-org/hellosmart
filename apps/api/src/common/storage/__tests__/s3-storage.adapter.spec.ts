import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { S3StorageAdapter } from '../s3-storage.adapter.js';
import type { StorageConfig } from '../storage.types.js';

describe('S3StorageAdapter', () => {
  const config: StorageConfig = {
    driver: 's3',
    localRoot: '.storage',
    signingSecret: '0123456789abcdef0123456789abcdef0123456789abcdef',
    bucket: 'hs-test-bucket',
    region: 'us-east-1',
  };

  it('puts object to S3 with correct metadata and returns sha256', async () => {
    let capturedCommand: any;
    const mockClient = {
      send: vi.fn().mockImplementation(async (command) => {
        capturedCommand = command;
        return {};
      }),
    } as unknown as S3Client;

    const adapter = new S3StorageAdapter(config, mockClient);
    const content = Buffer.from('%PDF-1.4\nTest S3 upload');
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '22222222-2222-4222-8222-222222222222';
    const objectId = '33333333-3333-4333-8333-333333333333';
    const key = `storage/${orgId}/submissions/${assignmentId}/${objectId}-report.pdf`;

    const result = await adapter.put(key, Readable.from([content]), {
      contentType: 'application/pdf',
      filename: 'report.pdf',
      orgId,
      assignmentId,
      objectId,
    });

    expect(result.size).toBe(content.length);
    expect(result.key).toBe(key);
    expect(result.sha256).toBeDefined();

    expect(capturedCommand).toBeInstanceOf(PutObjectCommand);
    expect(capturedCommand.input.Bucket).toBe('hs-test-bucket');
    expect(capturedCommand.input.Key).toBe(key);
    expect(capturedCommand.input.ContentType).toBe('application/pdf');
    expect(capturedCommand.input.ContentLength).toBe(content.length);
    expect(capturedCommand.input.Metadata.org_id).toBe(orgId);
  });

  it('checks existence via HeadObjectCommand', async () => {
    const mockClient = {
      send: vi.fn().mockImplementation(async (command) => {
        if (command.input.Key.includes('non-existent')) {
          const err: any = new Error('Not Found');
          err.name = 'NotFound';
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        return {};
      }),
    } as unknown as S3Client;

    const adapter = new S3StorageAdapter(config, mockClient);

    const exists = await adapter.exists('storage/org1/file.pdf');
    expect(exists).toBe(true);

    const notExists = await adapter.exists('storage/org1/non-existent.pdf');
    expect(notExists).toBe(false);
  });

  it('gets object stream via GetObjectCommand', async () => {
    const testContent = Buffer.from('hello s3 stream');
    const mockClient = {
      send: vi.fn().mockResolvedValue({
        Body: Readable.from([testContent]),
        ContentLength: testContent.length,
        ContentType: 'text/plain',
      }),
    } as unknown as S3Client;

    const adapter = new S3StorageAdapter(config, mockClient);
    const result = await adapter.getStream('storage/org1/file.txt');

    expect(result.size).toBe(testContent.length);
    expect(result.contentType).toBe('text/plain');

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello s3 stream');
  });
});
