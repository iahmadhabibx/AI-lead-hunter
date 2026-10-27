import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV ??= 'test';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.API_URL ??= 'http://localhost:3001';
process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-chars';
process.env.AI_PROVIDER ??= 'mock';
process.env.LOG_LEVEL ??= 'error';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 60000,
    setupFiles: ['./src/test/setup-integration.ts'],
  },
  esbuild: {
    target: 'es2022',
    keepNames: true,
  },
});
