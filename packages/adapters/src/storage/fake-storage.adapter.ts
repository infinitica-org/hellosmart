import type {
  StorageAdapter,
  StorageObjectMetadata,
  PutObjectOptions,
} from './storage.interface.js';

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<
    string,
    { buffer: Buffer; metadata: StorageObjectMetadata }
  >();

  async putObject(options: PutObjectOptions): Promise<StorageObjectMetadata> {
    const metadata: StorageObjectMetadata = {
      key: options.key,
      sizeBytes: options.buffer.length,
      mimeType: options.mimeType,
      originalName: options.originalName,
      uploadedAt: new Date().toISOString(),
      eTag: `"${Buffer.from(options.key).toString('hex').slice(0, 16)}"`,
    };

    this.store.set(options.key, {
      buffer: Buffer.from(options.buffer),
      metadata,
    });

    return metadata;
  }

  async getObject(
    key: string,
  ): Promise<{ buffer: Buffer; metadata: StorageObjectMetadata } | null> {
    const item = this.store.get(key);
    if (!item) return null;
    return {
      buffer: Buffer.from(item.buffer),
      metadata: { ...item.metadata },
    };
  }

  async deleteObject(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async getDownloadUrl(
    key: string,
    _expiresInSeconds = 3600,
  ): Promise<string> {
    if (!this.store.has(key)) {
      throw new Error(`Object not found: ${key}`);
    }
    return `https://storage.hellosmart.ai/artifacts/${encodeURIComponent(key)}`;
  }

  clear(): void {
    this.store.clear();
  }
}

