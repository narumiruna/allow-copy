import { executeInstallContentScript } from './content/install-content-script'
import { parseSupportedHostname, shouldLogBackgroundInjectionError } from './lib/extension-logic'
import { finalizePendingSiteEnables } from './lib/site-enablement'
import { hasPersistentSiteAccessForUrl } from './lib/site-permissions'
import { isSiteEnabled, migrateStorage } from './lib/storage'

const BADGE_CONFIG = {
  enabled: { text: '✓', color: '#46a758' },
  disabled: { text: '' },
} as const

async function isSiteEnabledForUrl(url: string): Promise<boolean> {
  const hostname = parseSupportedHostname(url)
  if (!hostname || !(await isSiteEnabled(hostname))) return false
  return hasPersistentSiteAccessForUrl(url)
}

async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    await executeInstallContentScript(tabId)
    return true
  } catch (error) {
    if (shouldLogBackgroundInjectionError(error)) {
      console.error('Unexpected error injecting content script:', error)
    }
    return false
  }
}

async function updateBadge(tabId: number, url: string | undefined): Promise<void> {
  try {
    if (!url || !(await isSiteEnabledForUrl(url))) {
      await chrome.action.setBadgeText({ text: BADGE_CONFIG.disabled.text, tabId })
      return
    }

    await chrome.action.setBadgeText({ text: BADGE_CONFIG.enabled.text, tabId })
    await chrome.action.setBadgeBackgroundColor({
      color: BADGE_CONFIG.enabled.color,
      tabId,
    })
    await injectContentScript(tabId)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('No tab with id')) {
      console.error('Unexpected error updating badge:', error)
    }
  }
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  void chrome.tabs
    .get(activeInfo.tabId)
    .then((tab) => updateBadge(activeInfo.tabId, tab.url))
    .catch(() => undefined)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  void updateBadge(tabId, tab.url)
})

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'sync' || !changes.sites) return

  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(async (tabs) => {
      for (const tab of tabs) {
        if (typeof tab.id === 'number') await updateBadge(tab.id, tab.url)
      }
    })
    .catch((error: unknown) => {
      console.error('Error responding to storage changes:', error)
    })
})

chrome.permissions.onAdded.addListener((permissions) => {
  void finalizePendingSiteEnables(permissions.origins ?? [])
    .then(async (finalizedHostnames) => {
      if (finalizedHostnames.length === 0) return
      const finalized = new Set(finalizedHostnames)
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        const hostname = parseSupportedHostname(tab.url)
        if (hostname && finalized.has(hostname) && typeof tab.id === 'number') {
          await updateBadge(tab.id, tab.url)
        }
      }
    })
    .catch((error: unknown) => {
      console.error('Error finalizing granted site permissions:', error)
    })
})

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || !parseSupportedHostname(details.url)) return
  void isSiteEnabledForUrl(details.url)
    .then((enabled) => (enabled ? injectContentScript(details.tabId) : false))
    .catch((error: unknown) => {
      console.error('Error handling navigation:', error)
    })
})

chrome.runtime.onInstalled.addListener(() => {
  void migrateStorage()
    .then(async () => {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (typeof tab.id === 'number') await updateBadge(tab.id, tab.url)
      }
    })
    .catch((error: unknown) => {
      console.error('Error initializing extension:', error)
    })
})
