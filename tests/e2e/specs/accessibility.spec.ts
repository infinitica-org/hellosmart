import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Scans (Axe WCAG)', () => {
  test('Login page passes automated accessibility audit', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // custom palette handled by design tokens
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Admin overview page passes accessibility audit', async ({ page }) => {
    await page.goto('/admin');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

