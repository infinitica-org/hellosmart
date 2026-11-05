import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/e2e/**', '**/.next/**'],
    env: {
      // Enable dev account fixture for unit tests only.
      // This flag is intentionally absent from staging and production env.
      NODE_ENV: 'development',
      ENABLE_DEV_ACCOUNTS: 'true',
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'lucide-react'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
      'react-dom/client': path.resolve(__dirname, './node_modules/react-dom/client.js'),
      'react-dom/server': path.resolve(__dirname, './node_modules/react-dom/server.node.js'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom/index.js'),
      'react': path.resolve(__dirname, './node_modules/react/index.js'),
    },
  },
});

