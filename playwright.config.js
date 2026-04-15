const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: 'node test/e2e/server.js',
    url: 'http://127.0.0.1:4173/test-restriction.html',
    reuseExistingServer: !process.env.CI,
  },
})
