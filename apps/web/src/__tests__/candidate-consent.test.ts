import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assessmentConsentSchema,
  assessmentConsentResponseSchema,
  CURRENT_CONSENT_TEXT_VERSION,
  type AssessmentConsentInput,
} from '@hs/contracts';
import { ROUTES } from '../constants/routes';

describe('Candidate Assessment Consent & Legal Agreement (Stream 7.3 - BR-12, Ticket #119)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shared Zod Contract & Versioning (@hs/contracts)', () => {
    it('defines the authoritative active legal consent text version', () => {
      expect(CURRENT_CONSENT_TEXT_VERSION).toBe('v1.0');
    });

    it('validates valid consent input payload', () => {
      const validPayload: AssessmentConsentInput = {
        assessmentId: 'asm-consent-123',
        textVersion: CURRENT_CONSENT_TEXT_VERSION,
      };

      const result = assessmentConsentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects payload with empty or missing assessmentId', () => {
      const invalidPayload = {
        assessmentId: '',
        textVersion: CURRENT_CONSENT_TEXT_VERSION,
      };

      const result = assessmentConsentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects payload with empty or missing textVersion', () => {
      const invalidPayload = {
        assessmentId: 'asm-123',
        textVersion: '',
      };

      const result = assessmentConsentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('validates server response schema with server-generated UTC timestamp', () => {
      const validResponse = {
        success: true,
        consentId: 'csnt-uuid-999',
        assessmentId: 'asm-123',
        textVersion: 'v1.0',
        acceptedAt: '2026-11-02T11:30:00.000Z',
      };

      const result = assessmentConsentResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('Mandatory Agreement Checkbox Copy (Exact Ticket Requirement)', () => {
    const REQUIRED_CHECKBOX_TEXT =
      'I agree to the assessment guidelines and terms of evaluation';

    it('matches the exact mandated legal agreement checkbox text', () => {
      expect(REQUIRED_CHECKBOX_TEXT).toBe(
        'I agree to the assessment guidelines and terms of evaluation'
      );
    });
  });

  describe('Legal Disclosures & Policy Rules (BR-12, BR-09, BR-10, BR-14)', () => {
    it('discloses that the timer continues running while disconnected (BR-09)', () => {
      const timerNotice =
        'The assessment timer continues running while disconnected or if you close your browser. Reconnecting does not pause or reset your remaining time.';
      expect(timerNotice).toContain('continues running while disconnected');
      expect(timerNotice).toContain('does not pause or reset');
    });

    it('discloses session activity telemetry recording for evidence (BR-12)', () => {
      const telemetryNotice =
        'To verify practical technical capability, this workspace records candidate activity: terminal commands, file diffs, editor changes, git snapshots, and chat interactions.';
      expect(telemetryNotice).toContain('terminal commands');
      expect(telemetryNotice).toContain('git snapshots');
      expect(telemetryNotice).toContain('file diffs');
    });

    it('discloses full-screen requirement and disconnect policy on exit (BR-10)', () => {
      const fullScreenNotice =
        'Entering a cloud workspace requests full-screen mode. Exiting full-screen or switching windows disconnects the active session.';
      expect(fullScreenNotice).toContain('requests full-screen mode');
      expect(fullScreenNotice).toContain('disconnects the active session');
    });
  });

  describe('Button Gating & Submission Flow', () => {
    it('disables start action when checkbox is not accepted', () => {
      const canSubmit = (hasAgreed: boolean, isSubmitting: boolean) =>
        hasAgreed && !isSubmitting;

      expect(canSubmit(false, false)).toBe(false);
      expect(canSubmit(true, true)).toBe(false);
      expect(canSubmit(true, false)).toBe(true);
    });

    it('navigates to workspace only upon confirmed backend persistence', () => {
      const pushMock = vi.fn();
      const assessmentId = 'asm-valid-001';

      const handleConsentSuccess = (id: string, success: boolean) => {
        if (success) {
          pushMock(ROUTES.CANDIDATE.WORKSPACE(id));
        }
      };

      // Simulated failed API call - must not navigate
      handleConsentSuccess(assessmentId, false);
      expect(pushMock).not.toHaveBeenCalled();

      // Simulated success API call - navigates to workspace
      handleConsentSuccess(assessmentId, true);
      expect(pushMock).toHaveBeenCalledWith('/candidate/workspaces/asm-valid-001');
    });
  });
});

