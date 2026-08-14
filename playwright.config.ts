import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: 'tsx test/e2e/server.ts',
    url: 'http://127.0.0.1:4173/test-restriction.html',
    reuseExistingServer: !process.env.CI,
  },
})
