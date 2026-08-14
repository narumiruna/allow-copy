import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type BrowserContext, test as base, chromium, expect, type Worker } from '@playwright/test'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const builtExtensionRoot = path.join(projectRoot, 'dist/chrome')
const TEST_HOST_PERMISSIONS = ['http://127.0.0.1/*', 'https://127.0.0.1/*']

interface ExtensionFixtures {
  context: BrowserContext
  serviceWorker: Worker
  extensionId: string
  popupPath: string
}

async function createTestExtension(): Promise<{
  extensionRoot: string
  popupPath: string
}> {
  const extensionRoot = await mkdtemp(path.join(os.tmpdir(), 'allow-copy-extension-'))
  await cp(builtExtensionRoot, extensionRoot, { recursive: true })

  const manifestPath = path.join(extensionRoot, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    host_permissions?: string[]
    action?: { default_popup?: string }
  }
  manifest.host_permissions = TEST_HOST_PERMISSIONS
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  return {
    extensionRoot,
    popupPath: manifest.action?.default_popup ?? 'action/index.html',
  }
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({ browserName: _browserName }, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'allow-copy-playwright-'))
    const { extensionRoot } = await createTestExtension()
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionRoot}`, `--load-extension=${extensionRoot}`],
    })

    try {
      await use(context)
    } finally {
      await context.close()
      await rm(extensionRoot, { recursive: true, force: true })
      await rm(userDataDir, { recursive: true, force: true })
    }
  },

  serviceWorker: async ({ context }, use) => {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    await use(serviceWorker)
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).hostname
    await use(extensionId)
  },

  popupPath: async ({ browserName: _browserName }, use) => {
    const manifest = JSON.parse(
      await readFile(path.join(builtExtensionRoot, 'manifest.json'), 'utf8'),
    ) as { action?: { default_popup?: string } }
    await use(manifest.action?.default_popup ?? 'action/index.html')
  },
})

export { expect }
