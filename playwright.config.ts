import { defineConfig } from '@playwright/test';

// End-to-end tests drive the real Electron app (MILESTONES §3). Build first: npm run build:app
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
