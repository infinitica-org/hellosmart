import { Readable } from 'node:stream';
import type { StoragePort, StoragePutResult } from '../../common/storage/storage.types.js';
import { isSubmissionBundleKeyInOrg } from '../../common/storage/storage-keys.js';

export interface BundlePutMeta {
  orgId: string;
  assignmentId: string;
  expectedSha256?: string;
  contentType?: string;
}

export const MAX_RETRY_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 100;

/**
 * Uploads a submission bundle to storage with tenant verification, SHA-256 integrity check,
 * and exponential backoff retry. Does not modify 9.1 files.
 */
export async function putVerifiedBundle(
  storagePort: StoragePort,
  key: string,
  buffer: Buffer,
  meta: BundlePutMeta,
  sleeper: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<StoragePutResult> {
  // BR-01: Tenant isolation check for submissions/ root
  if (!isSubmissionBundleKeyInOrg(key, meta.orgId)) {
    throw new Error(
      `Tenant isolation violation: submission bundle key '${key}' does not belong to organization '${meta.orgId}'`,
    );
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_RETRY_ATTEMPTS) {
    attempt++;
    try {
      const stream = Readable.from(buffer);
      const result = await storagePort.put(key, stream, {
        orgId: meta.orgId,
        assignmentId: meta.assignmentId,
        objectId: 'final_bundle',
        filename: 'final_bundle.tar.gz',
        contentType: meta.contentType ?? 'application/gzip',
      });

      if (meta.expectedSha256 && result.sha256 !== meta.expectedSha256) {
        throw new Error(
          `Integrity verification failed: uploaded SHA256 '${result.sha256}' does not match expected '${meta.expectedSha256}'`,
        );
      }

      // Verify existence
      const exists = await storagePort.exists(key);
      if (!exists) {
        throw new Error(`Storage verification failed: key '${key}' does not exist after PutObject`);
      }

      return result;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRY_ATTEMPTS) {
        // Exponential backoff with jitter
        const delay = Math.round(
          BASE_BACKOFF_MS * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4),
        );
        await sleeper(delay);
      }
    }
  }

  throw new Error(
    `Failed to upload verified submission bundle to '${key}' after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`,
  );
}
