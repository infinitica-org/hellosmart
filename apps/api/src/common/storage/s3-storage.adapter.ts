import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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
} from './storage.types.js';
import { FileTooLargeException } from './storage-validation.js';

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
}
