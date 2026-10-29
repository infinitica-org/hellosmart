import { expect, test } from '@playwright/test';

test.describe('Suspended Organization Access Guard (BR-07, BR-20, BR-25)', () => {
  test('user belonging to a suspended organization cannot sign in', async ({ page, context }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('suspended@aster.seed.example.test');
    await page.getByTestId('password-input').fill('DevPassword123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Verify 403 error message is surfaced
    await expect(page.getByTestId('login-error-alert')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/suspended/i)).toBeVisible();

    // User remains on /login and is NOT redirected to portal
    await expect(page).toHaveURL(/\/login/);

    // No session cookie granted
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'hs_session');
    expect(sessionCookie).toBeUndefined();
  });
});

