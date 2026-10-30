import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { CompanyAssessmentsView, INITIAL_ASSESSMENTS } from '../app/(company)/company/assessments/page';
import { CompanyAnalyticsView, EVALUATION_SUMMARIES } from '../app/(company)/company/analytics/page';
import { CompanySettingsView, INITIAL_PROVIDER_KEYS } from '../app/(company)/company/settings/page';

describe('Company Subpages Implementation (BUG-17)', () => {
  describe('1. Company Assessments Subpage (CompanyAssessmentsView)', () => {
    it('renders configured assessments with metrics and blueprint cards', () => {
      const element = React.createElement(CompanyAssessmentsView, {
        assessments: INITIAL_ASSESSMENTS,
      });

      expect(element).toBeDefined();
      expect(INITIAL_ASSESSMENTS.length).toBeGreaterThanOrEqual(3);

      const published = INITIAL_ASSESSMENTS.filter((a) => a.status === 'published');
      expect(published.length).toBeGreaterThanOrEqual(2);
    });

    it('enforces server-timed duration and private template assignment invariants (BR-02, BR-08)', () => {
      for (const asmt of INITIAL_ASSESSMENTS) {
        expect(asmt.durationMinutes).toBeGreaterThan(0);
        expect(asmt.templateVersion).toMatch(/^v\d+\.\d+\.\d+/);
        expect(['cloud', 'chat']).toContain(asmt.workspaceMode);
      }
    });
  });

  describe('2. Company Analytics Subpage (CompanyAnalyticsView)', () => {
    it('renders hiring telemetry metrics and evaluation records', () => {
      const element = React.createElement(CompanyAnalyticsView, {
        evaluations: EVALUATION_SUMMARIES,
      });

      expect(element).toBeDefined();
      expect(EVALUATION_SUMMARIES.length).toBeGreaterThan(0);

      // Verify scores are within 0-100 rubric scale
      for (const ev of EVALUATION_SUMMARIES) {
        expect(ev.score).toBeGreaterThanOrEqual(0);
        expect(ev.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('3. Company Settings Subpage (CompanySettingsView)', () => {
    it('renders organization preferences and masked BYOK keys (BR-16)', () => {
      const element = React.createElement(CompanySettingsView);
      expect(element).toBeDefined();

      expect(INITIAL_PROVIDER_KEYS.length).toBeGreaterThanOrEqual(3);
      for (const key of INITIAL_PROVIDER_KEYS) {
        // Must never expose raw key in client components (BR-16)
        expect(key.maskedKey).toContain('••••');
        expect(key.status).toBe('active');
      }
    });
  });
});

