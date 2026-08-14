import type { FeatureSettings, PendingSiteEnable } from '../types/extension'
import { normalizeFeatures, type StorageAreaLike } from './storage'

export const PENDING_SITE_ENABLE_KEY = 'pendingSiteEnable'

interface FinalizeDependencies {
  getPending(hostname: string): Promise<PendingSiteEnable | null>
  clearPending(hostname: string): Promise<void>
  setSiteConfig(hostname: string, enabled: boolean, features: FeatureSettings): Promise<void>
}

function getSessionStorage(): StorageAreaLike {
  return chrome.storage.session
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getHostnamesFromOrigins(origins: readonly string[] = []): string[] {
  const hostnames = new Set<string>()

  for (const origin of origins) {
    try {
      const normalizedOrigin = origin.endsWith('/*') ? origin.slice(0, -1) : origin
      const parsed = new URL(normalizedOrigin)
      if (parsed.hostname) hostnames.add(parsed.hostname)
    } catch {
      // Ignore malformed browser origin patterns.
    }
  }

  return [...hostnames]
}

async function getPendingSiteEnablements(
  storageArea: StorageAreaLike,
): Promise<Record<string, unknown>> {
  const result = await storageArea.get([PENDING_SITE_ENABLE_KEY])
  return isRecord(result[PENDING_SITE_ENABLE_KEY]) ? result[PENDING_SITE_ENABLE_KEY] : {}
}

export async function setPendingSiteEnable(
  hostname: string,
  features: FeatureSettings,
  storageArea: StorageAreaLike = getSessionStorage(),
): Promise<void> {
  const pending = await getPendingSiteEnablements(storageArea)
  pending[hostname] = { hostname, features: normalizeFeatures(features) }
  await storageArea.set({ [PENDING_SITE_ENABLE_KEY]: pending })
}

export async function getPendingSiteEnable(
  hostname: string,
  storageArea: StorageAreaLike = getSessionStorage(),
): Promise<PendingSiteEnable | null> {
  const pending = await getPendingSiteEnablements(storageArea)
  const candidate = pending[hostname]
  if (!isRecord(candidate) || candidate.hostname !== hostname) return null

  return {
    hostname,
    features: normalizeFeatures(candidate.features),
  }
}

export async function clearPendingSiteEnable(
  hostname: string,
  storageArea: StorageAreaLike = getSessionStorage(),
): Promise<void> {
  const pending = await getPendingSiteEnablements(storageArea)
  if (!Object.hasOwn(pending, hostname)) return

  delete pending[hostname]
  await storageArea.set({ [PENDING_SITE_ENABLE_KEY]: pending })
}

export async function finalizePendingSiteEnables(
  origins: readonly string[],
  dependencies: FinalizeDependencies,
): Promise<string[]> {
  const finalizedHostnames: string[] = []

  for (const hostname of getHostnamesFromOrigins(origins)) {
    const pending = await dependencies.getPending(hostname)
    if (!pending) continue

    await dependencies.setSiteConfig(hostname, true, pending.features)
    await dependencies.clearPending(hostname)
    finalizedHostnames.push(hostname)
  }

  return finalizedHostnames
}
