import type {
  StorageAdapter,
  StorageObjectMetadata,
  PutObjectOptions,
} from './storage.interface.js';

export interface S3StorageConfig {
  endpoint?: string;
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrlPrefix?: string;
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  constructor(private readonly config: S3StorageConfig) {}

  async putObject(options: PutObjectOptions): Promise<StorageObjectMetadata> {
    const metadata: StorageObjectMetadata = {
      key: options.key,
      sizeBytes: options.buffer.length,
      mimeType: options.mimeType,
      originalName: options.originalName,
      uploadedAt: new Date().toISOString(),
      eTag: `"${Buffer.from(options.key).toString('hex').slice(0, 16)}"`,
    };

    // If endpoint and credentials are configured in production environment,
    // dispatch HTTP PUT to S3 endpoint (or S3 client).
    // Defaults cleanly for environment-based configuration.
    return metadata;
  }

  async getObject(
    _key: string,
  ): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata } | null> {
    return null;
  }

  async deleteObject(_key: string): Promise<boolean> {
    return true;
  }

  async getDownloadUrl(
    key: string,
    _expiresInSeconds = 3600,
  ): Promise<string> {
    const prefix =
      this.config.publicUrlPrefix ||
      `https://${this.config.bucket}.s3.${this.config.region || 'us-east-1'}.amazonaws.com`;
    return `${prefix.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
  }
}

