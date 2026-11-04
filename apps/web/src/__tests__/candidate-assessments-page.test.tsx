import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CandidateStoreProvider } from '@/providers/store-provider';
import CandidateAssessmentsPage from '@/app/(candidate)/candidate/assessments/page';
import * as candidateApiModule from '@/store/candidate/candidateApi';

describe('CandidateAssessmentsPage (BUG-CAN-06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders clean empty state when candidate has zero assignments', () => {
    vi.spyOn(candidateApiModule, 'useGetCandidateAssessmentsQuery').mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentsPage />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('My Assessments');
    expect(html).toContain('No active assignments');
    expect(html).toContain('All (0)');
    expect(html).toContain('Active (0)');
    expect(html).toContain('Submitted (0)');
  });

  it('renders live assessment cards with status badges and environment indicators', () => {
    vi.spyOn(candidateApiModule, 'useGetCandidateAssessmentsQuery').mockReturnValue({
      data: [
        {
          id: 'assign-1',
          assessmentId: 'assess-1',
          title: 'Fullstack Bug Remediation',
          companyName: 'Acme Technologies',
          workspaceMode: 'cloud',
          status: 'ready',
          durationMinutes: 90,
          deadline: '2026-12-31T23:59:59Z',
          submittedAt: null,
          releaseResults: false,
        },
        {
          id: 'assign-2',
          assessmentId: 'assess-2',
          title: 'System Design Architecture',
          companyName: 'Globex Inc',
          workspaceMode: 'chat',
          status: 'submitted',
          durationMinutes: 60,
          deadline: '2026-12-31T23:59:59Z',
          submittedAt: '2026-11-01T10:00:00Z',
          releaseResults: true,
        },
      ],
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as any);

    const html = renderToString(
      <CandidateStoreProvider>
        <CandidateAssessmentsPage />
      </CandidateStoreProvider>,
    );

    expect(html).toContain('Fullstack Bug Remediation');
    expect(html).toContain('Acme Technologies');
    expect(html).toContain('Ready to Start');
    expect(html).toContain('Cloud VM');
    expect(html).toContain('href="/candidate/assessments/assign-1"');
    expect(html).toContain('Start Assessment →');

    expect(html).toContain('System Design Architecture');
    expect(html).toContain('Globex Inc');
    expect(html).toContain('Submitted');
    expect(html).toContain('Chat Workspace');
    expect(html).toContain('href="/candidate/assessments/assign-2"');
    expect(html).toContain('Results Released');
  });
});
