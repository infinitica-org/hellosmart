import { defineConfig, devices } from '@playwright/test';
import { URL } from 'node:url';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const apiURL = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const dbMigratorURL =
  process.env.DATABASE_MIGRATOR_URL ??
  'postgres://hs_owner:hs_owner_local@127.0.0.1:5432/hellosmart_test';

// Security Invariant: Hard refusal to execute against any non-local host
function assertLocalhost(urlStr: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`[SECURITY] Invalid ${name} URL: ${urlStr}`);
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error(
      `[SECURITY] E2E refused to run against non-local ${name} host: ${parsed.hostname}. Target must be localhost or 127.0.0.1.`,
    );
  }
}

assertLocalhost(baseURL, 'base URL');
assertLocalhost(apiURL, 'API URL');
assertLocalhost(dbMigratorURL, 'Database Migrator URL');

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single serial journey
  timeout: 120_000, // 120s explicit test timeout
  expect: { timeout: 10_000 }, // 10s explicit expect timeout
  globalSetup: './e2e/helpers/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL,
    headless: true,
    navigationTimeout: 30_000, // 30s explicit navigation timeout
    actionTimeout: 10_000, // 10s explicit action timeout
    // Sensitive data protection: traces, videos, and screenshots all OFF by default
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
