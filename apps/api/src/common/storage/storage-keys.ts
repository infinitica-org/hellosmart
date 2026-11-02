import path from 'node:path';
import { MAX_FILENAME_LENGTH } from './storage.types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ALLOWED_EXTENSIONS = new Set<string>([
  '.zip',
  '.tar.gz',
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.csv',
  '.xlsx',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
]);

export const DANGEROUS_EXTENSIONS = new Set<string>([
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.dll',
  '.apk',
  '.app',
  '.bin',
  '.svg', // Explicitly blocked per Decision 5 (stored XSS risk)
  '.docm',
  '.xlsm',
]);

export const ALLOWED_MIME_TYPES = new Set<string>([
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'image/png',
  'image/jpeg',
]);

/**
 * Normalizes and sanitizes untrusted candidate filenames.
 * Strips path separators, control characters, leading dots, and double extensions.
 */
export function sanitizeFilename(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return 'deliverable.bin';
  }

  // 1. Unicode normalization (NFKC)
  let name = raw.normalize('NFKC');

  // 2. Strip directory components from both POSIX and Windows paths
  name = name.replace(/\\/g, '/');
  name = path.basename(name);

  // 3. Strip control characters and null bytes
  name = name.replace(/[\x00-\x1f\x7f]/g, '');

  // 4. Strip leading dots (prevent hidden files / dotfiles)
  name = name.replace(/^\.+/, '');

  // 5. Replace characters outside safe set [a-zA-Z0-9._-] with underscore
  name = name.replace(/[^a-zA-Z0-9._-]/g, '_');

  // 6. Collapse consecutive underscores
  name = name.replace(/_{2,}/g, '_');

  // 7. Extract compound extension (.tar.gz) or single extension
  let ext = '';
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz')) {
    ext = '.tar.gz';
    name = name.slice(0, -7);
  } else {
    const extMatch = name.match(/\.[a-zA-Z0-9]+$/);
    if (extMatch) {
      ext = extMatch[0];
      name = name.slice(0, -ext.length);
    }
  }

  // 8. If stem is empty after sanitization, assign fallback stem
  name = name.replace(/^_+|_+$/g, '');
  if (!name) {
    name = 'deliverable';
  }

  // 9. Enforce max length constraint (preserving extension)
  const maxStemLength = Math.max(1, MAX_FILENAME_LENGTH - ext.length);
  if (name.length > maxStemLength) {
    name = name.slice(0, maxStemLength);
  }

  return `${name}${ext}`;
}

/**
 * Checks whether a filename contains dangerous extensions or disallowed formats.
 */
export function validateFileExtension(filename: string): {
  valid: boolean;
  extension: string;
  reason?: string;
} {
  const trimmed = filename.trim();
  if (filename.endsWith(' ') || filename.endsWith('.')) {
    return {
      valid: false,
      extension: '',
      reason: 'Filenames ending in a dot or space are rejected',
    };
  }

  const lower = trimmed.toLowerCase();

  // Check compound extension first (.tar.gz)
  let matchedExt = '';
  if (lower.endsWith('.tar.gz')) {
    matchedExt = '.tar.gz';
  } else {
    const extMatch = lower.match(/\.[a-z0-9]+$/);
    matchedExt = extMatch ? extMatch[0] : '';
  }

  if (!matchedExt) {
    return { valid: false, extension: '', reason: 'Missing file extension' };
  }

  // Check dangerous extension list
  if (DANGEROUS_EXTENSIONS.has(matchedExt)) {
    return {
      valid: false,
      extension: matchedExt,
      reason: `Dangerous file extension '${matchedExt}' is prohibited`,
    };
  }

  // Check for dangerous double extensions (e.g. file.pdf.exe or file.png.sh)
  const dotParts = lower.split('.');
  if (dotParts.length > 2) {
    for (let i = 1; i < dotParts.length; i++) {
      const partExt = `.${dotParts[i]}`;
      if (DANGEROUS_EXTENSIONS.has(partExt)) {
        return {
          valid: false,
          extension: matchedExt,
          reason: `Dangerous embedded extension '${partExt}' detected in filename`,
        };
      }
    }
  }

  // Verify extension is on the allowlist
  if (!ALLOWED_EXTENSIONS.has(matchedExt)) {
    return {
      valid: false,
      extension: matchedExt,
      reason: `File extension '${matchedExt}' is not in the allowed deliverables list`,
    };
  }

  return { valid: true, extension: matchedExt };
}

/**
 * Constructs a tenant-isolated storage key:
 * storage/{org_id}/submissions/{assignment_id}/{object_id}-{safe_filename}
 */
export function buildStorageKey(
  orgId: string,
  assignmentId: string,
  objectId: string,
  safeFilename: string,
): string {
  if (!orgId || !UUID_REGEX.test(orgId)) {
    throw new Error('Invalid organization ID for storage key');
  }
  if (!assignmentId || !UUID_REGEX.test(assignmentId)) {
    throw new Error('Invalid assignment ID for storage key');
  }
  if (!objectId || !UUID_REGEX.test(objectId)) {
    throw new Error('Invalid object ID for storage key');
  }

  const sanitized = sanitizeFilename(safeFilename);
  return `storage/${orgId}/submissions/${assignmentId}/${objectId}-${sanitized}`;
}

/**
 * BR-01: Verifies that a storage key strictly belongs to the caller's organization.
 */
export function isKeyInOrg(key: string, orgId: string): boolean {
  if (!key || !orgId) {
    return false;
  }
  if (key.includes('..') || key.includes('\0') || key.includes('\\')) {
    return false;
  }
  const prefix = `storage/${orgId}/`;
  return key.startsWith(prefix);
}

const STORAGE_KEY_PATTERN =
  /^storage\/([0-9a-f-]{36})\/submissions\/([0-9a-f-]{36})\/([0-9a-f-]{36})-(.+)$/;

export interface StorageKeyMetadata {
  orgId: string;
  assignmentId: string;
  objectId: string;
  filename: string;
}

/**
 * Parses and extracts metadata components from a valid storage key.
 */
export function extractMetadataFromKey(key: string): StorageKeyMetadata | null {
  if (!key || typeof key !== 'string') {
    return null;
  }
  const match = key.match(STORAGE_KEY_PATTERN);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    return null;
  }
  return {
    orgId: match[1],
    assignmentId: match[2],
    objectId: match[3],
    filename: match[4],
  };
}

/**
 * Extracts organization ID from a tenant-scoped storage key.
 */
export function extractOrgIdFromKey(key: string): string | null {
  const meta = extractMetadataFromKey(key);
  return meta?.orgId ?? null;
}
