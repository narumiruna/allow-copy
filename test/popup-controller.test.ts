import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPendingSiteEnable, setPendingSiteEnable } from '../src/lib/site-enablement'
import { DEFAULT_FEATURES, getSiteConfig } from '../src/lib/storage'
import { chromePopupApi } from '../src/popup/popup-controller'
import type { SiteConfig } from '../src/types/extension'
import { createStorageArea } from './helpers/storage'

const hostname = 'example.com'
const tab = { id: 7, url: `https://${hostname}/article` }
const features = { ...DEFAULT_FEATURES, cursor: false }
const previousConfig = { enabled: false, features }

function setup(config: SiteConfig = previousConfig) {
  const sync = createStorageArea({ sites: { [hostname]: config } })
  const session = createStorageArea()
  const sendMessage = vi.fn(async (_tabId: number, _message: unknown) => ({ success: true }))
  const executeScript = vi.fn(async () => [])
  const contains = vi.fn(async () => false)
  const request = vi.fn(async () => true)
  vi.stubGlobal('window', { location: { search: '' } })
  vi.stubGlobal('chrome', {
    storage: { sync, session },
    permissions: { contains, request },
    scripting: { executeScript },
    tabs: { query: vi.fn(async () => [tab]), sendMessage },
  })
  return { sync, session, sendMessage, executeScript, contains, request }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('popup controller mutations', () => {
  it('saves pending features before requesting access and clears them after enabling', async () => {
    const { request, sendMessage } = setup()
    request.mockImplementation(async () => {
      expect(await getPendingSiteEnable(hostname)).toEqual({ hostname, features })
      expect(await getSiteConfig(hostname)).toEqual(previousConfig)
      return true
    })

    await expect(chromePopupApi.setEnabled(tab, hostname, true, features)).resolves.toEqual({
      enabled: true,
      permissionDenied: false,
    })

    expect(await getSiteConfig(hostname)).toEqual({ enabled: true, features })
    expect(await getPendingSiteEnable(hostname)).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith(tab.id, {
      action: 'toggleSite',
      hostname,
      enabled: true,
      features,
    })
  })

  it('does not request access again when it is already granted', async () => {
    const { contains, request } = setup()
    contains.mockResolvedValue(true)
    await chromePopupApi.setEnabled(tab, hostname, true, features)
    expect(request).not.toHaveBeenCalled()
    expect(await getSiteConfig(hostname)).toEqual({ enabled: true, features })
  })

  it('preserves the stored features when disabling a stale popup and clears pending state', async () => {
    const { request, sendMessage } = setup({ enabled: true, features })
    await setPendingSiteEnable(hostname, features)
    await chromePopupApi.setEnabled(tab, hostname, false, DEFAULT_FEATURES)

    expect(await getSiteConfig(hostname)).toEqual({ enabled: false, features })
    expect(await getPendingSiteEnable(hostname)).toBeNull()
    expect(request).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledWith(tab.id, {
      action: 'toggleSite',
      hostname,
      enabled: false,
      features: DEFAULT_FEATURES,
    })
  })

  it('preserves features changed while clearing pending state before disabling', async () => {
    const { sync, session } = setup({ enabled: true, features: DEFAULT_FEATURES })
    await setPendingSiteEnable(hostname, DEFAULT_FEATURES)
    const clear = session.set.getMockImplementation()
    if (!clear) throw new Error('Storage fake must implement set')
    session.set.mockImplementationOnce(async (items) => {
      await sync.set({ sites: { [hostname]: { enabled: true, features } } })
      await clear(items)
    })

    await chromePopupApi.setEnabled(tab, hostname, false, DEFAULT_FEATURES)
    expect(await getSiteConfig(hostname)).toEqual({ enabled: false, features })
  })

  it('preserves the features seen by the disable write when sync changes between reads', async () => {
    const { sync } = setup({ enabled: true, features })
    let latestFeatures = features
    // Each read sees a newer sync update, including the read used to merge the write.
    sync.get.mockImplementation(async () => {
      latestFeatures = { ...latestFeatures, cursor: !latestFeatures.cursor }
      return { sites: { [hostname]: { enabled: true, features: latestFeatures } } }
    })

    await chromePopupApi.setEnabled(tab, hostname, false, DEFAULT_FEATURES)

    expect(sync.snapshot()).toEqual({
      sites: { [hostname]: { enabled: false, features: latestFeatures } },
    })
  })

  it('clears pending state without saving or messaging when access is denied', async () => {
    const { request, sync, sendMessage } = setup()
    request.mockResolvedValue(false)
    await expect(chromePopupApi.setEnabled(tab, hostname, true, features)).resolves.toEqual({
      enabled: false,
      permissionDenied: true,
    })
    expect(await getPendingSiteEnable(hostname)).toBeNull()
    expect(sync.set).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('clears pending state when the permission API throws', async () => {
    const { request, sync } = setup()
    const error = new Error('permission request failed')
    request.mockRejectedValue(error)
    await expect(chromePopupApi.setEnabled(tab, hostname, true, features)).rejects.toBe(error)
    expect(await getPendingSiteEnable(hostname)).toBeNull()
    expect(sync.set).not.toHaveBeenCalled()
  })

  it('does not request access if pending state cannot be saved', async () => {
    const { session, request, sync } = setup()
    session.set.mockRejectedValueOnce(new Error('session write failed'))
    await expect(chromePopupApi.setEnabled(tab, hostname, true, features)).rejects.toThrow(
      'session write failed',
    )
    expect(request).not.toHaveBeenCalled()
    expect(sync.set).not.toHaveBeenCalled()
  })

  it('reinjects and retries a failed message before completing enablement', async () => {
    const { sendMessage, executeScript } = setup()
    sendMessage.mockRejectedValueOnce(new Error('receiving end does not exist'))
    await chromePopupApi.setEnabled(tab, hostname, true, features)
    expect(executeScript).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(await getSiteConfig(hostname)).toEqual({ enabled: true, features })
    expect(await getPendingSiteEnable(hostname)).toBeNull()
  })

  it.each(['storage', 'message'] as const)(
    'rolls back enablement after a %s failure',
    async (failure) => {
      const { sync, sendMessage } = setup()
      const error = new Error('save failed')
      if (failure === 'storage') sync.set.mockRejectedValueOnce(error)
      else sendMessage.mockRejectedValueOnce(error).mockRejectedValueOnce(error)

      await expect(chromePopupApi.setEnabled(tab, hostname, true, features)).rejects.toBe(error)
      expect(await getSiteConfig(hostname)).toEqual(previousConfig)
      expect(sendMessage).toHaveBeenLastCalledWith(tab.id, {
        action: 'toggleSite',
        hostname,
        ...previousConfig,
      })
      // Existing recovery leaves pending enablement available after a granted mutation fails.
      expect(await getPendingSiteEnable(hostname)).toEqual({ hostname, features })
    },
  )

  it.each([false, true])('updates features without changing stored enabled=%s', async (enabled) => {
    const { sendMessage } = setup({ enabled, features: DEFAULT_FEATURES })
    await chromePopupApi.setFeatures(tab, hostname, enabled, DEFAULT_FEATURES, features)
    expect(await getSiteConfig(hostname)).toEqual({ enabled, features })
    expect(sendMessage).toHaveBeenCalledTimes(enabled ? 1 : 0)
  })

  it.each(['storage', 'message'] as const)(
    'rolls back features after a %s failure',
    async (failure) => {
      const { sync, sendMessage } = setup({ enabled: true, features: DEFAULT_FEATURES })
      const error = new Error('feature save failed')
      if (failure === 'storage') sync.set.mockRejectedValueOnce(error)
      else sendMessage.mockRejectedValueOnce(error).mockRejectedValueOnce(error)

      await expect(
        chromePopupApi.setFeatures(tab, hostname, true, DEFAULT_FEATURES, features),
      ).rejects.toBe(error)
      expect(await getSiteConfig(hostname)).toEqual({ enabled: true, features: DEFAULT_FEATURES })
      expect(sendMessage).toHaveBeenLastCalledWith(tab.id, {
        action: 'updateFeatures',
        hostname,
        features: DEFAULT_FEATURES,
      })
    },
  )

  it('retains stored enablement but uses popup enablement to decide whether to message', async () => {
    const { sendMessage } = setup({ enabled: true, features: DEFAULT_FEATURES })
    await chromePopupApi.setFeatures(tab, hostname, false, DEFAULT_FEATURES, features)
    expect(await getSiteConfig(hostname)).toEqual({ enabled: true, features })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('rolls back to the popup snapshot, not newer storage, after a stale feature mutation fails', async () => {
    const { sync, sendMessage } = setup({ enabled: true, features })
    sync.set.mockRejectedValueOnce(new Error('save failed'))
    await expect(
      chromePopupApi.setFeatures(tab, hostname, false, DEFAULT_FEATURES, features),
    ).rejects.toThrow('save failed')
    expect(await getSiteConfig(hostname)).toEqual({ enabled: false, features: DEFAULT_FEATURES })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('preserves the original error even when storage and message rollback also fail', async () => {
    const { sync, sendMessage } = setup()
    const error = new Error('original save failure')
    sync.set.mockRejectedValue(error)
    sendMessage.mockRejectedValue(new Error('rollback message failed'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      chromePopupApi.setFeatures(tab, hostname, true, DEFAULT_FEATURES, features),
    ).rejects.toBe(error)
    expect(log).toHaveBeenCalledWith('Failed to roll back site configuration:', error)
  })

  it('disables saved enablement when persistent access has been removed', async () => {
    setup({ enabled: true, features })
    await expect(chromePopupApi.load()).resolves.toMatchObject({
      kind: 'ready',
      enabled: false,
      features,
    })
    expect(await getSiteConfig(hostname)).toEqual({ enabled: false, features })
  })
})
