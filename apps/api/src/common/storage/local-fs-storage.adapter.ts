import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type {
  StorageConfig,
  StorageGetResult,
  StoragePort,
  StoragePutMeta,
  StoragePutResult,
  SnapshotPutMeta,
} from './storage.types.js';
import { StreamValidationTransform } from './storage-validation.js';
import { extractMetadataFromKey, isKeyInOrg, isSnapshotKeyInOrg } from './storage-keys.js';

export interface LocalDownloadTokenPayload {
  key: string;
  orgId: string;
  filename: string;
  contentType: string;
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Creates an HMAC-SHA256 signed download token for the local filesystem storage adapter.
 * Access logs will NOT leak the token because line 158 of logging.hooks.ts strips query strings.
 */
export function signDownloadToken(payload: LocalDownloadTokenPayload, secret: string): string {
  const canonical = `${payload.key}:${payload.orgId}:${payload.filename}:${payload.contentType}:${payload.expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed download token using timingSafeEqual and checks expiration.
 */
export function verifyDownloadToken(
  token: string,
  secret: string,
): LocalDownloadTokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return null;
  }

  let payload: LocalDownloadTokenPayload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.key !== 'string' ||
    typeof payload.orgId !== 'string' ||
    typeof payload.filename !== 'string' ||
    typeof payload.contentType !== 'string' ||
    typeof payload.expiresAt !== 'number'
  ) {
    return null;
  }

  // Expiration check (timing-independent)
  if (Date.now() > payload.expiresAt) {
    return null;
  }

  const canonical = `${payload.key}:${payload.orgId}:${payload.filename}:${payload.contentType}:${payload.expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(canonical).digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return payload;
}

export class LocalFsStorageAdapter implements StoragePort {
  constructor(private readonly config: StorageConfig) {}

  private resolveSafePath(key: string): string {
    const root = path.resolve(this.config.localRoot);
    const resolved = path.resolve(root, key);
    if (!resolved.startsWith(root + path.sep)) {
      throw new Error(`Path traversal rejected: key '${key}' resolves outside storage root`);
    }
    return resolved;
  }

  async put(key: string, stream: Readable, meta: StoragePutMeta): Promise<StoragePutResult> {
    const targetPath = this.resolveSafePath(key);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    const validator = new StreamValidationTransform();
    const writeStream = fs.createWriteStream(targetPath);

    try {
      await pipeline(stream, validator, writeStream);
    } catch (err) {
      // Clean up partially written file on failure/abort
      if (fs.existsSync(targetPath)) {
        try {
          await fs.promises.unlink(targetPath);
        } catch {
          // ignore cleanup error
        }
      }
      throw err;
    }

    const size = validator.getBytesRead();
    const sha256 = validator.getDigest();

    return {
      key,
      size,
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
    const targetPath = this.resolveSafePath(key);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    const validator = new StreamValidationTransform();
    const writeStream = fs.createWriteStream(targetPath);

    try {
      await pipeline(stream, validator, writeStream);
    } catch (err) {
      if (fs.existsSync(targetPath)) {
        try {
          await fs.promises.unlink(targetPath);
        } catch {
          // ignore
        }
      }
      throw err;
    }

    const size = validator.getBytesRead();
    const sha256 = validator.getDigest();

    if (meta.expectedSha256 && meta.expectedSha256 !== sha256) {
      if (fs.existsSync(targetPath)) {
        try {
          await fs.promises.unlink(targetPath);
        } catch {
          // ignore
        }
      }
      throw new Error(
        `Integrity check failed: computed ${sha256} does not match expected ${meta.expectedSha256}`,
      );
    }

    return {
      key,
      size,
      sha256,
    };
  }

  async createDownloadUrl(
    key: string,
    filename: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string> {
    const meta = extractMetadataFromKey(key);
    const orgId = meta?.orgId ?? 'unknown';

    const payload: LocalDownloadTokenPayload = {
      key,
      orgId,
      filename,
      contentType,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    const token = signDownloadToken(payload, this.config.signingSecret);
    return `/api/v1/storage/download?token=${token}`;
  }

  async getStream(key: string): Promise<StorageGetResult> {
    const filePath = this.resolveSafePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Artifact not found on local filesystem: ${key}`);
    }

    const stat = await fs.promises.stat(filePath);
    const meta = extractMetadataFromKey(key);
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      size: stat.size,
      contentType: 'application/octet-stream',
      filename: meta?.filename ?? path.basename(filePath),
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  async findKeyByObjectId(
    orgId: string,
    assignmentId: string,
    objectId: string,
  ): Promise<string | null> {
    const prefix = `storage/${orgId}/submissions/${assignmentId}/`;
    try {
      const dirPath = this.resolveSafePath(prefix);
      if (!fs.existsSync(dirPath)) {
        return null;
      }
      const files = await fs.promises.readdir(dirPath);
      const match = files.find((name) => name.startsWith(`${objectId}-`));
      if (!match) {
        return null;
      }
      return `${prefix}${match}`;
    } catch {
      return null;
    }
  }

  async deleteByKeys(orgId: string, keys: string[]): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    for (const key of keys) {
      if (!isKeyInOrg(key, orgId)) {
        throw new Error(
          `Tenant isolation violation: key '${key}' does not belong to organization '${orgId}'`,
        );
      }
      const filePath = this.resolveSafePath(key);
      try {
        await fs.promises.unlink(filePath);
        deletedCount++;
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
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

    const targetDirOrFile = this.resolveSafePath(prefix);
    let deletedCount = 0;

    try {
      const stat = await fs.promises.stat(targetDirOrFile);
      if (stat.isDirectory()) {
        const files = await fs.promises.readdir(targetDirOrFile, { recursive: true });
        deletedCount = files.length;
        await fs.promises.rm(targetDirOrFile, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(targetDirOrFile);
        deletedCount = 1;
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    return { deletedCount };
  }
}
