import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CandidateStoreProvider } from '@/providers/store-provider';
import CandidateAssessmentTakePage from '@/app/(candidate)/candidate/assessments/[id]/page';
import * as candidateApiModule from '@/store/candidate/candidateApi';

describe('CandidateAssessmentTakePage (BUG-CAN-05, BUG-CAN-07, BUG-CAN-08, BUG-CAN-09, BUG-CAN-10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pre-connect consent gate when candidate has not yet connected (BR-12)', () => {
    vi.spyOn(candidateApiModule, 'useGetAssessmentByIdQuery').mockReturnValue({
      data: {
        id: 'assign-1',
        assessmentId: 'assess-1',
        title: 'Backend API Migration',
        companyName: 'Acme Corp',
        workspaceMode: 'cloud',
        status: 'ready',
        durationMinutes: 90,
        firstConnectAt: null,
        releaseResults: false,
        aiPolicy: { enabled: true, allowedModels: ['gemini-2.0-flash'] },
        timing: { durationMinutes: 90, pauseTimerOnDisconnect: false },
        briefOverrides: {
          scenario: 'Implement multi-tenant database migration',
          deliverables: ['Schema migration script', 'Unit tests'],
        },
      },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentTakePage params={{ id: 'assign-1' }} />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Backend API Migration');
    expect(html).toContain('Assessment Environment Agreement');
    expect(html).toContain('Session Recording:');
    expect(html).toContain('AI Assistant Policy:');
    expect(html).toContain('Timer &amp; Disconnection:');
    expect(html).toContain('Full Screen Requirement:');
    expect(html).toContain('Connect to Workspace');
  });

  it('renders governed active workspace taking experience when connected (BR-08, BR-10, BR-11)', () => {
    vi.spyOn(candidateApiModule, 'useGetAssessmentByIdQuery').mockReturnValue({
      data: {
        id: 'assign-1',
        assessmentId: 'assess-1',
        title: 'Backend API Migration',
        companyName: 'Acme Corp',
        workspaceMode: 'cloud',
        status: 'in_progress',
        durationMinutes: 90,
        firstConnectAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        deadline: new Date(Date.now() + 1000 * 60 * 80).toISOString(),
        releaseResults: false,
        aiPolicy: { enabled: true },
        timing: { durationMinutes: 90, pauseTimerOnDisconnect: false },
        briefOverrides: {
          scenario: 'Implement multi-tenant database migration',
          deliverables: ['Schema migration script', 'Unit tests'],
        },
      },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentTakePage params={{ id: 'assign-1' }} />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Backend API Migration');
    expect(html).toContain('Submit Assessment');
    expect(html).toContain('Continuous Autosave Active');
    expect(html).toContain('RPO');
    expect(html).toContain('30s');
    expect(html).toContain('Task Brief &amp; Scenario');
    expect(html).toContain('Implement multi-tenant database migration');
    expect(html).toContain('Required Deliverables:');
    expect(html).toContain('Schema migration script');
    expect(html).toContain('solution.ts');
  });

  it('renders private evaluation state when assessment is submitted but unreleased (BR-20)', () => {
    vi.spyOn(candidateApiModule, 'useGetAssessmentByIdQuery').mockReturnValue({
      data: {
        id: 'assign-1',
        assessmentId: 'assess-1',
        title: 'Backend API Migration',
        companyName: 'Acme Corp',
        workspaceMode: 'cloud',
        status: 'submitted',
        durationMinutes: 90,
        firstConnectAt: '2026-11-04T10:00:00Z',
        submittedAt: '2026-11-04T11:20:00Z',
        releaseResults: false, // BR-20: Unreleased evaluation
      },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentTakePage params={{ id: 'assign-1' }} />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Backend API Migration');
    expect(html).toContain('Submitted');
    expect(html).toContain('Assessment Submitted • Evaluation Under Review');
    expect(html).toContain('remain private until released by the hiring team');
    expect(html).toContain('Return to Assessments');
    // Rubric score cards must NOT be displayed
    expect(html).not.toContain('Evaluation Results Released');
  });

  it('renders rubric evaluation score cards when results are released with rubric breakdown (BR-20)', () => {
    vi.spyOn(candidateApiModule, 'useGetAssessmentByIdQuery').mockReturnValue({
      data: {
        id: 'assign-1',
        assessmentId: 'assess-1',
        title: 'Backend API Migration',
        companyName: 'Acme Corp',
        workspaceMode: 'cloud',
        status: 'submitted',
        durationMinutes: 90,
        firstConnectAt: '2026-11-04T10:00:00Z',
        submittedAt: '2026-11-04T11:20:00Z',
        releaseResults: true, // BR-20: Released evaluation
        rubricScores: [
          {
            name: 'System Implementation & Correctness',
            weight: 60,
            score: 92,
            rationale: 'Solution demonstrates high modularity and boundary checks.',
            evidence: ['git:commit-38a4', 'test:suite-passed'],
            confidence: 95,
          },
          {
            name: 'Code Quality & Architecture',
            weight: 40,
            score: 88,
            rationale: 'Clean domain separation with type-safe contracts.',
            evidence: ['src/solution.ts:1-24'],
            confidence: 90,
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentTakePage params={{ id: 'assign-1' }} />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Evaluation Results Released');
    expect(html).toContain('System Implementation &amp; Correctness');
    expect(html).toContain('Code Quality &amp; Architecture');
    expect(html).toContain('Agent Confidence');
  });

  it('renders clean fallback message when results are released without rubric scorecards (BR-20)', () => {
    vi.spyOn(candidateApiModule, 'useGetAssessmentByIdQuery').mockReturnValue({
      data: {
        id: 'assign-1',
        assessmentId: 'assess-1',
        title: 'Backend API Migration',
        companyName: 'Acme Corp',
        workspaceMode: 'cloud',
        status: 'submitted',
        durationMinutes: 90,
        firstConnectAt: '2026-11-04T10:00:00Z',
        submittedAt: '2026-11-04T11:20:00Z',
        releaseResults: true,
        rubricScores: [],
      },
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentTakePage params={{ id: 'assign-1' }} />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Evaluation Results Released');
    expect(html).toContain('Rubric dimension scorecards will appear once published');
  });
});
