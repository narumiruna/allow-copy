// Popup script for Allow Copy extension

// State variable to track current features
let currentFeatures = null
let lastDetectionResults = null

// UI state storage key
const UI_STATE_KEY = 'uiState'

// Update status display
function updateStatus(enabled) {
  const statusDiv = document.getElementById('status')
  if (!statusDiv) return

  if (enabled) {
    statusDiv.className = 'status enabled'
    statusDiv.textContent = '✓ Enabled for this site'
  } else {
    statusDiv.className = 'status disabled'
    statusDiv.textContent = '✗ Disabled for this site'
  }
}

// Update detection info display
function updateDetectionInfo(detectionResults, isEnabled, features) {
  const detectedSection = document.getElementById('detectedRestrictions')
  const enabledSection = document.getElementById('enabledFeatures')

  if (!detectionResults) {
    if (detectedSection) detectedSection.style.display = 'none'
    if (enabledSection) enabledSection.style.display = 'none'
    return
  }

  const { cssRestrictions, jsRestrictions } = detectionResults
  const effectiveFeatures = features || currentFeatures
  const hasRestrictions =
    cssRestrictions.userSelect ||
    cssRestrictions.pointerEvents ||
    cssRestrictions.cursor ||
    jsRestrictions.contextmenu ||
    jsRestrictions.selectstart ||
    jsRestrictions.copy

  // Always show detected restrictions (even if none) for transparency
  if (detectedSection) {
    const list = detectedSection.querySelector('.restriction-list')
    if (list) {
      list.innerHTML = ''

      detectedSection.style.display = 'block'

      if (!hasRestrictions) {
        const item = document.createElement('li')
        item.textContent = 'No restrictions detected'
        list.appendChild(item)
      } else {
        if (cssRestrictions.userSelect) {
          const item = document.createElement('li')
          item.textContent = 'Text selection disabled (CSS)'
          list.appendChild(item)
        }

        if (jsRestrictions.contextmenu) {
          const item = document.createElement('li')
          item.textContent = 'Right-click menu blocked (JavaScript)'
          list.appendChild(item)
        }

        if (jsRestrictions.copy || jsRestrictions.selectstart) {
          const item = document.createElement('li')
          item.textContent = 'Copy/cut operations blocked'
          list.appendChild(item)
        }

        if (cssRestrictions.cursor) {
          const item = document.createElement('li')
          item.textContent = 'Mouse cursor restrictions'
          list.appendChild(item)
        }

        if (cssRestrictions.pointerEvents) {
          const item = document.createElement('li')
          item.textContent = 'Mouse interaction disabled (CSS)'
          list.appendChild(item)
        }
      }
    }
  }

  // Always show configured features (even when disabled), based on actual toggle state
  if (enabledSection) {
    if (!effectiveFeatures) {
      enabledSection.style.display = 'none'
    } else {
      enabledSection.style.display = 'block'
      const list = enabledSection.querySelector('.feature-list')
      if (list) {
        list.innerHTML = ''

        if (!isEnabled) {
          const item = document.createElement('li')
          item.textContent = 'Extension is disabled for this site'
          list.appendChild(item)
        }

        if (effectiveFeatures.textSelection) {
          const item = document.createElement('li')
          item.textContent = 'Text selection restored'
          list.appendChild(item)
        }

        if (effectiveFeatures.contextMenu) {
          const item = document.createElement('li')
          item.textContent = 'Right-click menu restored'
          list.appendChild(item)
        }

        if (effectiveFeatures.copyPaste) {
          const item = document.createElement('li')
          item.textContent = 'Copy/cut operations enabled'
          list.appendChild(item)
        }

        if (effectiveFeatures.cursor) {
          const item = document.createElement('li')
          item.textContent = 'Cursor behavior normalized'
          list.appendChild(item)
        }

        if (
          !effectiveFeatures.textSelection &&
          !effectiveFeatures.contextMenu &&
          !effectiveFeatures.copyPaste &&
          !effectiveFeatures.cursor
        ) {
          const item = document.createElement('li')
          item.textContent = 'No features enabled'
          list.appendChild(item)
        }
      }
    }
  }
}

// Get detection info from content script
async function getDetectionInfo(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'getDetectionInfo',
    })
    return response
  } catch (_e) {
    // Content script not injected or tab doesn't support it
    return null
  }
}

// Update Advanced Options visibility and populate checkboxes
function updateAdvancedOptions(enabled, features) {
  const advancedSection = document.getElementById('advancedOptions')
  if (!advancedSection) return

  // Always show Advanced Options so users can configure before enabling
  advancedSection.style.display = 'block'

  const advancedNote = document.getElementById('advancedNote')
  if (advancedNote) {
    advancedNote.style.display = enabled ? 'none' : 'block'
  }

  // Populate feature checkboxes
  const featureTextSelection = document.getElementById('featureTextSelection')
  const featureContextMenu = document.getElementById('featureContextMenu')
  const featureCopyPaste = document.getElementById('featureCopyPaste')
  const featureCursor = document.getElementById('featureCursor')

  if (featureTextSelection) featureTextSelection.checked = features.textSelection
  if (featureContextMenu) featureContextMenu.checked = features.contextMenu
  if (featureCopyPaste) featureCopyPaste.checked = features.copyPaste
  if (featureCursor) featureCursor.checked = features.cursor

  // Store current features
  currentFeatures = { ...features }
}

// Setup Advanced Options expand/collapse toggle
async function setupAdvancedOptionsToggle() {
  const advancedToggle = document.getElementById('advancedToggle')
  const advancedContent = document.getElementById('advancedContent')
  const advancedArrow = advancedToggle?.querySelector('.advanced-arrow')

  if (!advancedToggle || !advancedContent) return

  // Restore persisted UI state
  try {
    const result = await chrome.storage.sync.get([UI_STATE_KEY])
    const expanded = result?.[UI_STATE_KEY]?.advancedExpanded === true
    advancedContent.style.display = expanded ? 'block' : 'none'
    if (expanded) {
      advancedArrow?.classList.add('expanded')
    } else {
      advancedArrow?.classList.remove('expanded')
    }
  } catch (_e) {
    // If storage fails, default to collapsed
    advancedContent.style.display = 'none'
    advancedArrow?.classList.remove('expanded')
  }

  advancedToggle.addEventListener('click', () => {
    const isExpanded = advancedContent.style.display === 'block'

    if (isExpanded) {
      advancedContent.style.display = 'none'
      advancedArrow?.classList.remove('expanded')
    } else {
      advancedContent.style.display = 'block'
      advancedArrow?.classList.add('expanded')
    }

    // Persist UI state (best-effort)
    chrome.storage.sync.set({ [UI_STATE_KEY]: { advancedExpanded: !isExpanded } }).catch(() => {})
  })
}

// Update features in storage and notify content script
async function updateFeatures(tab, hostname, features, isEnabledForSite) {
  try {
    // Save to storage first
    await StorageUtils.updateSiteFeatures(hostname, features)
    currentFeatures = { ...features }

    if (isEnabledForSite) {
      // Notify content script to apply changes immediately
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateFeatures',
          hostname,
          features,
        })

        // Give content script time to apply changes (50ms should be enough)
        await new Promise((resolve) => setTimeout(resolve, 50))
      } catch (_msgError) {
        // If message fails, try reloading the tab to apply changes
        console.log('Content script not responding, reloading tab')
        await chrome.tabs.reload(tab.id)
      }

      // Refresh detection/features UI after applying changes
      const updatedDetectionInfo = await getDetectionInfo(tab.id)
      if (updatedDetectionInfo) {
        lastDetectionResults = updatedDetectionInfo.detectionResults
        updateDetectionInfo(lastDetectionResults, true, currentFeatures)
      }
    } else if (lastDetectionResults) {
      // Site is disabled; just update UI to reflect configured features
      updateDetectionInfo(lastDetectionResults, false, currentFeatures)
    }
  } catch (e) {
    console.error('Failed to update features:', e)
  }
}

// Get current tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs?.[0]
}

// Inject content script if not already injected
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      // content.js depends on StorageUtils being available in the page context
      files: ['storage-utils.js', 'content.js'],
      injectImmediately: true,
    })
    return { success: true }
  } catch (e) {
    // Expected errors: script already injected, tab doesn't support injection (e.g., chrome:// URLs)
    if (e.message && !e.message.includes('Cannot access') && !e.message.includes('duplicate')) {
      console.log('Content script injection skipped:', e.message)
      return { success: false, error: e.message }
    }
    return { success: true } // Expected error, treat as success
  }
}

// Get site configuration from storage
async function getSiteConfig(hostname) {
  return await StorageUtils.getSiteConfig(hostname)
}

// Update site configuration in storage
async function setSiteConfig(hostname, enabled, features = null) {
  await StorageUtils.setSiteConfig(hostname, enabled, features)
}

// Queue-based toggle to prevent race conditions without busy-waiting
const toggleQueue = []
let processingQueue = false

async function processToggleQueue() {
  // Atomic check-and-set to prevent race conditions
  if (processingQueue) {
    return
  }
  processingQueue = true

  try {
    while (toggleQueue.length > 0) {
      const { tab, hostname, enabled, features, resolve, reject } = toggleQueue.shift()

      try {
        // Save site configuration with features
        await setSiteConfig(hostname, enabled, features)
        updateStatus(enabled)

        // Notify the current tab to update
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'toggleSite',
            hostname,
            enabled,
            features,
          })
        } catch (_e) {
          // Tab doesn't have content script, that's okay
        }

        resolve()
      } catch (error) {
        reject(error)
      }
    }
  } finally {
    processingQueue = false
  }
}

async function toggleSite(tab, hostname, enabled, features = null) {
  return new Promise((resolve, reject) => {
    toggleQueue.push({ tab, hostname, enabled, features, resolve, reject })
    // Start processing queue (non-blocking)
    // Individual operations resolve/reject their own promises
    // This catch only handles unexpected queue processing errors
    processToggleQueue().catch((err) => {
      console.error('Queue processing error:', err)
    })
  })
}

// Initialize popup
async function init() {
  const toggle = document.getElementById('toggleExtension')
  const siteNameSpan = document.getElementById('siteName')

  // Validate DOM elements exist
  if (!toggle || !siteNameSpan) {
    console.error('Required DOM elements not found')
    return
  }

  const tab = await getCurrentTab()
  if (!tab) {
    updateStatus(false)
    return
  }

  let hostname
  try {
    if (!tab.url) {
      throw new Error('Missing tab URL')
    }
    const url = new URL(tab.url)
    hostname = url.hostname
  } catch (e) {
    console.error('Unable to parse tab URL in popup:', e)
    updateStatus(false)
    siteNameSpan.textContent = 'Unknown site'
    toggle.disabled = true
    return
  }

  // Display current site
  siteNameSpan.textContent = hostname

  // Inject content script if not already injected
  const injectionResult = await injectContentScript(tab.id)
  if (injectionResult && !injectionResult.success && injectionResult.error) {
    // Show error message for unexpected injection failures
    updateStatus(false)
    const statusDiv = document.getElementById('status')
    if (statusDiv) {
      statusDiv.className = 'status disabled'
      statusDiv.textContent = '⚠ Could not enable on this page'
    }
    toggle.disabled = true
    return
  }

  // Load saved configuration for this site
  const config = await getSiteConfig(hostname)
  const enabled = config.enabled
  const features = config.features
  currentFeatures = { ...features }
  toggle.checked = enabled
  updateStatus(enabled)

  // Setup Advanced Options
  await setupAdvancedOptionsToggle()
  updateAdvancedOptions(enabled, features)

  // Get detection info from content script
  const detectionInfo = await getDetectionInfo(tab.id)
  if (detectionInfo) {
    lastDetectionResults = detectionInfo.detectionResults
    updateDetectionInfo(lastDetectionResults, enabled, currentFeatures)
  }

  // Listen for toggle changes
  toggle.addEventListener('change', async () => {
    const newState = toggle.checked
    try {
      // Update UI immediately during the toggle transition
      if (lastDetectionResults) {
        updateDetectionInfo(lastDetectionResults, newState, currentFeatures || features)
      }

      // Pass current features when toggling
      await toggleSite(tab, hostname, newState, newState ? currentFeatures : null)

      // Update Advanced Options visibility
      updateAdvancedOptions(newState, currentFeatures || features)

      // Update detection info display after toggle
      // Use newState instead of waiting for content script to update
      const updatedDetectionInfo = await getDetectionInfo(tab.id)
      if (updatedDetectionInfo) {
        lastDetectionResults = updatedDetectionInfo.detectionResults
        // Use newState (what user wants) instead of isEnabled from content script
        // to avoid race condition where content script hasn't updated yet
        updateDetectionInfo(lastDetectionResults, newState, currentFeatures || features)
      }
    } catch (e) {
      console.error('Failed to toggle site state:', e)
      // Revert UI state since the change was not successfully applied
      toggle.checked = !newState
      updateStatus(toggle.checked)
    }
  })

  // Setup feature checkbox listeners
  const featureCheckboxes = [
    { id: 'featureTextSelection', key: 'textSelection' },
    { id: 'featureContextMenu', key: 'contextMenu' },
    { id: 'featureCopyPaste', key: 'copyPaste' },
    { id: 'featureCursor', key: 'cursor' },
  ]

  featureCheckboxes.forEach(({ id, key }) => {
    const checkbox = document.getElementById(id)
    if (checkbox) {
      checkbox.addEventListener('change', async () => {
        if (currentFeatures) {
          currentFeatures[key] = checkbox.checked
          await updateFeatures(tab, hostname, currentFeatures, toggle.checked)
        }
      })
    }
  })
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', init)
