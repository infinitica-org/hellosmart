import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.{test,spec,e2e-spec}.ts', 'src/**/*.{test,spec}.ts'],
  },
});
