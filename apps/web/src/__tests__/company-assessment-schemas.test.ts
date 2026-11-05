import { describe, it, expect, vi } from 'vitest';
import {
  Step1TemplateDetailsSchema,
  Step2InstructionsSchema,
  Step3TimingSchema,
  CreateAssessmentDtoSchema,
  type CreateAssessmentDto,
} from '../components/company/assessments/types';
import { createAssessment } from '../lib/company-api';
import { ApiError, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '../lib/api-client';

describe('Assessment Creation Wizard Schemas & Contracts (#122)', () => {
  describe('Step 1: Template & Assessment Meta Schema', () => {
    it('accepts valid template details and assessment name', () => {
      const valid = {
        templateId: 'tpl_fs_01',
        templateVersionId: '1.2.0',
        name: 'Senior Full Stack Engineer Assessment',
        requisitionId: 'REQ-2026-101',
      };
      const result = Step1TemplateDetailsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects assessment name shorter than 3 characters', () => {
      const invalid = {
        templateId: 'tpl_fs_01',
        templateVersionId: '1.2.0',
        name: 'FS',
      };
      const result = Step1TemplateDetailsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 3 characters');
      }
    });

    it('requires templateVersionId to preserve version pinning (BR-03)', () => {
      const invalid = {
        templateId: 'tpl_fs_01',
        templateVersionId: '',
        name: 'Full Stack Assessment',
      };
      const result = Step1TemplateDetailsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Step 2: Candidate Instructions & Deliverables Schema', () => {
    it('accepts valid instructions and non-empty deliverables checklist', () => {
      const valid = {
        candidateInstructions:
          'Please complete the multi-tenant metrics aggregation API and frontend component within the allotted time window.',
        deliverables: [
          'Working NestJS endpoint with tenant scoping',
          'Responsive React summary card',
          'Automated unit tests',
        ],
      };
      const result = Step2InstructionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects instructions shorter than 20 characters', () => {
      const invalid = {
        candidateInstructions: 'Do the task.',
        deliverables: ['Deliverable 1'],
      };
      const result = Step2InstructionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 20 characters');
      }
    });

    it('rejects empty deliverables list', () => {
      const invalid = {
        candidateInstructions:
          'Detailed instructions with more than twenty characters of technical explanation.',
        deliverables: [],
      };
      const result = Step2InstructionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('At least one deliverable item is required');
      }
    });
  });

  describe('Step 3: Timing & Configuration Schema (BR-08, BR-09)', () => {
    it('defaults pauseTimerOnDisconnect to false (BR-09 invariant)', () => {
      const valid = {
        type: 'duration',
        durationMinutes: 90,
      };
      const parsed = Step3TimingSchema.parse(valid);
      expect(parsed.pauseTimerOnDisconnect).toBe(false);
    });

    it('enforces duration between 15 and 480 minutes', () => {
      expect(Step3TimingSchema.safeParse({ durationMinutes: 10 }).success).toBe(false);
      expect(Step3TimingSchema.safeParse({ durationMinutes: 500 }).success).toBe(false);
      expect(Step3TimingSchema.safeParse({ durationMinutes: 90 }).success).toBe(true);
    });

    it('validates window start and end dates when timing type includes window', () => {
      const invalidWindow = {
        type: 'window',
        durationMinutes: 90,
        windowStartUtc: '2026-11-10T12:00:00Z',
        windowEndUtc: '2026-11-10T10:00:00Z', // earlier than start
      };
      const result = Step3TimingSchema.safeParse(invalidWindow);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('later than the start date');
      }

      const validWindow = {
        type: 'window',
        durationMinutes: 90,
        windowStartUtc: '2026-11-10T10:00:00Z',
        windowEndUtc: '2026-11-10T18:00:00Z',
      };
      expect(Step3TimingSchema.safeParse(validWindow).success).toBe(true);
    });
  });

  describe('createAssessment API Client Call', () => {
    const validDto: CreateAssessmentDto = {
      templateId: 'tpl_fs_01',
      templateVersionId: '1.2.0',
      name: 'Full Stack Engineer Assessment',
      candidateInstructions: 'Complete the multi-tenant assessment according to the project specifications.',
      deliverables: ['Working API endpoint', 'Frontend view'],
      timing: {
        type: 'duration',
        durationMinutes: 90,
        tz: 'UTC',
        pauseTimerOnDisconnect: false,
      },
    };

    it('dispatches POST to /company/assessments with CSRF and credentials', async () => {
      const mockCreated = {
        id: 'asm_new_123',
        orgId: 'org_test_1',
        name: validDto.name,
        status: 'draft',
        createdAt: '2026-10-31T12:00:00Z',
      };

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockCreated), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await createAssessment(validDto, mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/company/assessments');
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');

      // Verify CSRF header injection on state-changing call
      const headers = new Headers(init.headers);
      expect(headers.get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
      expect(result.id).toBe('asm_new_123');
      expect(result.status).toBe('draft');
    });

    it('throws ApiError with status and details when backend returns an error', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Conflict',
            status: 409,
            detail: 'An assessment with this name already exists',
            code: 'ASSESSMENT_ALREADY_EXISTS',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        createAssessment(validDto, mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(ApiError);
    });
  });
});

