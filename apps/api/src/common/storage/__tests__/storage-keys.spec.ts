import { describe, expect, it } from 'vitest';
import {
  ALLOWED_EXTENSIONS,
  buildStorageKey,
  DANGEROUS_EXTENSIONS,
  extractMetadataFromKey,
  extractOrgIdFromKey,
  isKeyInOrg,
  sanitizeFilename,
  validateFileExtension,
} from '../storage-keys.js';

describe('storage-keys', () => {
  describe('sanitizeFilename', () => {
    it('strips POSIX directory traversal sequences', () => {
      const sanitized = sanitizeFilename('../../../etc/passwd.pdf');
      expect(sanitized).toBe('passwd.pdf');
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
    });

    it('strips Windows directory traversal sequences', () => {
      const sanitized = sanitizeFilename('..\\..\\windows\\system32\\cmd.pdf');
      expect(sanitized).toBe('cmd.pdf');
      expect(sanitized).not.toContain('\\');
    });

    it('strips null bytes and control characters', () => {
      const sanitized = sanitizeFilename('deliverable\x00\x01\x1f.docx');
      expect(sanitized).toBe('deliverable.docx');
      expect(sanitized).not.toContain('\x00');
    });

    it('strips leading dots to prevent hidden files', () => {
      const sanitized = sanitizeFilename('...hidden_file.txt');
      expect(sanitized).toBe('hidden_file.txt');
      expect(sanitized.startsWith('.')).toBe(false);
    });

    it('handles compound extensions like .tar.gz cleanly', () => {
      const sanitized = sanitizeFilename('archive.tar.gz');
      expect(sanitized).toBe('archive.tar.gz');
    });

    it('truncates overly long filenames while preserving the extension', () => {
      const longName = 'a'.repeat(200) + '.pdf';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.endsWith('.pdf')).toBe(true);
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });

    it('provides fallback name when stem becomes empty', () => {
      const sanitized = sanitizeFilename('....___');
      expect(sanitized).toBe('deliverable');
    });
  });

  describe('validateFileExtension', () => {
    it('accepts all allowed deliverable extensions', () => {
      for (const ext of ALLOWED_EXTENSIONS) {
        const result = validateFileExtension(`deliverable${ext}`);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects all dangerous extensions including .svg and macro formats', () => {
      for (const ext of DANGEROUS_EXTENSIONS) {
        const result = validateFileExtension(`malicious${ext}`);
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });

    it('rejects dangerous double extensions', () => {
      const result1 = validateFileExtension('report.pdf.exe');
      expect(result1.valid).toBe(false);
      expect(result1.reason).toContain('Dangerous');

      const result2 = validateFileExtension('diagram.png.sh');
      expect(result2.valid).toBe(false);
    });

    it('rejects files ending in dot or space', () => {
      expect(validateFileExtension('file.pdf.').valid).toBe(false);
      expect(validateFileExtension('file.pdf ').valid).toBe(false);
    });

    it('rejects files missing an extension', () => {
      expect(validateFileExtension('noextensionfile').valid).toBe(false);
    });
  });

  describe('buildStorageKey', () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const assignmentId = '22222222-2222-4222-8222-222222222222';
    const objectId = '33333333-3333-4333-8333-333333333333';

    it('constructs tenant-isolated key format', () => {
      const key = buildStorageKey(orgId, assignmentId, objectId, 'final_deliverable.pdf');
      expect(key).toBe(
        `storage/${orgId}/submissions/${assignmentId}/${objectId}-final_deliverable.pdf`,
      );
    });

    it('rejects invalid UUID formats to prevent directory injection', () => {
      expect(() => buildStorageKey('invalid-org', assignmentId, objectId, 'test.pdf')).toThrow();
      expect(() => buildStorageKey(orgId, '../traversal', objectId, 'test.pdf')).toThrow();
      expect(() => buildStorageKey(orgId, assignmentId, 'bad-obj', 'test.pdf')).toThrow();
    });
  });

  describe('isKeyInOrg', () => {
    const orgId = '11111111-1111-4111-8111-111111111111';
    const otherOrgId = '99999999-9999-4999-8999-999999999999';

    it('returns true when key belongs to orgId', () => {
      const key = `storage/${orgId}/submissions/assignment-1/file.pdf`;
      expect(isKeyInOrg(key, orgId)).toBe(true);
    });

    it('returns false when key belongs to different orgId (BR-01)', () => {
      const key = `storage/${otherOrgId}/submissions/assignment-1/file.pdf`;
      expect(isKeyInOrg(key, orgId)).toBe(false);
    });

    it('returns false for traversal or malformed keys', () => {
      expect(isKeyInOrg(`storage/${orgId}/../secrets`, orgId)).toBe(false);
      expect(isKeyInOrg(`storage/${orgId}\0malicious`, orgId)).toBe(false);
    });
  });

  describe('extractMetadataFromKey', () => {
    it('correctly extracts orgId, assignmentId, objectId, and filename', () => {
      const orgId = '11111111-1111-4111-8111-111111111111';
      const assignmentId = '22222222-2222-4222-8222-222222222222';
      const objectId = '33333333-3333-4333-8333-333333333333';
      const filename = 'code.tar.gz';
      const key = `storage/${orgId}/submissions/${assignmentId}/${objectId}-${filename}`;

      const meta = extractMetadataFromKey(key);
      expect(meta).toEqual({
        orgId,
        assignmentId,
        objectId,
        filename,
      });

      expect(extractOrgIdFromKey(key)).toBe(orgId);
    });

    it('returns null for keys not matching format', () => {
      expect(extractMetadataFromKey('other/path/file.txt')).toBeNull();
      expect(extractOrgIdFromKey('other/path/file.txt')).toBeNull();
    });
  });
});
