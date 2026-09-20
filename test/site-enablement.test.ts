import { describe, expect, it } from 'vitest'
import {
  clearPendingSiteEnable,
  finalizePendingSiteEnables,
  getHostnamesFromOrigins,
  getPendingSiteEnable,
  setPendingSiteEnable,
} from '../src/lib/site-enablement'
import { DEFAULT_FEATURES, getSiteConfig } from '../src/lib/storage'
import { createStorageArea } from './helpers/storage'

function setupFinalization() {
  const session = createStorageArea()
  const sync = createStorageArea()
  const finalize = (origins: string[]) => finalizePendingSiteEnables(origins, session, sync)
  return { session, sync, finalize }
}

describe('pending site enablement', () => {
  it('extracts unique hostnames and ignores malformed origins', () => {
    expect(
      getHostnamesFromOrigins(['https://example.com/*', 'http://example.com/*', 'not an origin']),
    ).toEqual(['example.com'])
  })

  it('stores, reads, and clears pending feature state', async () => {
    const storage = createStorageArea()
    await setPendingSiteEnable('example.com', DEFAULT_FEATURES, storage)
    await expect(getPendingSiteEnable('example.com', storage)).resolves.toEqual({
      hostname: 'example.com',
      features: DEFAULT_FEATURES,
    })
    await clearPendingSiteEnable('example.com', storage)
    await expect(getPendingSiteEnable('example.com', storage)).resolves.toBeNull()
  })

  it.each([null, [], true, { hostname: 'other.example' }])(
    'ignores malformed pending state: %j',
    async (candidate) => {
      const session = createStorageArea({ pendingSiteEnable: { 'example.com': candidate } })
      expect(await getPendingSiteEnable('example.com', session)).toBeNull()
    },
  )

  it('normalizes partial features in valid pending state', async () => {
    const session = createStorageArea({
      pendingSiteEnable: {
        'example.com': { hostname: 'example.com', features: { cursor: false, contextMenu: 'yes' } },
      },
    })
    expect(await getPendingSiteEnable('example.com', session)).toEqual({
      hostname: 'example.com',
      features: { ...DEFAULT_FEATURES, cursor: false },
    })
  })

  it('finalizes granted hosts once and retains unrelated pending state', async () => {
    const { session, sync, finalize } = setupFinalization()
    const features = { ...DEFAULT_FEATURES, cursor: false }
    await setPendingSiteEnable('example.com', features, session)
    await setPendingSiteEnable('ungranted.example', DEFAULT_FEATURES, session)

    expect(
      await finalize([
        'https://example.com/*',
        'http://example.com/*',
        'https://not-pending.example/*',
      ]),
    ).toEqual(['example.com'])
    expect(await getSiteConfig('example.com', sync)).toEqual({ enabled: true, features })
    expect(sync.set).toHaveBeenCalledTimes(1)
    expect(await getPendingSiteEnable('example.com', session)).toBeNull()
    expect(await getPendingSiteEnable('ungranted.example', session)).not.toBeNull()
  })

  it('retains pending state when the site write fails', async () => {
    const { session, sync, finalize } = setupFinalization()
    await setPendingSiteEnable('example.com', DEFAULT_FEATURES, session)
    sync.set.mockRejectedValueOnce(new Error('sync write failed'))

    await expect(finalize(['https://example.com/*'])).rejects.toThrow('sync write failed')
    expect(await getPendingSiteEnable('example.com', session)).not.toBeNull()
    expect(await getSiteConfig('example.com', sync)).toEqual({
      enabled: false,
      features: DEFAULT_FEATURES,
    })
  })

  it('writes before clearing and can retry after a failed pending clear', async () => {
    const { session, sync, finalize } = setupFinalization()
    await setPendingSiteEnable('example.com', DEFAULT_FEATURES, session)
    session.set.mockImplementationOnce(async () => {
      expect(await getSiteConfig('example.com', sync)).toEqual({
        enabled: true,
        features: DEFAULT_FEATURES,
      })
      throw new Error('session clear failed')
    })
    await expect(finalize(['https://example.com/*'])).rejects.toThrow('session clear failed')
    expect(await getPendingSiteEnable('example.com', session)).not.toBeNull()

    expect(await finalize(['https://example.com/*'])).toEqual(['example.com'])
    expect(await getPendingSiteEnable('example.com', session)).toBeNull()
  })
})
