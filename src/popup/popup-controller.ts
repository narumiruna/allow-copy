import { installContentScript } from '../content/install-content-script'
import { classifyPopupInjectionError, parseSupportedHttpUrl } from '../lib/extension-logic'
import { clearPendingSiteEnable, setPendingSiteEnable } from '../lib/site-enablement'
import { ensurePersistentSiteAccess, hasPersistentSiteAccessForUrl } from '../lib/site-permissions'
import { getSiteConfig, normalizeFeatures, setSiteConfig, updateSiteFeatures } from '../lib/storage'
import type {
  DetectionInfo,
  DetectionResults,
  FeatureSettings,
  RequestedTab,
} from '../types/extension'

const UI_STATE_KEY = 'uiState'

export interface ReadyPopupState {
  kind: 'ready'
  tab: RequestedTab
  hostname: string
  enabled: boolean
  features: FeatureSettings
  detectionResults: DetectionResults | null
  detectionUnavailable: boolean
  advancedExpanded: boolean
}

export interface UnavailablePopupState {
  kind: 'unsupported' | 'error'
  siteName: string
  message: string
}

export type PopupLoadState = ReadyPopupState | UnavailablePopupState

export interface EnabledMutationResult {
  enabled: boolean
  permissionDenied: boolean
  detectionResults: DetectionResults | null
}

export interface FeatureMutationResult {
  detectionResults: DetectionResults | null
}

export interface PopupApi {
  load(): Promise<PopupLoadState>
  setEnabled(
    tab: RequestedTab,
    hostname: string,
    enabled: boolean,
    features: FeatureSettings,
  ): Promise<EnabledMutationResult>
  setFeatures(
    tab: RequestedTab,
    hostname: string,
    enabled: boolean,
    previousFeatures: FeatureSettings,
    nextFeatures: FeatureSettings,
  ): Promise<FeatureMutationResult>
  setAdvancedExpanded(expanded: boolean): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDetectionResults(value: unknown): value is DetectionResults {
  if (!isRecord(value) || !isRecord(value.cssRestrictions) || !isRecord(value.jsRestrictions)) {
    return false
  }

  return [
    value.cssRestrictions.userSelect,
    value.cssRestrictions.pointerEvents,
    value.cssRestrictions.cursor,
    value.jsRestrictions.contextmenu,
    value.jsRestrictions.selectstart,
    value.jsRestrictions.copy,
  ].every((item) => typeof item === 'boolean')
}

function parseDetectionInfo(value: unknown): DetectionInfo | null {
  if (!isRecord(value) || !isDetectionResults(value.detectionResults)) return null

  return {
    detectionResults: value.detectionResults,
    isEnabled: value.isEnabled === true,
    features: normalizeFeatures(value.features),
  }
}

function getRequestedTab(): RequestedTab | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const tabId = Number(params.get('tabId'))
    const url = params.get('url')
    return Number.isInteger(tabId) && tabId > 0 && url ? { id: tabId, url } : null
  } catch {
    return null
  }
}

async function getCurrentTab(): Promise<RequestedTab | null> {
  const requestedTab = getRequestedTab()
  if (requestedTab) {
    if (!parseSupportedHttpUrl(requestedTab.url)) return requestedTab
    try {
      const actualTab = await chrome.tabs.get(requestedTab.id)
      if (actualTab.url === requestedTab.url) return requestedTab
    } catch {
      // Fall back to the real active tab when a stale test URL is supplied.
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return typeof tab?.id === 'number' && tab.url ? { id: tab.id, url: tab.url } : null
}

async function injectContentScript(tabId: number): Promise<void> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, { action: 'ping' })) as
      | { pong?: boolean }
      | undefined
    if (response?.pong) return
  } catch {
    // A missing listener is the expected first-injection path.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: installContentScript,
      injectImmediately: true,
    })
  } catch (error) {
    const classification = classifyPopupInjectionError(error)
    if (classification.shouldLog) console.error('Content script injection failed:', error)
    throw new Error(classification.error ?? 'Could not access this page')
  }
}

async function getDetectionInfo(tabId: number): Promise<DetectionInfo | null> {
  try {
    return parseDetectionInfo(await chrome.tabs.sendMessage(tabId, { action: 'getDetectionInfo' }))
  } catch {
    return null
  }
}

async function getAdvancedExpanded(): Promise<boolean> {
  try {
    const result = await chrome.storage.sync.get([UI_STATE_KEY])
    const uiState = result[UI_STATE_KEY]
    return isRecord(uiState) && uiState.advancedExpanded === true
  } catch {
    return false
  }
}

async function sendSiteMessage(tabId: number, message: Record<string, unknown>): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message)
  } catch {
    await injectContentScript(tabId)
    await chrome.tabs.sendMessage(tabId, message)
  }
}

async function rollbackSiteConfig(
  hostname: string,
  enabled: boolean,
  features: FeatureSettings,
): Promise<void> {
  try {
    await setSiteConfig(hostname, enabled, features)
  } catch (rollbackError) {
    console.error('Failed to roll back site configuration:', rollbackError)
  }
}

export const chromePopupApi: PopupApi = {
  async load() {
    const tab = await getCurrentTab()
    if (!tab) {
      return { kind: 'error', siteName: 'No active tab', message: 'Could not find the active tab' }
    }

    const parsedUrl = parseSupportedHttpUrl(tab.url)
    if (!parsedUrl) {
      return {
        kind: 'unsupported',
        siteName: 'Unsupported page',
        message: 'Not available on this page',
      }
    }

    const hostname = parsedUrl.hostname
    const config = await getSiteConfig(hostname)
    let enabled = config.enabled

    if (enabled && !(await hasPersistentSiteAccessForUrl(tab.url))) {
      enabled = false
      await setSiteConfig(hostname, false, config.features)
    }

    try {
      await injectContentScript(tab.id)
    } catch {
      return {
        kind: 'error',
        siteName: hostname,
        message: 'Could not run on this page',
      }
    }

    const [detectionInfo, advancedExpanded] = await Promise.all([
      getDetectionInfo(tab.id),
      getAdvancedExpanded(),
    ])

    return {
      kind: 'ready',
      tab,
      hostname,
      enabled,
      features: config.features,
      detectionResults: detectionInfo?.detectionResults ?? null,
      detectionUnavailable: detectionInfo === null,
      advancedExpanded,
    }
  },

  async setEnabled(tab, hostname, enabled, features) {
    const previousConfig = await getSiteConfig(hostname)

    if (enabled) {
      await setPendingSiteEnable(hostname, features)
      let granted = false
      try {
        granted = await ensurePersistentSiteAccess(hostname)
      } catch (error) {
        await clearPendingSiteEnable(hostname)
        throw error
      }

      if (!granted) {
        await clearPendingSiteEnable(hostname)
        return { enabled: false, permissionDenied: true, detectionResults: null }
      }
    } else {
      await clearPendingSiteEnable(hostname)
    }

    try {
      await setSiteConfig(hostname, enabled, enabled ? features : null)
      await sendSiteMessage(tab.id, {
        action: 'toggleSite',
        hostname,
        enabled,
        features,
      })
      await clearPendingSiteEnable(hostname)
    } catch (error) {
      await rollbackSiteConfig(hostname, previousConfig.enabled, previousConfig.features)
      await sendSiteMessage(tab.id, {
        action: 'toggleSite',
        hostname,
        enabled: previousConfig.enabled,
        features: previousConfig.features,
      }).catch(() => undefined)
      throw error
    }

    return {
      enabled,
      permissionDenied: false,
      detectionResults: (await getDetectionInfo(tab.id))?.detectionResults ?? null,
    }
  },

  async setFeatures(tab, hostname, enabled, previousFeatures, nextFeatures) {
    try {
      await updateSiteFeatures(hostname, nextFeatures)
      if (enabled) {
        await sendSiteMessage(tab.id, {
          action: 'updateFeatures',
          hostname,
          features: nextFeatures,
        })
      }
    } catch (error) {
      await rollbackSiteConfig(hostname, enabled, previousFeatures)
      if (enabled) {
        await sendSiteMessage(tab.id, {
          action: 'updateFeatures',
          hostname,
          features: previousFeatures,
        }).catch(() => undefined)
      }
      throw error
    }

    return {
      detectionResults: enabled
        ? ((await getDetectionInfo(tab.id))?.detectionResults ?? null)
        : null,
    }
  },

  async setAdvancedExpanded(expanded) {
    const result = await chrome.storage.sync.get([UI_STATE_KEY])
    const currentUiState = isRecord(result[UI_STATE_KEY]) ? result[UI_STATE_KEY] : {}
    await chrome.storage.sync.set({
      [UI_STATE_KEY]: { ...currentUiState, advancedExpanded: expanded },
    })
  },
}
