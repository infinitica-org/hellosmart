import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import type {
  StorageGetResult,
  StoragePort,
  StoragePutMeta,
  StoragePutResult,
} from './storage.types.js';

export class FakeStorageAdapter implements StoragePort {
  private readonly objects = new Map<
    string,
    {
      buffer: Buffer;
      meta: StoragePutMeta;
      sha256: string;
      size: number;
    }
  >();

  async put(key: string, stream: Readable, meta: StoragePutMeta): Promise<StoragePutResult> {
    const chunks: Buffer[] = [];
    const hasher = crypto.createHash('sha256');

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      hasher.update(buf);
    }

    const fullBuffer = Buffer.concat(chunks);
    const sha256 = hasher.digest('hex');
    const size = fullBuffer.length;

    this.objects.set(key, {
      buffer: fullBuffer,
      meta,
      sha256,
      size,
    });

    return { size, sha256, key };
  }

  async createDownloadUrl(
    key: string,
    filename: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string> {
    return `https://fake-s3.local/${key}?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}&expiresIn=${ttlSeconds}`;
  }

  async getStream(key: string): Promise<StorageGetResult> {
    const obj = this.objects.get(key);
    if (!obj) {
      throw new Error(`Object not found in fake storage: ${key}`);
    }
    return {
      stream: Readable.from(obj.buffer),
      size: obj.size,
      contentType: obj.meta.contentType,
      filename: obj.meta.filename,
    };
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  public clear(): void {
    this.objects.clear();
  }

  public getRawObject(key: string): Buffer | undefined {
    return this.objects.get(key)?.buffer;
  }
}
