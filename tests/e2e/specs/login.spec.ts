import { test, expect } from '@playwright/test';

test.describe('Login Portal E2E - Form & Test Selectors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login page with all expected Playwright test selectors', async ({ page }) => {
    // Brand header
    await expect(page.getByRole('heading', { name: /Master Sign In/i })).toBeVisible();

    // Form inputs and buttons targeted by data-testid
    const emailInput = page.getByTestId('work-email-input');
    const passwordInput = page.getByTestId('password-input');
    const submitBtn = page.getByTestId('login-submit-button');
    const googleBtn = page.getByTestId('google-sso-button');
    const msBtn = page.getByTestId('microsoft-sso-button');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(googleBtn).toBeVisible();
    await expect(msBtn).toBeVisible();
  });

  test('interacts with email and password inputs cleanly', async ({ page }) => {
    const emailInput = page.getByTestId('work-email-input');
    const passwordInput = page.getByTestId('password-input');
    const submitBtn = page.getByTestId('login-submit-button');

    await emailInput.fill('platform.admin@hellosmart.ai');
    await expect(emailInput).toHaveValue('platform.admin@hellosmart.ai');

    await passwordInput.fill('AdminPassword123!');
    await expect(passwordInput).toHaveValue('AdminPassword123!');

    // Submit and verify reaction
    await submitBtn.click();
    // In mock/test environment without backend api running, verify error alert or feedback
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
  });

  test('shows SSO configuration status notice on SSO button click', async ({ page }) => {
    const googleBtn = page.getByTestId('google-sso-button');
    await googleBtn.click();

    const ssoNotice = page.getByTestId('sso-notice');
    await expect(ssoNotice).toBeVisible();
    await expect(ssoNotice).toContainText('Google SSO is not configured');

    const msBtn = page.getByTestId('microsoft-sso-button');
    await msBtn.click();
    await expect(ssoNotice).toContainText('Microsoft SSO is not configured');
  });
});

