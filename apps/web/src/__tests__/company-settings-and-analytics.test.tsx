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
      expect(html).toContain('Candidate Data Retention (BR-31, BR-32)');
      expect(html).toContain('90 Days (GDPR &amp; DPDP Compliant)');
      expect(html).toContain('Protected (BR-01)');
    });

    it('renders AI provider key vault with masked key format (BR-16)', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanySettingsView defaultTab="keys" />
        </CompanyStoreProvider>
      );

      expect(html).toContain('AI Provider Keys (BR-16)');
      expect(html).toContain('Zero-Trust Key Isolation Architecture (BR-13, BR-16)');
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
      expect(html).toContain('Candidate Allowance (BR-06)');
      expect(html).toContain('Redeem Promo / Custom Payment Code (BR-29)');
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

    it('renders recent scored submissions with review links', () => {
      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyAnalyticsPage />
        </CompanyStoreProvider>
      );

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Alex Mercer');
      expect(html).toContain('/company/submissions/sub-001');
      expect(html).toContain('Review Dossier');
    });
  });

  describe('Candidate Submission Review Page (BR-18, BR-20)', () => {
    it('renders candidate dossier and untrusted input banner (BR-18)', () => {
      const html = renderToString(
        <CandidateSubmissionReviewPage />
      );

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Untrusted Candidate Artifacts Notice (BR-18)');
      expect(html).toContain('All code snippets, git commits, and candidate chat messages below are untrusted candidate inputs');
    });

    it('renders AI reviewer agent rubric score cards with evidence citations', () => {
      const html = renderToString(
        <CandidateSubmissionReviewPage />
      );

      expect(html).toContain('Code Quality &amp; Clean Architecture');
      expect(html).toContain('System Design &amp; Scalability');
      expect(html).toContain('AI Tooling &amp; Prompt Strategy');
      expect(html).toContain('weight');
      expect(html).toContain('src/modules/orders/orders.service.ts#L42-L89');
    });

    it('renders human review panel with override score and release results toggle (BR-20)', () => {
      const html = renderToString(
        <CandidateSubmissionReviewPage />
      );

      expect(html).toContain('Human Review &amp; Final Decision (BR-20)');
      expect(html).toContain('Final Human Score (0 - 100)');
      expect(html).toContain('Release Evaluation Report to Candidate');
      expect(html).toContain('Finalize Decision');
    });
  });
});
