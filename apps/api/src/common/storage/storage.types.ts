import type { Readable } from 'node:stream';

export type StorageDriver = 's3' | 'local' | 'fake';

export interface StoragePutMeta {
  contentType: string;
  filename: string;
  orgId: string;
  assignmentId: string;
  objectId: string;
  metadata?: Record<string, string>;
}

export interface StoragePutResult {
  size: number;
  sha256: string;
  key: string;
}

export interface StorageGetResult {
  stream: Readable;
  size?: number | undefined;
  contentType: string;
  filename?: string | undefined;
}

export interface StoragePort {
  put(key: string, stream: Readable, meta: StoragePutMeta): Promise<StoragePutResult>;
  createDownloadUrl(
    key: string,
    filename: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string>;
  getStream(key: string): Promise<StorageGetResult>;
  exists(key: string): Promise<boolean>;
}

export interface StorageConfig {
  driver: StorageDriver;
  localRoot: string;
  signingSecret: string;
  bucket: string;
  region: string;
  endpoint?: string | undefined;
}

export const PRESIGNED_URL_TTL_SECONDS = 900; // 15 minutes (BR-20 / Ticket requirement)
export const MAX_FILE_SIZE_BYTES = 52_428_800; // 50 MB hard cap
export const MAX_FILENAME_LENGTH = 100;
