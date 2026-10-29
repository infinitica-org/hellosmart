import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec,e2e-spec}.ts', 'src/**/*.{test,spec}.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
