import { expect, test } from '@playwright/test';

const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? 'admin.super@seed.example.test';
const adminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'DevPassword123!';

test.describe('Platform Admin Pre-Auth MFA Flow (CO-001, BR-04, BR-25)', () => {
  test('password verification opens MFA modal without issuing session cookie', async ({ page, context }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Verify MFA modal appears
    await expect(page.getByTestId('mfa-dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /two-factor authentication/i })).toBeVisible();

    // Invariant: hs_session must NOT exist yet
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'hs_session');
    expect(sessionCookie).toBeUndefined();
  });

  test('invalid TOTP code displays error and keeps modal open', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByTestId('mfa-dialog')).toBeVisible();

    // Submit invalid code (e.g. 999999)
    await page.getByTestId('mfa-totp-input').fill('999999');
    await page.getByTestId('mfa-submit-button').click();

    // Expect invalid MFA error
    await expect(page.getByText(/invalid.*code|mfa.*invalid/i)).toBeVisible();
    await expect(page.getByTestId('mfa-dialog')).toBeVisible();
  });

  test('valid TOTP code issues session and redirects to /admin', async ({ page, context }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByTestId('mfa-dialog')).toBeVisible();

    // Submit deterministic test code (123456)
    await page.getByTestId('mfa-totp-input').fill('123456');
    await page.getByTestId('mfa-submit-button').click();

    // Invariant: Successfully routes to /admin
    await expect(page).toHaveURL(/\/admin(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: /Platform Admin/i })).toBeVisible();

    // Invariant: hs_session cookie is issued
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'hs_session');
    expect(sessionCookie).toBeDefined();
  });

  test('three failed TOTP attempts locks out and clears pre-auth', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(adminEmail);
    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByTestId('mfa-dialog')).toBeVisible();

    // Attempt 1: Fail
    await page.getByTestId('mfa-totp-input').fill('111111');
    await page.getByTestId('mfa-submit-button').click();
    await expect(page.getByText(/invalid.*code/i)).toBeVisible();

    // Attempt 2: Fail
    await page.getByTestId('mfa-totp-input').fill('222222');
    await page.getByTestId('mfa-submit-button').click();
    await expect(page.getByText(/invalid.*code/i)).toBeVisible();

    // Attempt 3: Lockout
    await page.getByTestId('mfa-totp-input').fill('333333');
    await page.getByTestId('mfa-submit-button').click();

    // Modal closes and error alert appears on login page
    await expect(page.getByTestId('login-error-alert')).toBeVisible();
    await expect(page.getByText(/too many failed.*attempts|pre-authentication.*invalidated/i)).toBeVisible();
  });
});

