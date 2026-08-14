import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FEATURES,
  getAllSites,
  getSiteConfig,
  migrateStorage,
  normalizeSiteConfig,
  type StorageAreaLike,
  setSiteConfig,
  updateSiteFeatures,
} from '../src/lib/storage'

function createStorageArea(initialSites: Record<string, unknown> = {}) {
  let sites = structuredClone(initialSites)
  const area: StorageAreaLike = {
    async get() {
      return { sites: structuredClone(sites) }
    },
    async set(items) {
      if (Object.hasOwn(items, 'sites')) {
        sites = structuredClone(items.sites as Record<string, unknown>)
      }
    },
  }

  return { area, getSites: () => sites }
}

describe('site storage', () => {
  it('normalizes legacy, partial, and malformed records safely', () => {
    expect(normalizeSiteConfig(true)).toEqual({ enabled: true, features: DEFAULT_FEATURES })
    expect(
      normalizeSiteConfig({
        enabled: true,
        features: { textSelection: false, contextMenu: 'yes' },
      }),
    ).toEqual({
      enabled: true,
      features: { ...DEFAULT_FEATURES, textSelection: false },
    })
    expect(normalizeSiteConfig({ enabled: 'yes', features: null })).toEqual({
      enabled: false,
      features: DEFAULT_FEATURES,
    })
    expect(normalizeSiteConfig(null)).toEqual({ enabled: false, features: DEFAULT_FEATURES })
  })

  it('returns normalized site records without mutating storage', async () => {
    const storage = createStorageArea({ 'example.com': true })

    await expect(getAllSites(storage.area)).resolves.toEqual({
      'example.com': { enabled: true, features: DEFAULT_FEATURES },
    })
    expect(storage.getSites()).toEqual({ 'example.com': true })
  })

  it('keeps existing features and unknown fields when disabling', async () => {
    const storage = createStorageArea({
      'example.com': {
        enabled: true,
        futureField: { keep: true },
        features: { ...DEFAULT_FEATURES, textSelection: false, copyPaste: false },
      },
    })

    await setSiteConfig('example.com', false, null, storage.area)
    await expect(getSiteConfig('example.com', storage.area)).resolves.toEqual({
      enabled: false,
      features: { ...DEFAULT_FEATURES, textSelection: false, copyPaste: false },
    })
    expect(storage.getSites()['example.com']).toMatchObject({ futureField: { keep: true } })
  })

  it('keeps enabled state unchanged when updating features', async () => {
    const storage = createStorageArea({
      'example.com': { enabled: false, features: DEFAULT_FEATURES },
    })
    const features = { ...DEFAULT_FEATURES, contextMenu: false }

    await updateSiteFeatures('example.com', features, storage.area)

    await expect(getSiteConfig('example.com', storage.area)).resolves.toEqual({
      enabled: false,
      features,
    })
  })

  it('migrates only legacy booleans and preserves unknown records', async () => {
    const futureRecord = { enabled: true, futureField: 'keep', features: DEFAULT_FEATURES }
    const storage = createStorageArea({
      'legacy-true.com': true,
      'legacy-false.com': false,
      'future.com': futureRecord,
    })

    await migrateStorage(storage.area)

    expect(storage.getSites()).toEqual({
      'legacy-true.com': { enabled: true, features: DEFAULT_FEATURES },
      'legacy-false.com': { enabled: false, features: DEFAULT_FEATURES },
      'future.com': futureRecord,
    })
  })
})
