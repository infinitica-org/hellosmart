import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  MAX_FILE_SIZE_BYTES,
  type StorageConfig,
  type StorageGetResult,
  type StoragePort,
  type StoragePutMeta,
  type StoragePutResult,
  type SnapshotPutMeta,
} from './storage.types.js';
import { FileTooLargeException } from './storage-validation.js';
import { isKeyInOrg, isSnapshotKeyInOrg } from './storage-keys.js';

export class S3StorageAdapter implements StoragePort {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: StorageConfig,
    clientOverride?: S3Client,
  ) {
    this.bucket = config.bucket;
    if (clientOverride) {
      this.s3Client = clientOverride;
    } else {
      const s3Config: S3ClientConfig = {
        region: config.region || 'us-east-1',
      };

      if (config.endpoint) {
        s3Config.endpoint = config.endpoint;
        s3Config.forcePathStyle = true; // Required for LocalStack / MinIO
      }

      // In production ECS, credentials come from IAM task role if not specified in config
      if (process.env.STORAGE_S3_ACCESS_KEY_ID && process.env.STORAGE_S3_SECRET_ACCESS_KEY) {
        s3Config.credentials = {
          accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
        };
      }

      this.s3Client = new S3Client(s3Config);
    }
  }

  async put(key: string, stream: Readable, meta: StoragePutMeta): Promise<StoragePutResult> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const hasher = crypto.createHash('sha256');

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;

      if (totalBytes > MAX_FILE_SIZE_BYTES) {
        throw new FileTooLargeException(
          `File size exceeds 50MB limit; stream aborted at ${totalBytes} bytes`,
        );
      }

      hasher.update(buf);
      chunks.push(buf);
    }

    const payloadBuffer = Buffer.concat(chunks);
    const sha256 = hasher.digest('hex');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: payloadBuffer,
      ContentType: meta.contentType,
      ContentLength: payloadBuffer.length,
      Metadata: {
        org_id: meta.orgId,
        assignment_id: meta.assignmentId,
        object_id: meta.objectId,
        sha256,
        original_filename: meta.filename,
      },
    });

    await this.s3Client.send(command);

    return {
      key,
      size: payloadBuffer.length,
      sha256,
    };
  }

  async putVerifiedSnapshot(
    key: string,
    stream: Readable,
    meta: SnapshotPutMeta,
  ): Promise<StoragePutResult> {
    if (!isSnapshotKeyInOrg(key, meta.orgId)) {
      throw new Error(
        `Tenant isolation violation: snapshot key '${key}' does not belong to organization '${meta.orgId}'`,
      );
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const hasher = crypto.createHash('sha256');

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;

      if (totalBytes > MAX_FILE_SIZE_BYTES) {
        throw new FileTooLargeException(
          `Snapshot size exceeds 50MB limit; stream aborted at ${totalBytes} bytes`,
        );
      }

      hasher.update(buf);
      chunks.push(buf);
    }

    const payloadBuffer = Buffer.concat(chunks);
    const sha256 = hasher.digest('hex');

    if (meta.expectedSha256 && meta.expectedSha256 !== sha256) {
      throw new Error(
        `Pre-upload checksum mismatch: computed ${sha256} does not match expected ${meta.expectedSha256}`,
      );
    }

    const base64Sha256 = Buffer.from(sha256, 'hex').toString('base64');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: payloadBuffer,
      ContentType: meta.contentType ?? 'application/gzip',
      ContentLength: payloadBuffer.length,
      ChecksumAlgorithm: 'SHA256',
      ChecksumSHA256: base64Sha256,
      Metadata: {
        org_id: meta.orgId,
        assignment_id: meta.assignmentId,
        sha256,
        timestamp: meta.timestamp,
        seq: String(meta.seq ?? 0),
      },
    });

    await this.s3Client.send(command);

    const headCommand = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ChecksumMode: 'ENABLED',
    });

    const headRes = await this.s3Client.send(headCommand);

    if (headRes.ContentLength !== undefined && headRes.ContentLength !== payloadBuffer.length) {
      throw new Error(
        `Post-upload verification failed: S3 size ${headRes.ContentLength} !== local ${payloadBuffer.length}`,
      );
    }

    if (headRes.ChecksumSHA256 && headRes.ChecksumSHA256 !== base64Sha256) {
      throw new Error(
        `Post-upload checksum verification failed: S3 ChecksumSHA256 ${headRes.ChecksumSHA256} !== local ${base64Sha256}`,
      );
    }

    return {
      key,
      size: payloadBuffer.length,
      sha256,
    };
  }

  async createDownloadUrl(
    key: string,
    filename: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
      ResponseContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
  }

  async getStream(key: string): Promise<StorageGetResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return {
      stream: response.Body as Readable,
      size: response.ContentLength,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async findKeyByObjectId(
    orgId: string,
    assignmentId: string,
    objectId: string,
  ): Promise<string | null> {
    const prefix = `storage/${orgId}/submissions/${assignmentId}/${objectId}-`;
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: 1,
    });
    try {
      const response = await this.s3Client.send(command);
      if (response.Contents && response.Contents.length > 0 && response.Contents[0]?.Key) {
        return response.Contents[0].Key;
      }
      return null;
    } catch {
      return null;
    }
  }

  async deleteByKeys(orgId: string, keys: string[]): Promise<{ deletedCount: number }> {
    if (keys.length === 0) {
      return { deletedCount: 0 };
    }

    for (const key of keys) {
      if (!isKeyInOrg(key, orgId)) {
        throw new Error(
          `Tenant isolation violation: key '${key}' does not belong to organization '${orgId}'`,
        );
      }
    }

    let deletedCount = 0;
    const BATCH_SIZE = 1000;
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });
      const res = await this.s3Client.send(command);
      deletedCount += batch.length - (res.Errors?.length ?? 0);
    }

    return { deletedCount };
  }

  async deleteByPrefix(orgId: string, prefix: string): Promise<{ deletedCount: number }> {
    const expectedPrefix = `storage/${orgId}/`;
    if (
      !prefix.startsWith(expectedPrefix) ||
      prefix.trim() === expectedPrefix ||
      prefix.trim() === 'storage/'
    ) {
      throw new Error(`Invalid prefix: prefix must be a specific subpath under ${expectedPrefix}`);
    }
    if (prefix.includes('..') || prefix.includes('\0') || prefix.includes('\\')) {
      throw new Error('Path traversal rejected in storage prefix');
    }

    let deletedCount = 0;
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listRes = await this.s3Client.send(listCommand);
      const objects = listRes.Contents?.filter((obj) => Boolean(obj.Key)) ?? [];

      if (objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        });
        const delRes = await this.s3Client.send(deleteCommand);
        deletedCount += objects.length - (delRes.Errors?.length ?? 0);
      }

      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    return { deletedCount };
  }
}
