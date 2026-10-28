import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['test/**/*.test.ts'],
      exclude: ['test/cross-tenant.test.ts', 'test/stack-e2e.test.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
  {
    test: {
      name: 'tenancy',
      environment: 'node',
      include: ['test/cross-tenant.test.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
  {
    test: {
      name: 'e2e',
      environment: 'node',
      include: ['test/stack-e2e.test.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
]);

