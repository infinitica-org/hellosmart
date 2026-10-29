import { expect, test, type Page } from "@playwright/test";

type Role = "platform_admin" | "company_admin" | "candidate";

interface UserFixture {
  role: Role;
  name: string;
  email: string;
  password: string;
  landing: string;
  pageHeading: RegExp;
}

const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "DevPassword123!";

const users: UserFixture[] = [
  {
    role: "platform_admin",
    name: "Super Admin",
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "admin.super@seed.example.test",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? defaultPassword,
    landing: "/admin",
    pageHeading: /Platform Admin/i,
  },
  {
    role: "company_admin",
    name: "Company Admin",
    email: process.env.E2E_COMPANY_ADMIN_EMAIL ?? "owner@aster.seed.example.test",
    password: process.env.E2E_COMPANY_ADMIN_PASSWORD ?? defaultPassword,
    landing: "/company",
    pageHeading: /Company Portal|Hiring Pipeline/i,
  },
  {
    role: "candidate",
    name: "Candidate",
    email: process.env.E2E_CANDIDATE_EMAIL ?? "complete@seed.example.test",
    password: process.env.E2E_CANDIDATE_PASSWORD ?? defaultPassword,
    landing: "/candidate",
    pageHeading: /Candidate (?:Assessment )?Workspace/i,
  },
];

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
}

test.describe("Master Login and Role-Based Routing (CO-001, CO-004)", () => {
  for (const user of users) {
    test(`routes ${user.name} (${user.role}) to ${user.landing} after successful login`, async ({ page }) => {
      await signIn(page, user.email, user.password);

      // Verify the final URL matches the user's role-authorized portal
      await expect(page).toHaveURL(new RegExp(`${user.landing.replace("/", "\\/")}(?:[/?#]|$)`));

      // Verify reliable page-level indicator that the correct portal loaded
      await expect(page.getByRole("heading", { name: user.pageHeading })).toBeVisible();

      // Ensure login failures were not mistaken for successful routing
      await expect(page.locator("main [role='alert']")).not.toBeVisible();
    });
  }

  test("shows a human-readable error for an incorrect password without exposing internals", async ({ page }) => {
    const validEmail = process.env.E2E_CANDIDATE_EMAIL ?? "complete@seed.example.test";
    await signIn(page, validEmail, "definitely-wrong-password");

    // Assert user remains unauthenticated on the login page
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);

    // Assert visible, accessible error alert appears in the form
    const alert = page.locator("main [role='alert']");
    await expect(alert).toBeVisible();

    // Assert human-readable, user-friendly copy
    await expect(alert).toContainText(/invalid credentials|check your email or password|incorrect/i);

    // Verify error does not expose stack traces, internal exceptions, or sensitive data
    const alertText = await alert.innerText();
    expect(alertText).not.toMatch(/stack|trace|exception|token|secret|undefined|null/i);
  });
});
