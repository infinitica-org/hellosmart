import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import CompanySettingsPage, { CompanySettingsView } from '../app/(company)/company/settings/page';
import CompanyAnalyticsPage from '../app/(company)/company/analytics/page';
import CandidateSubmissionReviewPage from '../app/(company)/company/submissions/[id]/page';
import { CompanyStoreProvider } from '../providers/store-provider';

// Mock useParams from next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'sub-001' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Company Settings, Analytics & Submission Review (BUG-CP-11, BUG-CP-12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Company Settings Page (BR-16, BR-31)', () => {
    it('renders organization profile and 90-day retention policy', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanySettingsPage />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Settings &amp; Integrations');
      expect(html).toContain('Candidate Data Retention');
      expect(html).toContain('90 Days (GDPR &amp; DPDP Compliant)');
      expect(html).toContain('Protected');
    });

    it('renders empty key vault state when no keys registered', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanySettingsView defaultTab="keys" initialKeys={[]} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('AI Provider Keys');
      expect(html).toContain('No AI provider keys vaulted yet');
    });

    it('renders AI provider key vault with masked key format (BR-16)', () => {
      const sampleKeys = [
        {
          id: 'key-1',
          provider: 'openai' as const,
          providerName: 'OpenAI (GPT-4o, o3-mini)',
          maskedKey: 'sk-...4921',
          isDefault: true,
          status: 'active' as const,
          lastTestedAt: 'Just now',
        },
        {
          id: 'key-2',
          provider: 'anthropic' as const,
          providerName: 'Anthropic (Claude 3.5 Sonnet)',
          maskedKey: 'sk-ant-...8102',
          isDefault: false,
          status: 'active' as const,
          lastTestedAt: '2 hours ago',
        },
      ];

      const html = renderToString(
        <CompanyStoreProvider>
          <CompanySettingsView defaultTab="keys" initialKeys={sampleKeys} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('AI Provider Keys');
      expect(html).toContain('Zero-Trust Key Isolation Architecture');
      // Checks that keys are masked with last-4 format and never exposed in full
      expect(html).toContain('sk-...4921');
      expect(html).toContain('sk-ant-...8102');
    });

    it('renders billing tab with quotas and promo code redemption (BR-29)', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanySettingsView defaultTab="billing" />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Billing &amp; Quotas');
      expect(html).toContain('Candidate Allowance');
      expect(html).toContain('Redeem Promo / Custom Payment Code');
    });
  });

  describe('Company Analytics Page', () => {
    it('renders candidate conversion funnel and metric overview', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyAnalyticsPage />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Analytics &amp; Performance Insights');
      expect(html).toContain('Total Invited');
      expect(html).toContain('Candidate Lifecycle Funnel');
      expect(html).toContain('Rubric Dimension Performance');
      expect(html).toContain('Recent Scored Submissions');
    });

    it('renders empty scored submissions state when no evaluations completed', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyAnalyticsPage initialSubmissions={[]} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('No scored submissions yet');
    });

    it('renders recent scored submissions with review links', () => {
      const sampleSubmissions = [
        {
          id: 'sub-001',
          candidateName: 'Priya Sharma',
          candidateEmail: 'priya.sharma@example.com',
          assessmentName: 'Full-Stack Distributed Systems Engineer',
          workspaceMode: 'cloud' as const,
          durationMinutes: 82,
          agentScore: 88,
          humanScore: 90,
          status: 'finalized' as const,
          submittedAt: 'Today, 2:15 PM',
        },
        {
          id: 'sub-002',
          candidateName: 'Alex Mercer',
          candidateEmail: 'alex.mercer@example.com',
          assessmentName: 'Senior Backend Python Architect',
          workspaceMode: 'cloud' as const,
          durationMinutes: 89,
          agentScore: 76,
          humanScore: 78,
          status: 'finalized' as const,
          submittedAt: 'Yesterday, 6:40 PM',
        },
      ];

      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyAnalyticsPage initialSubmissions={sampleSubmissions} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Alex Mercer');
      expect(html).toContain('/company/submissions/sub-001');
      expect(html).toContain('Review Dossier');
    });
  });

  describe('Candidate Submission Review Page (BR-18, BR-20)', () => {
    const sampleSubmission = {
      id: 'sub-001',
      candidateName: 'Priya Sharma',
      candidateEmail: 'priya.sharma@example.com',
      assessmentName: 'Full-Stack Distributed Systems Engineer',
      workspaceMode: 'cloud' as const,
      durationMinutes: 82,
      submittedAt: 'Today at 2:15 PM UTC',
      autoSubmitted: false,
      isFinalized: false,
      currentVersion: 1,
      overallScore: 82,
      humanScore: 85,
      notes: 'Candidate showed strong modular architectural patterns and clean domain isolation.',
      releaseResults: false,
      rubricScores: [
        {
          name: 'Code Quality & Clean Architecture',
          weight: 30,
          score: 86,
          confidence: 94,
          rationale: 'Extracted modular domain services cleanly.',
          evidence: ['src/modules/orders/orders.service.ts#L42-L89'],
        },
        {
          name: 'System Design & Scalability',
          weight: 25,
          score: 82,
          confidence: 90,
          rationale: 'Applied asynchronous event worker model.',
          evidence: ['src/workers/order-processor.ts#L15-L68'],
        },
        {
          name: 'AI Tooling & Prompt Strategy',
          weight: 25,
          score: 80,
          confidence: 92,
          rationale: 'Effective conversational prompt refinement.',
          evidence: ['workspace/transcripts/ai-chat.jsonl#L45-L68'],
        },
      ],
    };

    it('renders candidate dossier and untrusted input banner (BR-18)', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CandidateSubmissionReviewPage initialSubmission={sampleSubmission} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Untrusted Candidate Artifacts Notice');
      expect(html).toContain('All code snippets, git commits, and candidate chat messages below are untrusted candidate inputs');
    });

    it('renders AI reviewer agent rubric score cards with evidence citations', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CandidateSubmissionReviewPage initialSubmission={sampleSubmission} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Code Quality &amp; Clean Architecture');
      expect(html).toContain('System Design &amp; Scalability');
      expect(html).toContain('AI Tooling &amp; Prompt Strategy');
      expect(html).toContain('weight');
      expect(html).toContain('src/modules/orders/orders.service.ts#L42-L89');
    });

    it('renders human review panel with override score and release results toggle (BR-20)', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CandidateSubmissionReviewPage initialSubmission={sampleSubmission} />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Human Review &amp; Final Decision');
      expect(html).toContain('Final Human Score (0 - 100)');
      expect(html).toContain('Release Evaluation Report to Candidate');
      expect(html).toContain('Finalize Decision');
    });
  });
});
