import { FEATURE_KEYS, type FeatureSettings, type SiteConfig } from '../types/extension'

const SITES_KEY = 'sites'

export interface StorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export const DEFAULT_FEATURES: FeatureSettings = Object.freeze({
  textSelection: true,
  contextMenu: true,
  copyPaste: true,
  cursor: true,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSyncStorage(): StorageAreaLike {
  return chrome.storage.sync
}

export function normalizeFeatures(value: unknown): FeatureSettings {
  const candidate = isRecord(value) ? value : {}
  const features = { ...DEFAULT_FEATURES }

  for (const key of FEATURE_KEYS) {
    if (typeof candidate[key] === 'boolean') {
      features[key] = candidate[key]
    }
  }

  return features
}

export function normalizeSiteConfig(value: unknown): SiteConfig {
  if (typeof value === 'boolean') {
    return { enabled: value, features: { ...DEFAULT_FEATURES } }
  }

  if (!isRecord(value)) {
    return { enabled: false, features: { ...DEFAULT_FEATURES } }
  }

  const enabled = typeof value.enabled === 'boolean' ? value.enabled : value.enabled === undefined

  return {
    enabled,
    features: normalizeFeatures(value.features),
  }
}

async function getRawSites(storageArea: StorageAreaLike): Promise<Record<string, unknown>> {
  const result = await storageArea.get([SITES_KEY])
  return isRecord(result[SITES_KEY]) ? result[SITES_KEY] : {}
}

export async function getAllSites(
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<Record<string, SiteConfig>> {
  const sites = await getRawSites(storageArea)
  return Object.fromEntries(
    Object.entries(sites).map(([hostname, config]) => [hostname, normalizeSiteConfig(config)]),
  )
}

export async function getSiteConfig(
  hostname: string,
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<SiteConfig> {
  const sites = await getRawSites(storageArea)
  return Object.hasOwn(sites, hostname)
    ? normalizeSiteConfig(sites[hostname])
    : { enabled: false, features: { ...DEFAULT_FEATURES } }
}

export async function isSiteEnabled(
  hostname: string,
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<boolean> {
  return (await getSiteConfig(hostname, storageArea)).enabled
}

export async function setSiteConfig(
  hostname: string,
  enabled: boolean,
  features: FeatureSettings | null = null,
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<void> {
  const sites = await getRawSites(storageArea)
  const existingRaw = isRecord(sites[hostname]) ? sites[hostname] : {}
  const existingFeaturesRaw = isRecord(existingRaw.features) ? existingRaw.features : {}
  const existingConfig = normalizeSiteConfig(existingRaw)
  const nextFeatures = normalizeFeatures(
    features ?? (enabled ? DEFAULT_FEATURES : existingConfig.features),
  )

  sites[hostname] = {
    ...existingRaw,
    enabled,
    features: {
      ...existingFeaturesRaw,
      ...nextFeatures,
    },
  }

  await storageArea.set({ [SITES_KEY]: sites })
}

export async function updateSiteFeatures(
  hostname: string,
  features: FeatureSettings,
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<void> {
  const config = await getSiteConfig(hostname, storageArea)
  await setSiteConfig(hostname, config.enabled, features, storageArea)
}

export async function migrateStorage(
  storageArea: StorageAreaLike = getSyncStorage(),
): Promise<void> {
  const sites = await getRawSites(storageArea)
  let migrated = false

  for (const [hostname, config] of Object.entries(sites)) {
    if (typeof config !== 'boolean') continue
    sites[hostname] = normalizeSiteConfig(config)
    migrated = true
  }

  if (migrated) {
    await storageArea.set({ [SITES_KEY]: sites })
  }
}
