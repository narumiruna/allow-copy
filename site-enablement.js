// Coordinates pending site enablement across popup and background contexts.

;(function (root) {
  'use strict'

  const PENDING_SITE_ENABLE_KEY = 'pendingSiteEnable'

  function getHostnamesFromOrigins(origins) {
    const hostnames = new Set()

    for (const origin of origins || []) {
      try {
        const normalizedOrigin = origin.endsWith('/*') ? origin.slice(0, -1) : origin
        const parsed = new URL(normalizedOrigin)
        if (parsed.hostname) {
          hostnames.add(parsed.hostname)
        }
      } catch (_e) {
        // Ignore malformed origins.
      }
    }

    return Array.from(hostnames)
  }

  async function getPendingSiteEnablements(storageArea = chrome.storage.session) {
    const result = await storageArea.get([PENDING_SITE_ENABLE_KEY])
    return result?.[PENDING_SITE_ENABLE_KEY] || {}
  }

  async function setPendingSiteEnable(
    hostname,
    features,
    storageArea = chrome.storage.session,
  ) {
    const pending = await getPendingSiteEnablements(storageArea)
    pending[hostname] = {
      hostname,
      features: { ...features },
    }
    await storageArea.set({ [PENDING_SITE_ENABLE_KEY]: pending })
  }

  async function getPendingSiteEnable(hostname, storageArea = chrome.storage.session) {
    const pending = await getPendingSiteEnablements(storageArea)
    return pending[hostname] || null
  }

  async function clearPendingSiteEnable(hostname, storageArea = chrome.storage.session) {
    const pending = await getPendingSiteEnablements(storageArea)
    if (!pending[hostname]) {
      return
    }

    delete pending[hostname]
    await storageArea.set({ [PENDING_SITE_ENABLE_KEY]: pending })
  }

  async function finalizePendingSiteEnables(origins, deps) {
    const finalizedHostnames = []

    for (const hostname of getHostnamesFromOrigins(origins)) {
      const pending = await deps.getPending(hostname)
      if (!pending) {
        continue
      }

      await deps.setSiteConfig(hostname, true, pending.features)
      await deps.clearPending(hostname)
      finalizedHostnames.push(hostname)
    }

    return finalizedHostnames
  }

  const SiteEnablement = {
    PENDING_SITE_ENABLE_KEY,
    getHostnamesFromOrigins,
    getPendingSiteEnablements,
    setPendingSiteEnable,
    getPendingSiteEnable,
    clearPendingSiteEnable,
    finalizePendingSiteEnables,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteEnablement
  } else {
    root.SiteEnablement = SiteEnablement
  }
})(typeof self !== 'undefined' ? self : this)
