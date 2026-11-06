import { describe, expect, it } from 'vitest';
import { buildSnapshotStorageKey, isSnapshotKeyInOrg, isKeyInOrg } from '../storage-keys.js';

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
});
