import { expect, test, type Page } from "@playwright/test";

type Role = "super_admin" | "company_admin" | "candidate";

const users: Array<{ role: Role; email: string; password: string; landing: string }> = [
  {
    role: "super_admin",
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "super-admin@example.test",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "e2e-password",
    landing: "/admin",
  },
  {
    role: "company_admin",
    email: process.env.E2E_COMPANY_ADMIN_EMAIL ?? "company-admin@example.test",
    password: process.env.E2E_COMPANY_ADMIN_PASSWORD ?? "e2e-password",
    landing: "/company",
  },
  {
    role: "candidate",
    email: process.env.E2E_CANDIDATE_EMAIL ?? "candidate@example.test",
    password: process.env.E2E_CANDIDATE_PASSWORD ?? "e2e-password",
    landing: "/candidate",
  },
];

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
}

for (const user of users) {
  test(`routes ${user.role} to ${user.landing} after successful login`, async ({ page }) => {
    await signIn(page, user.email, user.password);
    await expect(page).toHaveURL(new RegExp(`${user.landing.replace("/", "\\/")}(?:[/?#]|$)`));
  });
}

test("shows a human-readable error for an incorrect password", async ({ page }) => {
  await signIn(page, "wrong-password@example.test", "definitely-wrong");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/incorrect|invalid|could not sign in|check your email or password/i);
});
