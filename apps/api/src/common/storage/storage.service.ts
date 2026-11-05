import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { AuditLogService } from '../audit/audit-log.service.js';
import type { AuthenticatedUser } from '../constants/auth.constants.js';
import { problem } from '../errors/app-http.exception.js';
import { ASSIGNMENT_OWNERSHIP_PORT, STORAGE_CONFIG, STORAGE_PORT } from './storage.tokens.js';
import {
  MAX_FILE_SIZE_BYTES,
  PRESIGNED_URL_TTL_SECONDS,
  type StorageConfig,
  type StorageGetResult,
  type StoragePort,
  type StoragePutResult,
} from './storage.types.js';
import {
  buildStorageKey,
  extractMetadataFromKey,
  isKeyInOrg,
  sanitizeFilename,
  validateFileExtension,
} from './storage-keys.js';
import {
  FileTooLargeException,
  InvalidFileContentException,
  StreamValidationTransform,
} from './storage-validation.js';
import type { AssignmentOwnershipPort } from './assignment-ownership.port.js';
import { verifyDownloadToken } from './local-fs-storage.adapter.js';

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.zip': 'application/zip',
  '.tar.gz': 'application/gzip',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export interface UploadArtifactResult {
  objectId: string;
  key: string;
  filename: string;
  size: number;
  sha256: string;
  uploadedAt: string;
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
    @Inject(ASSIGNMENT_OWNERSHIP_PORT)
    private readonly assignmentOwnershipPort: AssignmentOwnershipPort,
    @Inject(STORAGE_CONFIG)
    private readonly config: StorageConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Candidate submission artifact upload (POST /storage/upload).
   * Validates role, assignment ownership, filename, magic bytes, 50MB size limit,
   * streams file to storage adapter, computes SHA-256, and logs append-only audit event.
   */
  async uploadArtifact(params: {
    assignmentId: string;
    fileStream: Readable;
    filename: string;
    mimeType: string;
    user: AuthenticatedUser;
  }): Promise<UploadArtifactResult> {
    const { assignmentId, fileStream, filename, mimeType, user } = params;

    if (user.role !== 'candidate') {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Only candidates can upload submission artifacts',
      });
    }

    if (!user.orgId) {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Candidate must belong to an organization',
      });
    }

    if (!assignmentId) {
      throw problem({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
        detail: 'assignmentId is required for artifact upload',
      });
    }

    // Verify candidate assignment ownership
    const isOwner = await this.assignmentOwnershipPort.verifyCandidateAssignmentOwnership(
      user.userId,
      user.orgId,
      assignmentId,
    );

    if (!isOwner) {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Candidate does not have an active session for this assignment',
      });
    }

    // Validate filename and extension
    const extCheck = validateFileExtension(filename);
    if (!extCheck.valid) {
      throw problem({
        status: 400,
        code: 'INVALID_FILE_TYPE',
        title: 'Invalid File Type',
        detail: extCheck.reason || 'File extension is not permitted',
      });
    }

    const safeFilename = sanitizeFilename(filename);
    const objectId = crypto.randomUUID();
    const key = buildStorageKey(user.orgId, assignmentId, objectId, safeFilename);

    // Stream through validation transform (50MB cap + magic bytes verification)
    const validator = new StreamValidationTransform(MAX_FILE_SIZE_BYTES, extCheck.extension);
    let putResult: StoragePutResult;

    try {
      const streamToPass = fileStream.pipe(validator);
      putResult = await this.storagePort.put(key, streamToPass, {
        contentType: mimeType || 'application/octet-stream',
        filename: safeFilename,
        orgId: user.orgId,
        assignmentId,
        objectId,
      });
    } catch (err: any) {
      if (err instanceof FileTooLargeException || err.name === 'FileTooLargeException') {
        throw problem({
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          title: 'Payload Too Large',
          detail: 'Submission artifact exceeds 50MB limit',
        });
      }
      if (
        err instanceof InvalidFileContentException ||
        err.name === 'InvalidFileContentException'
      ) {
        throw problem({
          status: 400,
          code: 'FILE_SIGNATURE_MISMATCH',
          title: 'Invalid File Content',
          detail: err.message,
        });
      }
      throw err;
    }

    const now = new Date().toISOString();

    // Append-only audit log entry (BR-31). Filename excluded from audit payload.
    await this.auditLogService.log({
      actorId: user.userId,
      actorRole: user.role,
      orgId: user.orgId,
      action: 'artifact.uploaded',
      entity: 'artifact',
      entityId: objectId,
      after: {
        org_id: user.orgId,
        actor_id: user.userId,
        role: user.role,
        assignment_id: assignmentId,
        object_id: objectId,
        size_bytes: putResult.size,
        content_type: mimeType || 'application/octet-stream',
        sha256: putResult.sha256,
      },
    });

    return {
      objectId,
      key,
      filename: safeFilename,
      size: putResult.size,
      sha256: putResult.sha256,
      uploadedAt: now,
    };
  }

  /**
   * Generates a download URL (GET /storage/download-url/:assignmentId/:objectId).
   * Stateless lookup: resolves the storage key using findKeyByObjectId prefix scan.
   * Rejects candidate role (403).
   * Company admins can download their org's artifacts; other orgs return generic 404 (BR-01).
   * Platform admin downloads across orgs with an audited exception.
   */
  async createDownloadUrl(
    assignmentId: string,
    objectId: string,
    user: AuthenticatedUser,
    targetOrgId?: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    if (user.role === 'candidate') {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Candidates cannot request artifact download URLs',
      });
    }

    let effectiveOrgId: string;
    if (user.role === 'company_admin') {
      if (!user.orgId) {
        throw problem({
          status: 404,
          code: 'NOT_FOUND',
          title: 'Not Found',
          detail: 'Artifact not found',
        });
      }
      if (targetOrgId && targetOrgId !== user.orgId) {
        // Cross-org returns generic 404 per BR-01
        throw problem({
          status: 404,
          code: 'NOT_FOUND',
          title: 'Not Found',
          detail: 'Artifact not found',
        });
      }
      effectiveOrgId = user.orgId;
    } else if (user.role === 'platform_admin') {
      effectiveOrgId = targetOrgId || user.orgId || '';
      if (!effectiveOrgId) {
        throw problem({
          status: 400,
          code: 'BAD_REQUEST',
          title: 'Bad Request',
          detail: 'orgId query parameter is required for platform admin download URL requests',
        });
      }
    } else {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Forbidden',
      });
    }

    // Stateless key resolution from storage prefix
    const key = await this.storagePort.findKeyByObjectId(effectiveOrgId, assignmentId, objectId);

    if (!key || !isKeyInOrg(key, effectiveOrgId)) {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    const meta = extractMetadataFromKey(key);
    const filename = meta?.filename ?? 'deliverable.bin';
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPE_BY_EXTENSION[ext] ?? 'application/octet-stream';

    if (user.role === 'platform_admin') {
      // Platform admin audited exception (BR-31)
      await this.auditLogService.log({
        actorId: user.userId,
        actorRole: 'platform_admin',
        orgId: effectiveOrgId,
        action: 'artifact.platform_downloaded',
        entity: 'artifact',
        entityId: objectId,
        after: {
          org_id: effectiveOrgId,
          actor_id: user.userId,
          role: 'platform_admin',
          assignment_id: assignmentId,
          object_id: objectId,
          target_org_id: effectiveOrgId,
        },
      });
    }

    const url = await this.storagePort.createDownloadUrl(
      key,
      filename,
      contentType,
      PRESIGNED_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
    };
  }

  /**
   * Streams a download from the local storage adapter using an HMAC-SHA256 signed token.
   * Returns generic 404 for non-local drivers, missing/expired/tampered/wrong-org tokens.
   */
  async getDownloadStream(token: string): Promise<StorageGetResult> {
    if (this.config.driver !== 'local') {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    if (!token || typeof token !== 'string') {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    const payload = verifyDownloadToken(token, this.config.signingSecret);
    if (!payload || !isKeyInOrg(payload.key, payload.orgId)) {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    const exists = await this.storagePort.exists(payload.key);
    if (!exists) {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    return this.storagePort.getStream(payload.key);
  }
}
