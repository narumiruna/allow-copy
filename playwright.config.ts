import { defineConfig } from '@playwright/test'
import { TEST_ORIGIN } from './test/e2e/test-site'

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
    url: `${TEST_ORIGIN}/test-restriction.html`,
    reuseExistingServer: false,
  },
})
