const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test: base, expect, chromium } = require('@playwright/test')

const projectRoot = path.resolve(__dirname, '../..')
const TEST_HOST_PERMISSIONS = [
  'http://127.0.0.1/*',
  'https://127.0.0.1/*',
  'http://www.izaax.net/*',
  'https://www.izaax.net/*',
]

async function createTestExtension() {
  const extensionRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'allow-copy-extension-'))
  await fs.cp(projectRoot, extensionRoot, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(projectRoot, source)

      if (!relativePath) return true

      return ![
        '.git',
        'node_modules',
        'playwright-report',
        'test-results',
      ].some((segment) => relativePath === segment || relativePath.startsWith(`${segment}${path.sep}`))
    },
  })

  const manifestPath = path.join(extensionRoot, 'manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  manifest.host_permissions = TEST_HOST_PERMISSIONS
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  return extensionRoot
}

const test = base.extend({
  context: async ({ browserName: _browserName }, use) => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'allow-copy-playwright-'))
    const extensionRoot = await createTestExtension()
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionRoot}`,
        `--load-extension=${extensionRoot}`,
      ],
    })

    await use(context)

    await context.close()
    await fs.rm(extensionRoot, { recursive: true, force: true })
    await fs.rm(userDataDir, { recursive: true, force: true })
  },

  serviceWorker: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }

    await use(serviceWorker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = serviceWorker.url().split('/')[2]
    await use(extensionId)
  },
})

module.exports = {
  test,
  expect,
}
