import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageController } from '../storage.controller.js';
import type { StorageService } from '../storage.service.js';
import type { AuthenticatedUser } from '../../constants/auth.constants.js';
import { Readable } from 'node:stream';

describe('StorageController', () => {
  let controller: StorageController;
  let mockService: Partial<StorageService>;

  const candidateUser: AuthenticatedUser = {
    userId: 'c1111111-1111-4111-8111-111111111111',
    orgId: '11111111-1111-4111-8111-111111111111',
    role: 'candidate',
    email: 'candidate@test.com',
  };

  const companyAdminUser: AuthenticatedUser = {
    userId: 'a1111111-1111-4111-8111-111111111111',
    orgId: '11111111-1111-4111-8111-111111111111',
    role: 'company_admin',
    email: 'admin@test.com',
  };

  const platformAdminUser: AuthenticatedUser = {
    userId: 'p1111111-1111-4111-8111-111111111111',
    orgId: null,
    role: 'platform_admin',
    email: 'ops@hellosmart.ai',
  };

  beforeEach(() => {
    mockService = {
      uploadArtifact: vi.fn().mockResolvedValue({
        objectId: 'obj-123',
        key: 'storage/11111111-1111-4111-8111-111111111111/submissions/assignment-123/obj-123-file.pdf',
        filename: 'file.pdf',
        size: 1024,
        sha256: 'abc123sha',
        uploadedAt: new Date().toISOString(),
      }),
      createDownloadUrl: vi.fn().mockResolvedValue({
        url: 'https://download.local/test.pdf',
        expiresInSeconds: 900,
      }),
      getDownloadStream: vi.fn().mockResolvedValue({
        stream: Readable.from(['content']),
        contentType: 'application/pdf',
        filename: 'test.pdf',
        size: 7,
      }),
    };

    controller = new StorageController(mockService as StorageService);
  });

  describe('upload', () => {
    it('rejects non-multipart requests with 400', async () => {
      const mockReq = {
        isMultipart: () => false,
      } as any;

      try {
        await controller.upload(mockReq, candidateUser, 'assignment-1');
        expect.fail('Expected upload to throw');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(400);
        expect(err.getResponse?.()?.detail).toContain('Request must be multipart/form-data');
      }
    });

    it('rejects multipart requests with no file part with 400', async () => {
      const mockReq = {
        isMultipart: () => true,
        file: async () => null,
      } as any;

      try {
        await controller.upload(mockReq, candidateUser, 'assignment-1');
        expect.fail('Expected upload to throw');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(400);
        expect(err.getResponse?.()?.detail).toContain('No file part found');
      }
    });

    it('processes valid multipart file and calls storageService.uploadArtifact', async () => {
      const mockFilePart = {
        file: Readable.from(['dummy']),
        filename: 'report.pdf',
        mimetype: 'application/pdf',
        fields: {
          assignmentId: { value: 'assignment-123' },
        },
      };

      const mockReq = {
        isMultipart: () => true,
        file: async () => mockFilePart,
      } as any;

      const res = await controller.upload(mockReq, candidateUser);
      expect(res.objectId).toBe('obj-123');
      expect(mockService.uploadArtifact).toHaveBeenCalledWith({
        assignmentId: 'assignment-123',
        fileStream: mockFilePart.file,
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        user: candidateUser,
      });
    });
  });

  describe('getDownloadUrl', () => {
    it('calls storageService.createDownloadUrl with assignmentId and objectId for company admin', async () => {
      const res = await controller.getDownloadUrl(
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        companyAdminUser,
      );
      expect(res.url).toBe('https://download.local/test.pdf');
      expect(res.expiresInSeconds).toBe(900);
      expect(mockService.createDownloadUrl).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        companyAdminUser,
        undefined,
      );
    });

    it('forwards optional orgId query parameter for platform admin', async () => {
      const targetOrgId = '44444444-4444-4444-8444-444444444444';
      await controller.getDownloadUrl(
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        platformAdminUser,
        targetOrgId,
      );
      expect(mockService.createDownloadUrl).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        platformAdminUser,
        targetOrgId,
      );
    });
  });

  describe('download', () => {
    it('streams response with strict security headers (nosniff, attachment, no-store, no cookies)', async () => {
      const headers: Record<string, string> = {};
      const mockReply = {
        header: (name: string, val: string) => {
          headers[name] = val;
        },
        send: vi.fn().mockImplementation((stream) => stream),
      } as any;

      await controller.download('token123', mockReply);

      expect(headers['Content-Type']).toBe('application/pdf');
      expect(headers['Content-Disposition']).toBe('attachment; filename="test.pdf"');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Cache-Control']).toBe('no-store');
      expect(headers['Set-Cookie']).toBeUndefined();
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('returns generic 404 when download stream lookup fails or token is rejected', async () => {
      vi.mocked(mockService.getDownloadStream!).mockRejectedValue(new Error('Invalid token'));

      const mockReply = {
        header: vi.fn(),
        send: vi.fn(),
      } as any;

      try {
        await controller.download('bad-token', mockReply);
        expect.fail('Expected download to throw 404');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(404);
        expect(err.getResponse?.()?.detail).toBe('Artifact not found');
      }
    });
  });
});
