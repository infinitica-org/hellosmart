import { describe, expect, it } from 'vitest';
import {
  buildSnapshotStorageKey,
  isSnapshotKeyInOrg,
  buildSubmissionBundleKey,
  isSubmissionBundleKeyInOrg,
  isKeyInOrg,
} from '../storage-keys.js';

describe('snapshot-keys helpers (BR-01, BR-11)', () => {
  const validOrgId = 'a0000000-0000-4000-8000-000000000001';
  const otherOrgId = 'b0000000-0000-4000-8000-000000000002';
  const validAssignmentId = 'c0000000-0000-4000-8000-000000000003';
  const validTimestamp = '20261106T060000Z';

  describe('buildSnapshotStorageKey', () => {
    it('constructs correct snapshot key format without seq', () => {
      const key = buildSnapshotStorageKey(validOrgId, validAssignmentId, validTimestamp);
      expect(key).toBe(
        `snapshots/${validOrgId}/${validAssignmentId}/snap_${validTimestamp}.tar.gz`,
      );
    });

    it('constructs correct snapshot key format with seq', () => {
      const key = buildSnapshotStorageKey(validOrgId, validAssignmentId, validTimestamp, 42);
      expect(key).toBe(
        `snapshots/${validOrgId}/${validAssignmentId}/snap_${validTimestamp}_42.tar.gz`,
      );
    });

    it('rejects invalid or malformed orgId', () => {
      expect(() =>
        buildSnapshotStorageKey('invalid-uuid', validAssignmentId, validTimestamp),
      ).toThrow('Invalid organization ID for snapshot storage key');
      expect(() => buildSnapshotStorageKey('../escape', validAssignmentId, validTimestamp)).toThrow(
        'Invalid organization ID for snapshot storage key',
      );
    });

    it('rejects invalid or malformed assignmentId', () => {
      expect(() => buildSnapshotStorageKey(validOrgId, 'not-a-uuid', validTimestamp)).toThrow(
        'Invalid assignment ID for snapshot storage key',
      );
      expect(() => buildSnapshotStorageKey(validOrgId, '../../traversal', validTimestamp)).toThrow(
        'Invalid assignment ID for snapshot storage key',
      );
    });

    it('rejects empty or invalid timestamp', () => {
      expect(() => buildSnapshotStorageKey(validOrgId, validAssignmentId, '')).toThrow(
        'Invalid timestamp for snapshot storage key',
      );
      expect(() => buildSnapshotStorageKey(validOrgId, validAssignmentId, '???///')).toThrow(
        'Invalid timestamp for snapshot storage key',
      );
    });
  });

  describe('isSnapshotKeyInOrg', () => {
    it('accepts snapshot key belonging to the organization', () => {
      const key = `snapshots/${validOrgId}/${validAssignmentId}/snap_${validTimestamp}.tar.gz`;
      expect(isSnapshotKeyInOrg(key, validOrgId)).toBe(true);
    });

    it('rejects snapshot key belonging to a different organization', () => {
      const key = `snapshots/${validOrgId}/${validAssignmentId}/snap_${validTimestamp}.tar.gz`;
      expect(isSnapshotKeyInOrg(key, otherOrgId)).toBe(false);
    });

    it('rejects non-snapshot keys under storage/ root', () => {
      const submissionKey = `storage/${validOrgId}/submissions/${validAssignmentId}/file.pdf`;
      expect(isSnapshotKeyInOrg(submissionKey, validOrgId)).toBe(false);
      // But isKeyInOrg must still accept it!
      expect(isKeyInOrg(submissionKey, validOrgId)).toBe(true);
    });

    it('rejects keys containing path traversal or dangerous characters', () => {
      expect(isSnapshotKeyInOrg(`snapshots/${validOrgId}/../other/key.tar.gz`, validOrgId)).toBe(
        false,
      );
      expect(isSnapshotKeyInOrg(`snapshots/${validOrgId}/\0key.tar.gz`, validOrgId)).toBe(false);
      expect(isSnapshotKeyInOrg(`snapshots/${validOrgId}\\key.tar.gz`, validOrgId)).toBe(false);
    });

    it('returns false for empty or falsy inputs', () => {
      expect(isSnapshotKeyInOrg('', validOrgId)).toBe(false);
      expect(isSnapshotKeyInOrg(`snapshots/${validOrgId}/test.tar.gz`, '')).toBe(false);
    });
  });

  describe('buildSubmissionBundleKey', () => {
    it('constructs correct submission bundle key format', () => {
      const key = buildSubmissionBundleKey(validOrgId, validAssignmentId);
      expect(key).toBe(`submissions/${validOrgId}/${validAssignmentId}/final_bundle.tar.gz`);
    });

    it('rejects invalid or malformed orgId', () => {
      expect(() => buildSubmissionBundleKey('invalid-uuid', validAssignmentId)).toThrow(
        'Invalid organization ID for submission bundle key',
      );
      expect(() => buildSubmissionBundleKey('../escape', validAssignmentId)).toThrow(
        'Invalid organization ID for submission bundle key',
      );
    });

    it('rejects invalid or malformed assignmentId', () => {
      expect(() => buildSubmissionBundleKey(validOrgId, 'not-a-uuid')).toThrow(
        'Invalid assignment ID for submission bundle key',
      );
      expect(() => buildSubmissionBundleKey(validOrgId, '../../traversal')).toThrow(
        'Invalid assignment ID for submission bundle key',
      );
    });
  });

  describe('isSubmissionBundleKeyInOrg', () => {
    it('accepts submission bundle key belonging to the organization', () => {
      const key = `submissions/${validOrgId}/${validAssignmentId}/final_bundle.tar.gz`;
      expect(isSubmissionBundleKeyInOrg(key, validOrgId)).toBe(true);
    });

    it('rejects submission bundle key belonging to a different organization', () => {
      const key = `submissions/${validOrgId}/${validAssignmentId}/final_bundle.tar.gz`;
      expect(isSubmissionBundleKeyInOrg(key, otherOrgId)).toBe(false);
    });

    it('rejects keys from snapshots/ or storage/ roots', () => {
      const snapshotKey = `snapshots/${validOrgId}/${validAssignmentId}/snap_123.tar.gz`;
      const storageKey = `storage/${validOrgId}/submissions/${validAssignmentId}/file.pdf`;
      expect(isSubmissionBundleKeyInOrg(snapshotKey, validOrgId)).toBe(false);
      expect(isSubmissionBundleKeyInOrg(storageKey, validOrgId)).toBe(false);
    });

    it('rejects keys containing path traversal or dangerous characters', () => {
      expect(
        isSubmissionBundleKeyInOrg(
          `submissions/${validOrgId}/../other/final_bundle.tar.gz`,
          validOrgId,
        ),
      ).toBe(false);
      expect(
        isSubmissionBundleKeyInOrg(`submissions/${validOrgId}/\0final_bundle.tar.gz`, validOrgId),
      ).toBe(false);
      expect(
        isSubmissionBundleKeyInOrg(`submissions/${validOrgId}\\final_bundle.tar.gz`, validOrgId),
      ).toBe(false);
    });

    it('returns false for empty or falsy inputs', () => {
      expect(isSubmissionBundleKeyInOrg('', validOrgId)).toBe(false);
      expect(isSubmissionBundleKeyInOrg(`submissions/${validOrgId}/final_bundle.tar.gz`, '')).toBe(
        false,
      );
    });
  });
});
