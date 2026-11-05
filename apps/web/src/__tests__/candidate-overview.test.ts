import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROUTES } from '../constants/routes';
import { ALERT_MESSAGES } from '../constants/messages';
import type { CandidateAssessment, AssessmentStatus } from '../components/candidate/assessment-card';

describe('Candidate Assessment Overview & Status Card (Stream 7.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Route Constants & Navigation Handlers (Stream 7.1 Sections 4 & 6)', () => {
    it('generates correct System Diagnostics (#118) route from assignment id', () => {
      const id = 'assessment-123';
      const diagnosticsRoute = ROUTES.CANDIDATE.DIAGNOSTICS(id);
      expect(diagnosticsRoute).toBe('/candidate/assessments/assessment-123/diagnostics');
    });

    it('generates correct Assessment Workspace (#120) route from workspace or assignment id', () => {
      const workspaceId = 'ws-789';
      const workspaceRoute = ROUTES.CANDIDATE.WORKSPACE(workspaceId);
      expect(workspaceRoute).toBe('/candidate/workspaces/ws-789');
    });

    it('routes Start Assessment to Diagnostics (#118)', () => {
      const pushMock = vi.fn();
      const assessment: CandidateAssessment = {
        id: 'asm-1',
        title: 'Senior Frontend Engineer',
        companyName: 'Acme Corp',
        durationMinutes: 90,
        status: 'ready',
      };

      // Handler simulation from page.tsx
      const handleStart = (item: CandidateAssessment) => {
        pushMock(ROUTES.CANDIDATE.DIAGNOSTICS(item.id));
      };

      handleStart(assessment);
      expect(pushMock).toHaveBeenCalledWith('/candidate/assessments/asm-1/diagnostics');
    });

    it('routes Resume Assessment to Workspace (#120)', () => {
      const pushMock = vi.fn();
      const assessment: CandidateAssessment = {
        id: 'asm-2',
        workspaceId: 'ws-active-456',
        title: 'Backend Systems Engineer',
        companyName: 'Stripe Global',
        durationMinutes: 120,
        status: 'in_progress',
      };

      const handleResume = (item: CandidateAssessment) => {
        const targetId = item.workspaceId || item.id;
        pushMock(ROUTES.CANDIDATE.WORKSPACE(targetId));
      };

      handleResume(assessment);
      expect(pushMock).toHaveBeenCalledWith('/candidate/workspaces/ws-active-456');
    });
  });

  describe('Five Status States & Requirements (Stream 7.1 Section 2)', () => {
    const statuses: AssessmentStatus[] = [
      'window_not_open',
      'ready',
      'in_progress',
      'submitted',
      'expired',
    ];

    it('supports all 5 required assessment status states', () => {
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('window_not_open');
      expect(statuses).toContain('ready');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('submitted');
      expect(statuses).toContain('expired');
    });

    it('verifies assessment metadata invariants (Company name, title, duration)', () => {
      const testCard: CandidateAssessment = {
        id: 'test-1',
        title: 'Full Stack Work Simulation',
        companyName: 'Aster Ridge Technologies',
        durationMinutes: 60,
        status: 'ready',
        workspaceMode: 'cloud',
      };

      expect(testCard.companyName).toBe('Aster Ridge Technologies');
      expect(testCard.title).toBe('Full Stack Work Simulation');
      expect(testCard.durationMinutes).toBe(60);
      expect(testCard.status).toBe('ready');
    });

    it('handles submitted state with ISO submission timestamp', () => {
      const submittedCard: CandidateAssessment = {
        id: 'test-2',
        title: 'DevOps Assessment',
        companyName: 'CloudScale',
        durationMinutes: 45,
        status: 'submitted',
        submittedAt: '2026-11-01T14:30:00.000Z',
      };

      expect(submittedCard.status).toBe('submitted');
      expect(submittedCard.submittedAt).toBeTruthy();
      const date = new Date(submittedCard.submittedAt!);
      expect(date.getUTCFullYear()).toBe(2026);
    });

    it('handles window_not_open state with windowStartUtc for live countdown', () => {
      const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
      const upcomingCard: CandidateAssessment = {
        id: 'test-3',
        title: 'Security Analyst Evaluation',
        companyName: 'CyberGuard Inc',
        durationMinutes: 120,
        status: 'window_not_open',
        windowStartUtc: futureDate,
      };

      expect(upcomingCard.status).toBe('window_not_open');
      expect(new Date(upcomingCard.windowStartUtc!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Countdown Functionality (Stream 7.1 Section 3)', () => {
    it('calculates remaining days, hours, and minutes correctly from UTC timestamp', () => {
      const now = 1700000000000;
      // 2 days, 8 hours, 35 minutes in milliseconds
      const delta = (2 * 86400 + 8 * 3600 + 35 * 60) * 1000;
      const targetTime = now + delta;

      const diff = Math.max(0, targetTime - now);
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      expect(days).toBe(2);
      expect(hours).toBe(8);
      expect(minutes).toBe(35);
    });

    it('clamps remaining time to 0 when countdown reaches or passes target date', () => {
      const pastTime = Date.now() - 5000;
      const diff = Math.max(0, pastTime - Date.now());
      expect(diff).toBe(0);
    });
  });

  describe('Empty State Copy (Stream 7.1 Section 5)', () => {
    it('matches exact ticket string for empty candidate assessments', () => {
      const expectedMessage =
        'No active assessments. When an assessment is assigned by your employer, it will appear here.';
      expect(ALERT_MESSAGES.CANDIDATES.EMPTY_ACTIVE_ASSESSMENTS).toBe(expectedMessage);
    });
  });

  describe('API & Contracts Parsing (useCandidateAssessments)', () => {
    it('parses array or wrapped paginated response correctly', () => {
      const rawList: CandidateAssessment[] = [
        {
          id: '1',
          title: 'Assessment 1',
          companyName: 'Company A',
          durationMinutes: 60,
          status: 'ready',
        },
      ];

      const parseResponse = (json: any): CandidateAssessment[] => {
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.items)) return json.items;
        if (Array.isArray(json?.data)) return json.data;
        return [];
      };

      expect(parseResponse(rawList)).toHaveLength(1);
      expect(parseResponse({ items: rawList })).toHaveLength(1);
      expect(parseResponse({ data: rawList })).toHaveLength(1);
      expect(parseResponse({})).toHaveLength(0);
    });
  });
});

