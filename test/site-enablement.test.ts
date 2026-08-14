import { describe, expect, it, vi } from 'vitest'
import {
  clearPendingSiteEnable,
  finalizePendingSiteEnables,
  getHostnamesFromOrigins,
  getPendingSiteEnable,
  setPendingSiteEnable,
} from '../src/lib/site-enablement'
import { DEFAULT_FEATURES, type StorageAreaLike } from '../src/lib/storage'

function createStorageArea(): StorageAreaLike & { value: Record<string, unknown> } {
  const area = {
    value: {} as Record<string, unknown>,
    async get() {
      return { ...area.value }
    },
    async set(items: Record<string, unknown>) {
      area.value = { ...area.value, ...items }
    },
  }
  return area
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

  it('finalizes only granted sites with pending state', async () => {
    const pending = new Map([
      ['example.com', { hostname: 'example.com', features: DEFAULT_FEATURES }],
    ])
    const setSiteConfig = vi.fn(async () => undefined)

    const finalized = await finalizePendingSiteEnables(
      ['https://example.com/*', 'https://not-pending.example/*'],
      {
        getPending: async (hostname) => pending.get(hostname) ?? null,
        clearPending: async (hostname) => {
          pending.delete(hostname)
        },
        setSiteConfig,
      },
    )

    expect(finalized).toEqual(['example.com'])
    expect(setSiteConfig).toHaveBeenCalledWith('example.com', true, DEFAULT_FEATURES)
    expect(pending.has('example.com')).toBe(false)
  })
})
