// Background service worker for Allow Copy extension
// Handles badge updates and content script injection

// Constants
const BADGE_CONFIG = {
  ENABLED: {
    text: '✓',
    color: '#4CAF50'
  },
  DISABLED: {
    text: ''
  }
};

// Utility: Check if URL is valid for extension and return parsed hostname
function parseAndValidateUrl(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Only allow http and https protocols
    if (!hostname || (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:')) {
      return null;
    }

    return hostname;
  } catch (e) {
    return null;
  }
}

// Utility: Get enabled sites from storage
async function getEnabledSites() {
  const result = await chrome.storage.sync.get(['sites']);
  return result.sites || {};
}

// Utility: Check if site is enabled
async function isSiteEnabled(hostname) {
  if (!hostname) return false;
  const sites = await getEnabledSites();
  return sites[hostname] === true;
}

// Inject content script into a tab
async function injectContentScript(tabId) {
  try {
    // Check if content script is already injected by trying to send a message
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response?.pong) {
        return true;
      }
    } catch (err) {
      // Expected errors: no listener (script not injected), tab closed, etc.
      // Continue to injection
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
      injectImmediately: true
    });

    return true;
  } catch (e) {
    // Log unexpected errors for debugging
    if (e.message && !e.message.includes('Cannot access') && !e.message.includes('No tab')) {
      console.error('Unexpected error injecting content script:', e);
    }
    return false;
  }
}

// Update badge for a specific tab
async function updateBadge(tabId, url) {
  const hostname = parseAndValidateUrl(url);
  
  if (!hostname) {
    await chrome.action.setBadgeText({ text: BADGE_CONFIG.DISABLED.text, tabId });
    return;
  }

  const enabled = await isSiteEnabled(hostname);

  if (enabled) {
    // Show green badge with checkmark
    await chrome.action.setBadgeText({ text: BADGE_CONFIG.ENABLED.text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_CONFIG.ENABLED.color, tabId });

    // Inject content script if site is enabled
    await injectContentScript(tabId);
  } else {
    // No badge for disabled sites
    await chrome.action.setBadgeText({ text: BADGE_CONFIG.DISABLED.text, tabId });
  }
}

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateBadge(activeInfo.tabId, tab.url);
  } catch (e) {
    // Tab might have been closed
  }
});

// Listen for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Only update when URL changes or page completes loading
    if (changeInfo.url || changeInfo.status === 'complete') {
      await updateBadge(tabId, tab.url);
    }
  } catch (e) {
    // Error during tab update handling - log for debugging
    console.error('Error in tabs.onUpdated:', e);
  }
});

// Listen for storage changes (when user toggles a site)
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  try {
    if (namespace === 'sync' && changes.sites) {
      // Update badges for all open tabs so that all windows stay in sync
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab && tab.id != null && tab.url) {
          await updateBadge(tab.id, tab.url);
        }
      }
    }
  } catch (e) {
    // Error during storage change handling - log for debugging
    console.error('Error in storage.onChanged:', e);
  }
});

// Note: chrome.action.onClicked does not fire when a popup is defined in the manifest.
// If you want to use this listener, you must remove the default_popup from manifest.json
// and handle the extension icon click manually. Keeping this commented out for reference:
//
// chrome.action.onClicked.addListener(function(tab) {
//   injectContentScript(tab.id);
// });

// Listen for navigation events to inject content script on enabled sites
chrome.webNavigation.onCommitted.addListener(async (details) => {
  try {
    // Only handle main frame navigations
    if (details.frameId !== 0) return;

    const hostname = parseAndValidateUrl(details.url);
    if (!hostname) return;

    const enabled = await isSiteEnabled(hostname);

    if (enabled) {
      await injectContentScript(details.tabId);
    }
  } catch (e) {
    // Error during navigation handling - log for debugging
    console.error('Error in webNavigation.onCommitted:', e);
  }
});

// On extension install/update/reload, inject into already-open tabs with enabled sites
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const sites = await getEnabledSites();
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      const hostname = parseAndValidateUrl(tab.url);
      if (!hostname) continue;

      // Inject if site is enabled
      if (sites[hostname] === true) {
        await injectContentScript(tab.id);
      }

      // Update badge
      await updateBadge(tab.id, tab.url);
    }
  } catch (e) {
    // Error during extension initialization - log for debugging
    console.error('Error in runtime.onInstalled:', e);
  }
});
