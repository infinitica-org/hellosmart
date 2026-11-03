import { describe, expect, it } from 'vitest';
import {
  FailClosedAssignmentOwnershipAdapter,
  FakeAssignmentOwnershipAdapter,
} from '../assignment-ownership.port.js';

describe('AssignmentOwnershipPort', () => {
  describe('FailClosedAssignmentOwnershipAdapter', () => {
    it('fails closed and returns false by default', async () => {
      const adapter = new FailClosedAssignmentOwnershipAdapter();
      const isOwner = await adapter.verifyCandidateAssignmentOwnership(
        'candidate-1',
        'org-1',
        'assignment-1',
      );
      expect(isOwner).toBe(false);
    });
  });

  describe('FakeAssignmentOwnershipAdapter', () => {
    it('grants and verifies active candidate assignments in tests', async () => {
      const adapter = new FakeAssignmentOwnershipAdapter();
      const candidateId = 'candidate-1';
      const orgId = 'org-1';
      const assignmentId = 'assignment-1';

      expect(
        await adapter.verifyCandidateAssignmentOwnership(candidateId, orgId, assignmentId),
      ).toBe(false);

      adapter.grantOwnership(candidateId, orgId, assignmentId);

      expect(
        await adapter.verifyCandidateAssignmentOwnership(candidateId, orgId, assignmentId),
      ).toBe(true);

      // Different org returns false
      expect(
        await adapter.verifyCandidateAssignmentOwnership(candidateId, 'other-org', assignmentId),
      ).toBe(false);

      // Different candidate returns false
      expect(
        await adapter.verifyCandidateAssignmentOwnership('other-cand', orgId, assignmentId),
      ).toBe(false);

      adapter.revokeOwnership(candidateId, orgId, assignmentId);
      expect(
        await adapter.verifyCandidateAssignmentOwnership(candidateId, orgId, assignmentId),
      ).toBe(false);
    });
  });

  describe('Database-backed Assignment Ownership (Sprint 4 Integration)', () => {
    it.skip('blocked on assignments table (Stream 2 scope)', () => {
      // Pending Stream 2 migration of app.assignments and app.submissions
    });
  });
});
