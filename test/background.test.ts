import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FEATURES, getSiteConfig } from '../src/lib/storage'
import { createStorageArea } from './helpers/storage'

const hostname = 'example.com'
const features = { ...DEFAULT_FEATURES, cursor: false }

async function setup(enabled = false) {
  const sync = createStorageArea({ sites: { [hostname]: { enabled, features } } })
  const session = createStorageArea({ pendingSiteEnable: { [hostname]: { hostname, features } } })
  const executeScript = vi.fn(async () => [])
  const setBadgeText = vi.fn(async () => undefined)
  const setBadgeBackgroundColor = vi.fn(async () => undefined)
  let installed: (() => void) | undefined
  let permissionAdded: ((permissions: { origins?: string[] }) => void) | undefined

  vi.stubGlobal('chrome', {
    action: { setBadgeText, setBadgeBackgroundColor },
    permissions: {
      contains: vi.fn(async () => true),
      onAdded: {
        addListener: (listener: typeof permissionAdded) => {
          permissionAdded = listener
        },
      },
    },
    runtime: {
      onInstalled: {
        addListener: (listener: typeof installed) => {
          installed = listener
        },
      },
    },
    scripting: { executeScript },
    storage: { onChanged: { addListener: vi.fn() }, session, sync },
    tabs: {
      get: vi.fn(),
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      query: vi.fn(async () => [{ id: 7, url: `https://${hostname}/article` }]),
    },
    webNavigation: { onCommitted: { addListener: vi.fn() } },
  })
  await import('../src/background')
  if (!installed || !permissionAdded) throw new Error('Background listeners were not registered')
  return {
    sync,
    session,
    executeScript,
    setBadgeText,
    setBadgeBackgroundColor,
    installed,
    permissionAdded,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('background reconciliation', () => {
  it('restores an enabled permitted tab after installation', async () => {
    const { installed, setBadgeText, setBadgeBackgroundColor, executeScript } = await setup(true)
    installed()
    await vi.waitFor(() => {
      expect(setBadgeText).toHaveBeenCalledWith({ text: '✓', tabId: 7 })
      expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#46a758', tabId: 7 })
      expect(executeScript).toHaveBeenCalled()
    })
  })

  it('finishes pending enablement after permission is granted without a popup', async () => {
    const { permissionAdded, sync, session, executeScript, setBadgeText } = await setup()
    permissionAdded({ origins: ['http://example.com/*', 'https://example.com/*'] })
    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(1))
    expect(await getSiteConfig(hostname, sync)).toEqual({ enabled: true, features })
    expect(session.snapshot()).toEqual({ pendingSiteEnable: {} })
    expect(sync.set).toHaveBeenCalledTimes(1)
    expect(setBadgeText).toHaveBeenCalledWith({ text: '✓', tabId: 7 })
  })

  it('retains pending state and avoids injection when finalization fails', async () => {
    const { permissionAdded, sync, session, executeScript } = await setup()
    const error = new Error('sync unavailable')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    sync.set.mockRejectedValue(error)
    permissionAdded({ origins: ['https://example.com/*'] })
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('Error finalizing granted site permissions:', error),
    )
    expect(session.snapshot()).toEqual({
      pendingSiteEnable: { [hostname]: { hostname, features } },
    })
    expect(executeScript).not.toHaveBeenCalled()
  })
})
