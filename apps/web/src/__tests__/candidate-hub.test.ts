import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCandidates,
  inviteCandidate,
  bulkUploadCandidates,
  updateCandidate,
  deleteCandidate,
  resendCandidateInvite,
} from '../lib/company-api';
import { candidateKeys } from '../hooks/company/use-candidates';
import { CreateCandidateDtoSchema } from '@hs/contracts';
import { ApiError } from '../lib/api-client';

describe('Candidates API & Contracts (Ticket #124)', () => {
  const mockOrgIdA = '11111111-1111-1111-1111-111111111111';
  const mockOrgIdB = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tenant Scoping & Cache Isolation (BR-01)', () => {
    it('scopes query keys strictly by orgId to prevent cross-tenant cache pollution', () => {
      const keyA = candidateKeys.all(mockOrgIdA);
      const keyB = candidateKeys.all(mockOrgIdB);

      expect(keyA).toEqual(['company', mockOrgIdA, 'candidates']);
      expect(keyB).toEqual(['company', mockOrgIdB, 'candidates']);
      expect(keyA).not.toEqual(keyB);
    });

    it('scopes list query keys by both orgId and active filters', () => {
      const filters = { search: 'Jane', status: 'invited' as const, page: 2, limit: 10 };
      const key = candidateKeys.list(mockOrgIdA, filters);

      expect(key).toEqual(['company', mockOrgIdA, 'candidates', 'list', filters]);
    });
  });

  describe('Single Candidate Invitation (CO-011, BR-24)', () => {
    it('validates name and email via CreateCandidateDtoSchema', () => {
      const valid = CreateCandidateDtoSchema.safeParse({
        name: 'Jane Candidate',
        email: 'jane@example.com',
      });
      expect(valid.success).toBe(true);

      const invalidEmail = CreateCandidateDtoSchema.safeParse({
        name: 'Jane Candidate',
        email: 'not-an-email',
      });
      expect(invalidEmail.success).toBe(false);

      const emptyName = CreateCandidateDtoSchema.safeParse({
        name: '',
        email: 'jane@example.com',
      });
      expect(emptyName.success).toBe(false);
    });

    it('dispatches single candidate invitation to /candidates endpoint', async () => {
      const mockCandidate = {
        id: 'candidate-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        status: 'invited',
        countedAgainstCapAt: null,
        createdAt: new Date().toISOString(),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCandidate,
      });

      const result = await inviteCandidate({ name: 'Jane Doe', email: 'jane@example.com' }, mockFetch as unknown as typeof fetch);

      expect(result).toEqual(mockCandidate);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/candidates');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body as string)).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });
    });

    it('throws ApiError with RFC 9457 details on invitation conflict (409)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          status: 409,
          code: 'CANDIDATE_ALREADY_EXISTS',
          detail: 'Candidate with this email already exists in your organization',
        }),
      });

      await expect(
        inviteCandidate({ name: 'Jane Doe', email: 'jane@example.com' }, mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('Candidate Listing & Filtering (CO-014)', () => {
    it('constructs correct query parameters for search, status, and pagination', async () => {
      const mockResponse = {
        items: [
          {
            id: 'c-1',
            name: 'Alice',
            email: 'alice@example.com',
            status: 'active',
            createdAt: '2026-10-23T00:00:00Z',
          },
        ],
        total: 1,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const filters = { search: 'Alice', status: 'active' as const, page: 2, limit: 25 };
      const result = await fetchCandidates(filters, mockFetch as unknown as typeof fetch);

      expect(result).toEqual(mockResponse);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('search=Alice');
      expect(url).toContain('status=active');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=25');
    });

    it('omits status filter when status is "all"', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total: 0 }),
      });

      await fetchCandidates({ status: 'all', page: 1, limit: 10 }, mockFetch as unknown as typeof fetch);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).not.toContain('status=');
    });
  });

  describe('Bulk Upload Integration (CO-012, EX-11)', () => {
    it('dispatches bulk candidates payload and parses partial results', async () => {
      const mockPayload = {
        candidates: [
          { name: 'User 1', email: 'u1@example.com' },
          { name: 'User 2', email: 'u2@example.com' },
        ],
      };

      const mockResponse = {
        created: [
          {
            id: 'c-1',
            name: 'User 1',
            email: 'u1@example.com',
            status: 'invited',
            createdAt: '2026-10-31T00:00:00Z',
          },
        ],
        errors: [
          {
            rowNumber: 3,
            name: 'User 2',
            email: 'u2@example.com',
            reason: 'Candidate already exists in organization',
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await bulkUploadCandidates(mockPayload, mockFetch as unknown as typeof fetch);
      expect(result).toEqual(mockResponse);
      expect(result.created).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Candidate Management Actions (CO-015, CO-016, CO-017)', () => {
    it('sends PATCH request to update candidate details', async () => {
      const mockUpdated = {
        id: 'candidate-99',
        name: 'Jane Updated',
        email: 'jane@example.com',
        status: 'invited',
        createdAt: '2026-10-31T00:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUpdated,
      });

      const result = await updateCandidate('candidate-99', { name: 'Jane Updated' }, mockFetch as unknown as typeof fetch);
      expect(result.name).toBe('Jane Updated');
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/candidates/candidate-99');
      expect(options.method).toBe('PATCH');
    });

    it('sends DELETE request for soft-deletion', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await deleteCandidate('candidate-99', mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/candidates/candidate-99');
      expect(options.method).toBe('DELETE');
    });

    it('sends POST request to /resend-invite with single-use expiring token dispatch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, deliveryStatus: 'sent', processedAt: '2026-10-31T12:00:00Z' }),
      });

      const result = await resendCandidateInvite('candidate-99', mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      expect(result.deliveryStatus).toBe('sent');
      expect(result.processedAt).toBeDefined();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/candidates/candidate-99/resend-invite');
      expect(options.method).toBe('POST');
    });

    it('returns deliveryStatus: "failed" when email dispatch fails after commit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, deliveryStatus: 'failed', processedAt: '2026-10-31T12:00:00Z' }),
      });

      const result = await resendCandidateInvite('candidate-99', mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      expect(result.deliveryStatus).toBe('failed');
      expect(result.processedAt).toBeDefined();
    });

    it('sends POST request to /assignments/:assignmentId/resend-invite when assignmentId is explicitly passed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, deliveryStatus: 'sent', processedAt: '2026-10-31T12:00:00Z' }),
      });

      const result = await resendCandidateInvite('candidate-99', 'assignment-42', mockFetch as unknown as typeof fetch);
      expect(result.success).toBe(true);
      expect(result.deliveryStatus).toBe('sent');
      expect(result.processedAt).toBeDefined();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/candidates/candidate-99/assignments/assignment-42/resend-invite');
      expect(options.method).toBe('POST');
    });
  });
});

