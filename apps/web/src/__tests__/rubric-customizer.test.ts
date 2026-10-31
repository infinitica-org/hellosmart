import { describe, it, expect, vi } from 'vitest';
import {
  calculateWeightBalance,
  RubricDimensionSchema,
  AssessmentRubricSchema,
  DEFAULT_SCORING_ANCHORS,
  type RubricDimension,
  type AssessmentRubric,
} from '../components/company/rubric/types';
import { fetchAssessmentRubric, updateAssessmentRubric } from '../lib/company-api';
import { ApiError, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '../lib/api-client';

describe('Rubric Customizer Domain Models & 100% Weight Invariant (#123)', () => {
  const sampleDimensions: RubricDimension[] = [
    {
      id: 'dim_1',
      name: 'System Architecture',
      description: 'Evaluates architectural patterns and modularity.',
      weight: 50,
      signals: ['Clean boundaries', 'Dependency injection'],
      redFlags: ['Circular dependencies'],
      scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
    },
    {
      id: 'dim_2',
      name: 'Testing & Reliability',
      description: 'Assesses edge case coverage and test quality.',
      weight: 50,
      signals: ['High branch coverage', 'Regression tests'],
      redFlags: ['Flaky tests', 'No assertions'],
      scoringAnchors: [...DEFAULT_SCORING_ANCHORS],
    },
  ];

  describe('Weight Balance Calculation Utility', () => {
    it('reports balanced when weights total exactly 100%', () => {
      const result = calculateWeightBalance([{ weight: 40 }, { weight: 35 }, { weight: 25 }]);
      expect(result.isBalanced).toBe(true);
      expect(result.status).toBe('balanced');
      expect(result.totalWeight).toBe(100);
      expect(result.remainingWeight).toBe(0);
      expect(result.difference).toBe(0);
    });

    it('reports under allocated when total is less than 100%', () => {
      const result = calculateWeightBalance([{ weight: 40 }, { weight: 40 }]);
      expect(result.isBalanced).toBe(false);
      expect(result.status).toBe('under');
      expect(result.totalWeight).toBe(80);
      expect(result.remainingWeight).toBe(20);
      expect(result.difference).toBe(20);
      expect(result.message).toContain('20% remaining');
    });

    it('reports over allocated when total is greater than 100%', () => {
      const result = calculateWeightBalance([{ weight: 60 }, { weight: 55 }]);
      expect(result.isBalanced).toBe(false);
      expect(result.status).toBe('over');
      expect(result.totalWeight).toBe(115);
      expect(result.remainingWeight).toBe(-15);
      expect(result.difference).toBe(15);
      expect(result.message).toContain('15% over allocated');
    });

    it('handles empty dimension list without crashing', () => {
      const result = calculateWeightBalance([]);
      expect(result.isBalanced).toBe(false);
      expect(result.status).toBe('under');
      expect(result.totalWeight).toBe(0);
      expect(result.remainingWeight).toBe(100);
    });
  });

  describe('RubricDimensionSchema Validation', () => {
    it('accepts valid dimension', () => {
      const result = RubricDimensionSchema.safeParse(sampleDimensions[0]);
      expect(result.success).toBe(true);
    });

    it('rejects weight < 1 or > 100', () => {
      const invalidLow = { ...sampleDimensions[0], weight: 0 };
      expect(RubricDimensionSchema.safeParse(invalidLow).success).toBe(false);

      const invalidHigh = { ...sampleDimensions[0], weight: 101 };
      expect(RubricDimensionSchema.safeParse(invalidHigh).success).toBe(false);
    });

    it('rejects short description under 10 characters', () => {
      const invalid = { ...sampleDimensions[0], description: 'Too short' };
      const result = RubricDimensionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 10 characters');
      }
    });

    it('enforces scoring anchors include 1, 3, and 5 levels', () => {
      const invalidAnchors = {
        ...sampleDimensions[0],
        scoringAnchors: [{ score: 1, label: 'Inadequate', description: 'Sample description' }],
      };
      const result = RubricDimensionSchema.safeParse(invalidAnchors);
      expect(result.success).toBe(false);
    });
  });

  describe('AssessmentRubricSchema 100% Invariant Validation (BR-18)', () => {
    it('accepts rubric when dimensions total exactly 100%', () => {
      const validRubric: AssessmentRubric = {
        assessmentId: 'asm_test_1',
        templateId: 'tpl_fs_01',
        templateVersionId: '1.2.0',
        dimensions: sampleDimensions,
      };

      const result = AssessmentRubricSchema.safeParse(validRubric);
      expect(result.success).toBe(true);
    });

    it('rejects rubric when dimensions sum to 95%', () => {
      const invalidRubric = {
        assessmentId: 'asm_test_1',
        templateId: 'tpl_fs_01',
        templateVersionId: '1.2.0',
        dimensions: [
          { ...sampleDimensions[0], weight: 50 },
          { ...sampleDimensions[1], weight: 45 },
        ],
      };

      const result = AssessmentRubricSchema.safeParse(invalidRubric);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('must sum to exactly 100%');
      }
    });

    it('rejects rubric when dimensions sum to 105%', () => {
      const invalidRubric = {
        assessmentId: 'asm_test_1',
        templateId: 'tpl_fs_01',
        templateVersionId: '1.2.0',
        dimensions: [
          { ...sampleDimensions[0], weight: 55 },
          { ...sampleDimensions[1], weight: 50 },
        ],
      };

      const result = AssessmentRubricSchema.safeParse(invalidRubric);
      expect(result.success).toBe(false);
    });
  });

  describe('Rubric API Client Calls', () => {
    it('fetchAssessmentRubric dispatches GET to /company/assessments/:id/rubric', async () => {
      const mockRubric = {
        assessmentId: 'asm_123',
        templateId: 'tpl_1',
        templateVersionId: '1.0.0',
        dimensions: sampleDimensions,
      };

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockRubric), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchAssessmentRubric('asm_123', mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/company/assessments/asm_123/rubric');
      expect(result.dimensions).toHaveLength(2);
    });

    it('updateAssessmentRubric dispatches PUT with X-HS-CSRF header and credentials', async () => {
      const rubricPayload: AssessmentRubric = {
        assessmentId: 'asm_123',
        templateId: 'tpl_1',
        templateVersionId: '1.0.0',
        dimensions: sampleDimensions,
      };

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(rubricPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await updateAssessmentRubric('asm_123', rubricPayload, mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/company/assessments/asm_123/rubric');
      expect(init.method).toBe('PUT');
      expect(init.credentials).toBe('include');

      const headers = new Headers(init.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
      expect(result.dimensions[0]?.weight).toBe(50);
    });

    it('throws ApiError on server rejection', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'Rubric total weight must equal 100',
            code: 'INVALID_RUBRIC_WEIGHT',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const rubricPayload: AssessmentRubric = {
        assessmentId: 'asm_123',
        templateId: 'tpl_1',
        templateVersionId: '1.0.0',
        dimensions: sampleDimensions,
      };

      await expect(
        updateAssessmentRubric('asm_123', rubricPayload, mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(ApiError);
    });
  });
});

