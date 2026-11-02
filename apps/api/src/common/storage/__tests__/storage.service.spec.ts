import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { StorageService } from '../storage.service.js';
import { FakeStorageAdapter } from '../fake-storage.adapter.js';
import { FakeAssignmentOwnershipAdapter } from '../assignment-ownership.port.js';
import type { StorageConfig } from '../storage.types.js';
import type { AuthenticatedUser } from '../../constants/auth.constants.js';
import { signDownloadToken } from '../local-fs-storage.adapter.js';

async function expectHttpException(
  promise: Promise<any>,
  expectedStatus: number,
  expectedDetailRegex?: RegExp,
) {
  try {
    await promise;
    expect.fail(`Expected promise to throw HttpException with status ${expectedStatus}`);
  } catch (err: any) {
    expect(err.getStatus?.()).toBe(expectedStatus);
    if (expectedDetailRegex) {
      expect(err.getResponse?.()?.detail).toMatch(expectedDetailRegex);
    }
  }
}

describe('StorageService', () => {
  let service: StorageService;
  let fakeStorage: FakeStorageAdapter;
  let fakeOwnership: FakeAssignmentOwnershipAdapter;
  let auditLogs: any[] = [];
  const signingSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';

  const candidateUser: AuthenticatedUser = {
    userId: 'c1111111-1111-4111-8111-111111111111',
    orgId: 'aaaaaaaa-1111-4111-8111-111111111111',
    role: 'candidate',
    email: 'candidate@test.com',
  };

  const companyAdminUser: AuthenticatedUser = {
    userId: 'a1111111-1111-4111-8111-111111111111',
    orgId: 'aaaaaaaa-1111-4111-8111-111111111111',
    role: 'company_admin',
    email: 'admin@test.com',
  };

  const otherCompanyAdmin: AuthenticatedUser = {
    userId: 'a2222222-2222-4222-8222-222222222222',
    orgId: 'bbbbbbbb-2222-4222-8222-222222222222',
    role: 'company_admin',
    email: 'otheradmin@test.com',
  };

  const platformAdminUser: AuthenticatedUser = {
    userId: 'p1111111-1111-4111-8111-111111111111',
    orgId: null,
    role: 'platform_admin',
    email: 'platform@hellosmart.ai',
  };

  const assignmentId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    fakeStorage = new FakeStorageAdapter();
    fakeOwnership = new FakeAssignmentOwnershipAdapter();
    auditLogs = [];

    const mockAuditLogService = {
      log: vi.fn().mockImplementation(async (entry) => {
        auditLogs.push(entry);
        return { id: 'audit-1', ...entry };
      }),
    };

    const config: StorageConfig = {
      driver: 'fake',
      localRoot: '.storage',
      signingSecret,
      bucket: 'hs-test',
      region: 'us-east-1',
    };

    service = new StorageService(fakeStorage, fakeOwnership, config, mockAuditLogService as any);

    // Register active assignment ownership
    fakeOwnership.grantOwnership(candidateUser.userId, candidateUser.orgId!, assignmentId);
  });

  describe('uploadArtifact', () => {
    it('successfully uploads valid artifact and emits audit entry', async () => {
      const validPdf = Buffer.from('%PDF-1.7\nSample content');
      const result = await service.uploadArtifact({
        assignmentId,
        fileStream: Readable.from([validPdf]),
        filename: 'my_submission.pdf',
        mimeType: 'application/pdf',
        user: candidateUser,
      });

      expect(result.objectId).toBeDefined();
      expect(result.key).toContain(`storage/${candidateUser.orgId}/submissions/${assignmentId}/`);
      expect(result.filename).toBe('my_submission.pdf');
      expect(result.size).toBe(validPdf.length);
      expect(result.sha256).toBeDefined();

      // Check audit event
      const auditEvent = auditLogs.find((l) => l.action === 'storage.artifact.upload');
      expect(auditEvent).toBeDefined();
      expect(auditEvent.orgId).toBe(candidateUser.orgId);
      expect(auditEvent.after.object_id).toBe(result.objectId);
      expect(auditEvent.after.size_bytes).toBe(validPdf.length);
      expect(auditEvent.after.sha256).toBe(result.sha256);
    });

    it('rejects uploads from non-candidate roles with 403', async () => {
      await expectHttpException(
        service.uploadArtifact({
          assignmentId,
          fileStream: Readable.from(['content']),
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          user: companyAdminUser,
        }),
        403,
        /Only candidates can upload/,
      );
    });

    it('rejects candidates without valid assignment ownership with 403', async () => {
      const otherAssignment = '99999999-9999-4999-8999-999999999999';
      await expectHttpException(
        service.uploadArtifact({
          assignmentId: otherAssignment,
          fileStream: Readable.from(['%PDF-1.4']),
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          user: candidateUser,
        }),
        403,
        /Candidate does not have an active session/,
      );
    });

    it('rejects disallowed file extensions (.exe, .svg) with 400', async () => {
      await expectHttpException(
        service.uploadArtifact({
          assignmentId,
          fileStream: Readable.from(['malicious']),
          filename: 'script.sh',
          mimeType: 'application/x-sh',
          user: candidateUser,
        }),
        400,
        /extension/i,
      );

      await expectHttpException(
        service.uploadArtifact({
          assignmentId,
          fileStream: Readable.from(['<svg></svg>']),
          filename: 'image.svg',
          mimeType: 'image/svg+xml',
          user: candidateUser,
        }),
        400,
        /extension/i,
      );
    });

    it('rejects magic bytes mismatch with 400', async () => {
      const fakePdf = Buffer.from('NOT_A_PDF_CONTENT');
      await expectHttpException(
        service.uploadArtifact({
          assignmentId,
          fileStream: Readable.from([fakePdf]),
          filename: 'fake.pdf',
          mimeType: 'application/pdf',
          user: candidateUser,
        }),
        400,
        /File signature does not match/i,
      );
    });
  });

  describe('createDownloadUrl', () => {
    let objectId: string;

    beforeEach(async () => {
      const validPdf = Buffer.from('%PDF-1.7\nSample deliverable');
      const upload = await service.uploadArtifact({
        assignmentId,
        fileStream: Readable.from([validPdf]),
        filename: 'final.pdf',
        mimeType: 'application/pdf',
        user: candidateUser,
      });
      objectId = upload.objectId;
    });

    it('rejects candidate role from requesting download URLs (403)', async () => {
      await expectHttpException(
        service.createDownloadUrl(objectId, candidateUser),
        403,
        /Candidates cannot request artifact download URLs/,
      );
    });

    it('allows company admin to download artifacts within own org', async () => {
      const res = await service.createDownloadUrl(objectId, companyAdminUser);
      expect(res.url).toBeDefined();
      expect(res.expiresInSeconds).toBe(900);
    });

    it('returns generic 404 for company admin requesting another orgs artifact (BR-01)', async () => {
      await expectHttpException(
        service.createDownloadUrl(objectId, otherCompanyAdmin),
        404,
        /Artifact not found/,
      );
    });

    it('allows platform admin to download across orgs with an audited exception', async () => {
      const res = await service.createDownloadUrl(objectId, platformAdminUser);
      expect(res.url).toBeDefined();

      const audit = auditLogs.find((l) => l.action === 'storage.artifact.platform_download');
      expect(audit).toBeDefined();
      expect(audit.actorRole).toBe('platform_admin');
      expect(audit.after.org_id).toBe(candidateUser.orgId);
      expect(audit.after.object_id).toBe(objectId);
    });

    it('returns 404 for non-existent artifact', async () => {
      await expectHttpException(
        service.createDownloadUrl('00000000-0000-4000-8000-000000000000', companyAdminUser),
        404,
        /Artifact not found/,
      );
    });
  });

  describe('getDownloadStream', () => {
    it('verifies valid signed token and returns stream', async () => {
      const key = `storage/${candidateUser.orgId}/submissions/${assignmentId}/test-report.pdf`;
      await fakeStorage.put(key, Readable.from(['deliverable']), {
        contentType: 'text/plain',
        filename: 'test-report.pdf',
        orgId: candidateUser.orgId!,
        assignmentId,
        objectId: 'obj-1',
      });

      const token = signDownloadToken(
        {
          key,
          orgId: candidateUser.orgId!,
          filename: 'test-report.pdf',
          contentType: 'text/plain',
          expiresAt: Date.now() + 60000,
        },
        signingSecret,
      );

      const streamRes = await service.getDownloadStream(token);
      expect(streamRes.stream).toBeDefined();
    });

    it('rejects invalid or expired token with 400', async () => {
      await expectHttpException(
        service.getDownloadStream('invalid.token.here'),
        400,
        /Download token is invalid or expired/,
      );
    });
  });
});
