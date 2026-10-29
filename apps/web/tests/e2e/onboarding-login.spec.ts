import { expect, test } from '@playwright/test';

test.describe('Onboarding Journey: Invite → Set Password → Login (S0-T15-1, CO-001, BR-24)', () => {
  test('Company Admin: accepts invitation, sets password, signs in, lands on /company', async ({ page }) => {
    // 1. Visit invitation link
    await page.goto('/accept-invite?token=valid-company-admin-token');

    // 2. Details rendered correctly
    await expect(page.getByText('Aster Ridge Technologies')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('new.admin@aster.seed.example.test')).toBeVisible();

    // 3. Set password
    const newPassword = 'Password123!@#';
    await page.getByLabel(/new password/i).fill(newPassword);
    await page.getByLabel(/confirm password/i).fill(newPassword);

    await page.getByRole('button', { name: /save password|set password|complete/i }).click();

    // 4. Redirects to /login
    await expect(page).toHaveURL(/\/login/);

    // 5. Sign in with newly created password
    await page.getByLabel(/email/i).fill('new.admin@aster.seed.example.test');
    await page.getByTestId('password-input').fill(newPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // 6. Role-based routing lands on /company
    await expect(page).toHaveURL(/\/company(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: /Company Portal|Hiring Pipeline/i })).toBeVisible();
  });

  test('Candidate: accepts invitation, sets password, signs in, lands on /candidate', async ({ page }) => {
    // 1. Visit invitation link
    await page.goto('/accept-invite?token=valid-candidate-token');

    // 2. Details rendered correctly
    await expect(page.getByText('Aster Ridge Technologies')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('new.candidate@aster.seed.example.test')).toBeVisible();

    // 3. Set password
    const newPassword = 'CandidatePass123!@#';
    await page.getByLabel(/new password/i).fill(newPassword);
    await page.getByLabel(/confirm password/i).fill(newPassword);

    await page.getByRole('button', { name: /save password|set password|complete/i }).click();

    // 4. Redirects to /login
    await expect(page).toHaveURL(/\/login/);

    // 5. Sign in with newly created password
    await page.getByLabel(/email/i).fill('new.candidate@aster.seed.example.test');
    await page.getByTestId('password-input').fill(newPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // 6. Role-based routing lands on /candidate
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: /Candidate (?:Assessment )?Workspace/i })).toBeVisible();
  });

  test('Expired invitation link shows error and prevents password setup', async ({ page }) => {
    await page.goto('/accept-invite?token=expired-invite-token');
    await expect(page.getByText(/link is no longer valid|expired|invalid/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /set password/i })).toHaveCount(0);
  });

  test('Already consumed invitation link shows error and prevents password setup', async ({ page }) => {
    await page.goto('/accept-invite?token=used-invite-token');
    await expect(page.getByText(/link is no longer valid|already.*accepted|invalid/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /set password/i })).toHaveCount(0);
  });

  test('Non-existent or malformed invitation link shows invalid notice', async ({ page }) => {
    await page.goto('/accept-invite?token=invalid-random-token-12345');
    await expect(page.getByText(/link is no longer valid|invalid/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /set password/i })).toHaveCount(0);
  });
});

