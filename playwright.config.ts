import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export default defineConfig({
  testDir: "./apps/web/tests/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "./playwright-report" }],
  ],
  timeout: 30_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "node tests/e2e/auth-mock-server.mjs",
          cwd: "./apps/web",
          url: "http://127.0.0.1:4000/healthz",
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 30_000,
        },
        {
          command: "node node_modules/next/dist/bin/next dev -p 3000",
          cwd: "./apps/web",
          url: baseURL,
          env: {
            API_BASE_URL: apiURL,
            NEXT_PUBLIC_API_URL: apiURL,
            PORT: "3000",
          },
          reuseExistingServer: true,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 60_000,
        },
      ],
});
