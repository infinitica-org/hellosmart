import type { FullConfig } from '@playwright/test';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const apiURL = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

  // 1. Fail-fast check: API health endpoint
  try {
    const res = await fetch(`${apiURL}/api/v1/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `[HEALTH CHECK FAILED] API at ${apiURL}/api/v1/health did not answer within 10s: ${
        (err as Error).message
      }. Ensure the API server is started before running E2E tests.`,
    );
  }

  // 2. Fail-fast check: Web app login endpoint
  try {
    const res = await fetch(`${baseURL}/login`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `[HEALTH CHECK FAILED] Web app at ${baseURL}/login did not answer within 10s: ${
        (err as Error).message
      }. Ensure the Web server is started before running E2E tests.`,
    );
  }
}
