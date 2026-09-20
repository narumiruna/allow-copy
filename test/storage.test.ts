import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FEATURES,
  getSiteConfig,
  migrateStorage,
  normalizeSiteConfig,
  setSiteConfig,
} from '../src/lib/storage'

import { createStorageArea as createMemoryStorage } from './helpers/storage'

function createStorageArea(sites: Record<string, unknown> = {}) {
  const area = createMemoryStorage({ sites })
  return { area, getSites: () => area.snapshot().sites as Record<string, unknown> }
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

  it('keeps existing features and unknown fields when disabling', async () => {
    const storage = createStorageArea({
      'example.com': {
        enabled: true,
        futureField: { keep: true },
        features: { ...DEFAULT_FEATURES, textSelection: false, copyPaste: false },
      },
    })

    const config = await getSiteConfig('example.com', storage.area)
    await setSiteConfig('example.com', { ...config, enabled: false }, storage.area)
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

    const config = await getSiteConfig('example.com', storage.area)
    await setSiteConfig('example.com', { ...config, features }, storage.area)

    await expect(getSiteConfig('example.com', storage.area)).resolves.toEqual({
      enabled: false,
      features,
    })
  })

  it('preserves unknown feature fields and unrelated sites when writing', async () => {
    const storage = createStorageArea({
      'example.com': {
        enabled: false,
        futureField: 'keep',
        features: { ...DEFAULT_FEATURES, futureFeature: { keep: true } },
      },
      'other.example': true,
    })
    const features = { ...DEFAULT_FEATURES, cursor: false }

    await setSiteConfig('example.com', { enabled: true, features }, storage.area)

    expect(storage.getSites()).toEqual({
      'example.com': {
        enabled: true,
        futureField: 'keep',
        features: { ...features, futureFeature: { keep: true } },
      },
      'other.example': true,
    })
  })

  it.each([
    { record: true, enabled: true, features: DEFAULT_FEATURES },
    { record: false, enabled: false, features: DEFAULT_FEATURES },
    { record: null, enabled: false, features: DEFAULT_FEATURES },
    { record: [], enabled: false, features: DEFAULT_FEATURES },
    {
      record: { features: { cursor: false } },
      enabled: true,
      features: { ...DEFAULT_FEATURES, cursor: false },
    },
  ])('reads legacy or malformed record $record safely', async ({ record, enabled, features }) => {
    const storage = createStorageArea({ 'example.com': record })
    expect(await getSiteConfig('example.com', storage.area)).toEqual({ enabled, features })
  })

  it('fails closed for a malformed sites container', async () => {
    const storage = createMemoryStorage({ sites: [] })
    expect(await getSiteConfig('example.com', storage)).toEqual({
      enabled: false,
      features: DEFAULT_FEATURES,
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
