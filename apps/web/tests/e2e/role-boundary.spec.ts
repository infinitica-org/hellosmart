import { expect, test, type Page } from "@playwright/test";

const candidateEmail = process.env.E2E_CANDIDATE_EMAIL ?? "candidate@example.test";
const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD ?? "e2e-password";

async function signInAsCandidate(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(candidateEmail);
  await page.getByLabel(/password/i).fill(candidatePassword);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
}

for (const protectedPath of ["/admin", "/company"]) {
  test(`candidate cannot access ${protectedPath}`, async ({ page }) => {
    await signInAsCandidate(page);
    await page.goto(protectedPath);
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
  });
}
