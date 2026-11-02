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
  let mockAuditLogService: any;
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

  const config: StorageConfig = {
    driver: 'local',
    localRoot: '.storage',
    signingSecret,
    bucket: 'hs-test',
    region: 'us-east-1',
  };

  beforeEach(() => {
    fakeStorage = new FakeStorageAdapter();
    fakeOwnership = new FakeAssignmentOwnershipAdapter();
    auditLogs = [];

    mockAuditLogService = {
      log: vi.fn().mockImplementation(async (entry) => {
        auditLogs.push(entry);
        return { id: 'audit-1', ...entry };
      }),
    };

    service = new StorageService(fakeStorage, fakeOwnership, config, mockAuditLogService);

    fakeOwnership.grantOwnership(candidateUser.userId, candidateUser.orgId!, assignmentId);
  });

  describe('uploadArtifact', () => {
    it('successfully uploads valid artifact and emits audit entry with exact allowed keys', async () => {
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

      // Check audit event convention and exact payload keys (no filename or secrets)
      const auditEvent = auditLogs.find((l) => l.action === 'artifact.uploaded');
      expect(auditEvent).toBeDefined();
      expect(auditEvent.orgId).toBe(candidateUser.orgId);
      expect(auditEvent.actorId).toBe(candidateUser.userId);
      expect(auditEvent.actorRole).toBe('candidate');

      const payloadKeys = Object.keys(auditEvent.after).sort();
      const expectedKeys = [
        'actor_id',
        'assignment_id',
        'content_type',
        'object_id',
        'org_id',
        'role',
        'sha256',
        'size_bytes',
      ].sort();
      expect(payloadKeys).toEqual(expectedKeys);

      // Verify filename, tokens, and urls are NOT present
      expect(auditEvent.after).not.toHaveProperty('filename');
      expect(auditEvent.after).not.toHaveProperty('url');
      expect(auditEvent.after).not.toHaveProperty('token');
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

  describe('createDownloadUrl (Stateless Prefix Lookup)', () => {
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

    it('works across separate service instances, proving zero in-memory state', async () => {
      // Create a brand new StorageService instance with a new empty context
      const newService = new StorageService(
        fakeStorage,
        fakeOwnership,
        config,
        mockAuditLogService,
      );

      const res = await newService.createDownloadUrl(assignmentId, objectId, companyAdminUser);
      expect(res.url).toBeDefined();
      expect(res.expiresInSeconds).toBe(900);
    });

    it('rejects candidate role from requesting download URLs (403)', async () => {
      await expectHttpException(
        service.createDownloadUrl(assignmentId, objectId, candidateUser),
        403,
        /Candidates cannot request artifact download URLs/,
      );
    });

    it('allows company admin to download artifacts within own org', async () => {
      const res = await service.createDownloadUrl(assignmentId, objectId, companyAdminUser);
      expect(res.url).toBeDefined();
      expect(res.expiresInSeconds).toBe(900);
    });

    it('returns generic 404 for company admin requesting another orgs artifact (BR-01)', async () => {
      await expectHttpException(
        service.createDownloadUrl(assignmentId, objectId, otherCompanyAdmin),
        404,
        /Artifact not found/,
      );
    });

    it('returns generic 404 when assignmentId does not match (BR-01)', async () => {
      const wrongAssignment = '88888888-8888-4888-8888-888888888888';
      await expectHttpException(
        service.createDownloadUrl(wrongAssignment, objectId, companyAdminUser),
        404,
        /Artifact not found/,
      );
    });

    it('allows platform admin to download across orgs with targetOrgId and audited exception', async () => {
      const res = await service.createDownloadUrl(
        assignmentId,
        objectId,
        platformAdminUser,
        candidateUser.orgId!,
      );
      expect(res.url).toBeDefined();

      const audit = auditLogs.find((l) => l.action === 'artifact.platform_downloaded');
      expect(audit).toBeDefined();
      expect(audit.actorRole).toBe('platform_admin');
      expect(audit.actorId).toBe(platformAdminUser.userId);
      expect(audit.orgId).toBe(candidateUser.orgId);

      const payloadKeys = Object.keys(audit.after).sort();
      const expectedKeys = [
        'actor_id',
        'assignment_id',
        'object_id',
        'org_id',
        'role',
        'target_org_id',
      ].sort();
      expect(payloadKeys).toEqual(expectedKeys);
      expect(audit.after).not.toHaveProperty('url');
      expect(audit.after).not.toHaveProperty('token');
    });

    it('returns 404 for non-existent artifact', async () => {
      await expectHttpException(
        service.createDownloadUrl(
          assignmentId,
          '00000000-0000-4000-8000-000000000000',
          companyAdminUser,
        ),
        404,
        /Artifact not found/,
      );
    });
  });

  describe('getDownloadStream (Public Download Route Verification)', () => {
    it('returns generic 404 when STORAGE_DRIVER is not local', async () => {
      const s3ConfigService = new StorageService(
        fakeStorage,
        fakeOwnership,
        { ...config, driver: 's3' },
        mockAuditLogService,
      );

      await expectHttpException(
        s3ConfigService.getDownloadStream('some-token'),
        404,
        /Artifact not found/,
      );
    });

    it('returns the exact same generic 404 for invalid, malformed, expired, or tampered tokens', async () => {
      // 1. Malformed token
      await expectHttpException(
        service.getDownloadStream('malformed-token-string'),
        404,
        /Artifact not found/,
      );

      // 2. Expired token
      const expiredToken = signDownloadToken(
        {
          key: `storage/${candidateUser.orgId}/submissions/${assignmentId}/test.pdf`,
          orgId: candidateUser.orgId!,
          filename: 'test.pdf',
          contentType: 'application/pdf',
          expiresAt: Date.now() - 5000,
        },
        signingSecret,
      );
      await expectHttpException(service.getDownloadStream(expiredToken), 404, /Artifact not found/);

      // 3. Tampered signature token
      const validToken = signDownloadToken(
        {
          key: `storage/${candidateUser.orgId}/submissions/${assignmentId}/test.pdf`,
          orgId: candidateUser.orgId!,
          filename: 'test.pdf',
          contentType: 'application/pdf',
          expiresAt: Date.now() + 60000,
        },
        signingSecret,
      );
      const tamperedToken = `${validToken.split('.')[0]}.tamperedsig`;
      await expectHttpException(
        service.getDownloadStream(tamperedToken),
        404,
        /Artifact not found/,
      );

      // 4. Wrong-org / key mismatch token
      const wrongOrgToken = signDownloadToken(
        {
          key: `storage/different-org/submissions/${assignmentId}/test.pdf`,
          orgId: candidateUser.orgId!,
          filename: 'test.pdf',
          contentType: 'application/pdf',
          expiresAt: Date.now() + 60000,
        },
        signingSecret,
      );
      await expectHttpException(
        service.getDownloadStream(wrongOrgToken),
        404,
        /Artifact not found/,
      );
    });

    it('streams download for valid token and existing file', async () => {
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
  });
});
