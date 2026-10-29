import { expect, test } from '@playwright/test';

test.describe('Session UX: Expiry Handling, Banners, and Safe Redirects (S0-T16-2)', () => {
  test('login page shows "Your session expired. Please sign in again." for session-expired reason', async ({ page }) => {
    await page.goto('/login?reason=session-expired');

    const alert = page.getByTestId('session-expired-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Your session expired\. Please sign in again\./i);
  });

  test('preserves validated same-origin ?from= redirect after sign in', async ({ page }) => {
    await page.goto('/login?reason=session-expired&from=/company');

    // Fill credentials for Company Admin
    await page.getByLabel(/email/i).fill('owner@aster.seed.example.test');
    await page.getByTestId('password-input').fill('DevPassword123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Verify redirected to /company
    await expect(page).toHaveURL(/\/company(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: /Company Portal|Hiring Pipeline/i })).toBeVisible();
  });

  test('rejects unsafe external ?from= redirect (e.g. https://evil.com) and defaults to role portal', async ({ page }) => {
    await page.goto('/login?from=https://evil.com');

    // Fill credentials for Candidate
    await page.getByLabel(/email/i).fill('complete@seed.example.test');
    await page.getByTestId('password-input').fill('DevPassword123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Verify candidate lands on safe /candidate portal, never evil.com
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
    expect(page.url()).not.toContain('evil.com');
  });

  test('user menu opens Active Sessions dialog showing "This device" badge', async ({ page }) => {
    // 1. Sign in as Company Admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('owner@aster.seed.example.test');
    await page.getByTestId('password-input').fill('DevPassword123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/company(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: /Company Portal|Hiring Pipeline/i })).toBeVisible();

    // 2. Open user navigation menu
    const userMenuButton = page.getByTestId('user-menu-trigger');
    await expect(userMenuButton).toBeVisible();
    await userMenuButton.click();

    // 3. Click Active Sessions
    const activeSessionsItem = page.getByTestId('active-sessions-menu-item');
    await expect(activeSessionsItem).toBeVisible();
    await activeSessionsItem.click();

    // 4. Verify Active Sessions dialog opens
    const dialog = page.getByRole('dialog', { name: /active sessions/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/This device/i)).toBeVisible();

    // 5. Close dialog
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});

