import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/testing/e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4181',
    browserName: 'chromium',
  },
});
