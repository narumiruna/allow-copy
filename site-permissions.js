// Per-site host permission helpers for persistent site access.

;(function (root) {
  'use strict'

  function getPermissionOriginsForHostname(hostname) {
    if (!hostname) {
      return []
    }

    return [`http://${hostname}/*`, `https://${hostname}/*`]
  }

  async function ensurePersistentSiteAccess(hostname, permissionsApi = chrome.permissions) {
    const origins = getPermissionOriginsForHostname(hostname)
    if (origins.length === 0) {
      return false
    }

    if (!permissionsApi || typeof permissionsApi.contains !== 'function') {
      return false
    }

    const alreadyGranted = await permissionsApi.contains({ origins })
    if (alreadyGranted) {
      return true
    }

    if (typeof permissionsApi.request !== 'function') {
      return false
    }

    return await permissionsApi.request({ origins })
  }

  const SitePermissions = {
    getPermissionOriginsForHostname,
    ensurePersistentSiteAccess,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SitePermissions
  } else {
    root.SitePermissions = SitePermissions
  }
})(typeof self !== 'undefined' ? self : this)
