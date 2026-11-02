import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
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
import { buildStorageKey, sanitizeFilename, validateFileExtension } from './storage-keys.js';
import {
  FileTooLargeException,
  InvalidFileContentException,
  StreamValidationTransform,
} from './storage-validation.js';
import type { AssignmentOwnershipPort } from './assignment-ownership.port.js';
import { verifyDownloadToken } from './local-fs-storage.adapter.js';

export interface StoredArtifact {
  objectId: string;
  key: string;
  orgId: string;
  assignmentId: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  uploaderId: string;
}

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
  /**
   * In-memory artifact registry for metadata tracking before the Sprint 4
   * app.submission_artifacts database table is migrated (Decision 2).
   */
  private readonly artifacts = new Map<string, StoredArtifact>();

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
    const artifactRecord: StoredArtifact = {
      objectId,
      key,
      orgId: user.orgId,
      assignmentId,
      filename: safeFilename,
      contentType: mimeType || 'application/octet-stream',
      size: putResult.size,
      sha256: putResult.sha256,
      uploadedAt: now,
      uploaderId: user.userId,
    };

    this.artifacts.set(objectId, artifactRecord);

    // Append-only audit log entry (BR-31)
    await this.auditLogService.log({
      actorId: user.userId,
      actorRole: user.role,
      orgId: user.orgId,
      action: 'storage.artifact.upload',
      entity: 'artifact',
      entityId: objectId,
      after: {
        org_id: user.orgId,
        assignment_id: assignmentId,
        object_id: objectId,
        filename: safeFilename,
        size_bytes: putResult.size,
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
   * Generates a download URL (GET /storage/download-url/:objectId).
   * Rejects candidate role (403).
   * Company admins can download their org's artifacts; other orgs return generic 404 (BR-01).
   * Platform admin downloads across orgs with an audited exception.
   */
  async createDownloadUrl(
    objectId: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    if (user.role === 'candidate') {
      throw problem({
        status: 403,
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Candidates cannot request artifact download URLs',
      });
    }

    const artifact = this.getArtifact(objectId);
    if (!artifact) {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    if (user.role === 'company_admin') {
      if (artifact.orgId !== user.orgId) {
        // Strict tenant isolation: cross-tenant access returns generic 404
        throw problem({
          status: 404,
          code: 'NOT_FOUND',
          title: 'Not Found',
          detail: 'Artifact not found',
        });
      }
    } else if (user.role === 'platform_admin') {
      // Platform admin audited exception (BR-31)
      await this.auditLogService.log({
        actorId: user.userId,
        actorRole: 'platform_admin',
        orgId: artifact.orgId,
        action: 'storage.artifact.platform_download',
        entity: 'artifact',
        entityId: objectId,
        after: {
          org_id: artifact.orgId,
          actor_id: user.userId,
          object_id: objectId,
        },
      });
    }

    const url = await this.storagePort.createDownloadUrl(
      artifact.key,
      artifact.filename,
      artifact.contentType,
      PRESIGNED_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
    };
  }

  /**
   * Streams a download from the local storage adapter using an HMAC-SHA256 signed token.
   */
  async getDownloadStream(token: string): Promise<StorageGetResult> {
    if (!token || typeof token !== 'string') {
      throw problem({
        status: 400,
        code: 'INVALID_DOWNLOAD_TOKEN',
        title: 'Bad Request',
        detail: 'Download token is required',
      });
    }

    const payload = verifyDownloadToken(token, this.config.signingSecret);
    if (!payload) {
      throw problem({
        status: 400,
        code: 'INVALID_DOWNLOAD_TOKEN',
        title: 'Invalid Download Token',
        detail: 'Download token is invalid or expired',
      });
    }

    return this.storagePort.getStream(payload.key);
  }

  // Registry helper methods (used for tests and dev)
  public registerArtifact(artifact: StoredArtifact): void {
    this.artifacts.set(artifact.objectId, artifact);
  }

  public getArtifact(objectId: string): StoredArtifact | undefined {
    return this.artifacts.get(objectId);
  }

  public clearArtifacts(): void {
    this.artifacts.clear();
  }
}
