import { test, expect } from '@playwright/test';

test.describe('Portal Dashboards & Error Pages E2E', () => {
  test('Admin portal renders header, metrics, and empty state with data-testid', async ({ page }) => {
    await page.goto('/admin');

    // PageHeader
    const header = page.getByTestId('admin-page-header');
    await expect(header).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Platform Administration' })).toBeVisible();

    // Metric Cards
    await expect(page.getByTestId('metric-total-tenants')).toBeVisible();
    await expect(page.getByTestId('metric-active-workspaces')).toBeVisible();
    await expect(page.getByTestId('metric-candidate-sessions')).toBeVisible();

    // Empty state
    const emptyState = page.getByTestId('admin-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No organizations provisioned');
  });

  test('Company portal renders header, metrics, and empty state with data-testid', async ({ page }) => {
    await page.goto('/company');

    // PageHeader
    const header = page.getByTestId('company-page-header');
    await expect(header).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hiring Pipeline' })).toBeVisible();

    // Metric Cards
    await expect(page.getByTestId('metric-configured-assessments')).toBeVisible();
    await expect(page.getByTestId('metric-invited-candidates')).toBeVisible();
    await expect(page.getByTestId('metric-submissions-to-review')).toBeVisible();

    // Empty state
    const emptyState = page.getByTestId('company-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No assessments published yet');
  });

  test('Candidate portal renders header and task guidance with data-testid', async ({ page }) => {
    await page.goto('/candidate');

    const header = page.getByTestId('candidate-page-header');
    await expect(header).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Candidate Assessment Workspace' })).toBeVisible();

    const emptyState = page.getByTestId('candidate-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No active assignments');
  });

  test('Unmatched route renders branded 404 page', async ({ page }) => {
    await page.goto('/some-unknown-route-12345');

    await expect(page.getByText('404 • Not Found')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to Dashboard|Return Home/i })).toBeVisible();
  });
});

