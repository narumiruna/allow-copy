// Storage utilities for Allow Copy extension
// Handles storage schema migration and backward compatibility

;(function (root) {
  'use strict'

  // Default features configuration
  const DEFAULT_FEATURES = {
    textSelection: true,
    contextMenu: true,
    copyPaste: true,
    cursor: true,
  }

  /**
   * Normalize a site configuration to the new object format
   * @param {boolean|object} siteConfig - Old boolean or new object format
   * @returns {object} Normalized site configuration
   */
  function normalizeSiteConfig(siteConfig) {
    // If it's a boolean (old format), convert to object format
    if (typeof siteConfig === 'boolean') {
      return {
        enabled: siteConfig,
        features: { ...DEFAULT_FEATURES },
      }
    }

    // If it's already an object, ensure all required fields exist
    if (typeof siteConfig === 'object' && siteConfig !== null) {
      return {
        enabled: siteConfig.enabled !== false, // Default to true
        features: {
          ...DEFAULT_FEATURES,
          ...(siteConfig.features || {}),
        },
      }
    }

    // Invalid format, return disabled with default features
    return {
      enabled: false,
      features: { ...DEFAULT_FEATURES },
    }
  }

  /**
   * Get all sites from storage with migration
   * @returns {Promise<object>} Sites object with normalized format
   */
  async function getAllSites() {
    const result = await chrome.storage.sync.get(['sites'])
    const sites = result.sites || {}
    const normalized = {}

    // Normalize all site configurations
    for (const [hostname, config] of Object.entries(sites)) {
      normalized[hostname] = normalizeSiteConfig(config)
    }

    return normalized
  }

  /**
   * Get configuration for a specific site
   * @param {string} hostname - Site hostname
   * @returns {Promise<object>} Site configuration
   */
  async function getSiteConfig(hostname) {
    const sites = await getAllSites()
    return sites[hostname] || { enabled: false, features: { ...DEFAULT_FEATURES } }
  }

  /**
   * Check if a site is enabled
   * @param {string} hostname - Site hostname
   * @returns {Promise<boolean>} Whether the site is enabled
   */
  async function isSiteEnabled(hostname) {
    const config = await getSiteConfig(hostname)
    return config.enabled
  }

  /**
   * Get features for a specific site
   * @param {string} hostname - Site hostname
   * @returns {Promise<object>} Features configuration
   */
  async function getSiteFeatures(hostname) {
    const config = await getSiteConfig(hostname)
    return config.features
  }

  /**
   * Set configuration for a specific site
   * @param {string} hostname - Site hostname
   * @param {boolean} enabled - Whether the site is enabled
   * @param {object} features - Features configuration (optional)
   * @returns {Promise<void>}
   */
  async function setSiteConfig(hostname, enabled, features = null) {
    const sites = await getAllSites()

    if (!enabled) {
      // Keep per-site feature configuration even when disabled, so users can
      // pre-configure Advanced Options before enabling again.
      const existing = sites[hostname] || null
      sites[hostname] = {
        enabled: false,
        features: {
          ...DEFAULT_FEATURES,
          ...(features || existing?.features || {}),
        },
      }
    } else {
      // Use provided features or default to all enabled
      sites[hostname] = {
        enabled: true,
        features: features || { ...DEFAULT_FEATURES },
      }
    }

    await chrome.storage.sync.set({ sites })
  }

  /**
   * Update features for a specific site (keeps enabled state)
   * @param {string} hostname - Site hostname
   * @param {object} features - Features configuration
   * @returns {Promise<void>}
   */
  async function updateSiteFeatures(hostname, features) {
    const config = await getSiteConfig(hostname)

    // Update features regardless of enabled state, preserving current enabled flag.
    await setSiteConfig(hostname, config.enabled, features)
  }

  /**
   * Migrate storage from old format to new format
   * This function can be called on extension update
   * @returns {Promise<void>}
   */
  async function migrateStorage() {
    const result = await chrome.storage.sync.get(['sites'])
    const sites = result.sites || {}
    let migrated = false

    for (const [hostname, config] of Object.entries(sites)) {
      // If it's still in boolean format, migrate it
      if (typeof config === 'boolean') {
        sites[hostname] = normalizeSiteConfig(config)
        migrated = true
      }
    }

    // Save if we migrated anything
    if (migrated) {
      await chrome.storage.sync.set({ sites })
    }
  }

  // Export functions based on environment
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
      DEFAULT_FEATURES,
      normalizeSiteConfig,
      getAllSites,
      getSiteConfig,
      isSiteEnabled,
      getSiteFeatures,
      setSiteConfig,
      updateSiteFeatures,
      migrateStorage,
    }
  } else {
    // Browser environment - attach to window/global
    root.StorageUtils = {
      DEFAULT_FEATURES,
      normalizeSiteConfig,
      getAllSites,
      getSiteConfig,
      isSiteEnabled,
      getSiteFeatures,
      setSiteConfig,
      updateSiteFeatures,
      migrateStorage,
    }
  }
})(typeof self !== 'undefined' ? self : this)
