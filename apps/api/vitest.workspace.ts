import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['test/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
      exclude: [
        'test/cross-tenant.test.ts',
        'test/stack-e2e.test.ts',
        'test/**/*.e2e-spec.ts',
        'test/security/**',
        'test/timing/**/*.{test,spec}.ts',
        'test/jobs/**/*.{test,spec}.ts',
      ],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
  {
    test: {
      name: 'timing',
      environment: 'node',
      include: ['test/timing/**/*.{test,spec}.ts', 'test/jobs/**/*.{test,spec}.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
  {
    test: {
      name: 'tenancy',
      environment: 'node',
      include: ['test/cross-tenant.test.ts', 'test/security/**/*.spec.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  },
  {
    test: {
      name: 'e2e',
      environment: 'node',
      include: ['test/stack-e2e.test.ts', 'test/**/*.e2e-spec.ts'],
      setupFiles: ['test/setup.ts'],
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },
  },
]);
