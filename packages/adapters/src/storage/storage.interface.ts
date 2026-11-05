export interface StorageObjectMetadata {
  key: string;
  sizeBytes: number;
  mimeType: string;
  originalName: string;
  uploadedAt: string;
  eTag?: string;
}

export interface PutObjectOptions {
  key: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  metadata?: Record<string, string>;
}

export interface StorageAdapter {
  putObject(options: PutObjectOptions): Promise<StorageObjectMetadata>;
  getObject(key: string): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata } | null>;
  deleteObject(key: string): Promise<boolean>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

