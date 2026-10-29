import { expect, test, type Page } from "@playwright/test";

const candidateEmail = process.env.E2E_CANDIDATE_EMAIL ?? "complete@seed.example.test";
const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD ?? (process.env.SEED_DEFAULT_PASSWORD ?? "DevPassword123!");

async function signInAsCandidate(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(candidateEmail);
  await page.getByLabel(/password/i).fill(candidatePassword);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();

  // Confirm candidate is authenticated in the candidate portal
  await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
  await expect(
    page.getByRole("heading", { name: /Candidate (?:Assessment )?Workspace/i })
  ).toBeVisible();
}

test.describe("BR-25 Cross-Portal Tampering & Route Isolation", () => {
  test("candidate navigating directly to /admin is redirected to /candidate", async ({ page }) => {
    await signInAsCandidate(page);

    // Candidate attempts direct navigation to protected super-admin portal
    await page.goto("/admin");

    // Server-side middleware must enforce route isolation and redirect to /candidate
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);

    // Protected admin content must never be visible
    await expect(
      page.getByRole("heading", { name: /Platform Admin/i })
    ).not.toBeVisible();

    // Candidate portal content must remain visible
    await expect(
      page.getByRole("heading", { name: /Candidate (?:Assessment )?Workspace/i })
    ).toBeVisible();

    // Verify refreshing the URL does not bypass the role boundary
    await page.reload();
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
    await expect(
      page.getByRole("heading", { name: /Platform Admin/i })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Candidate (?:Assessment )?Workspace/i })
    ).toBeVisible();
  });

  test("candidate navigating directly to /company is redirected to /candidate", async ({ page }) => {
    await signInAsCandidate(page);

    // Candidate attempts direct navigation to protected company-admin portal
    await page.goto("/company");

    // Server-side middleware must enforce route isolation and redirect to /candidate
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);

    // Protected company content must never be visible
    await expect(
      page.getByRole("heading", { name: /Company Portal|Hiring Pipeline/i })
    ).not.toBeVisible();

    // Candidate portal content must remain visible
    await expect(
      page.getByRole("heading", { name: /Candidate (?:Assessment )?Workspace/i })
    ).toBeVisible();

    // Verify refreshing the URL does not bypass the role boundary
    await page.reload();
    await expect(page).toHaveURL(/\/candidate(?:[/?#]|$)/);
    await expect(
      page.getByRole("heading", { name: /Company Portal|Hiring Pipeline/i })
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Candidate (?:Assessment )?Workspace/i })
    ).toBeVisible();
  });
});
