// Background service worker for Allow Copy extension
// Handles badge updates and content script injection

// Inject content script into a tab
async function injectContentScript(tabId) {
  try {
    // Check if content script is already injected by trying to send a message
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.pong) {
        // Content script already injected
        return true;
      }
    } catch (err) {
      // Expected errors: no listener (script not injected), tab closed, etc.
      // Continue to injection
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
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
function updateBadge(tabId, url) {
  if (!url) return;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Skip chrome:// and other special URLs
    if (!hostname || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
      return;
    }

    // Check if this site is enabled
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      const enabled = sites[hostname] === true;

      if (enabled) {
        // Show green badge with checkmark
        chrome.action.setBadgeText({ text: '✓', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tabId });
        
        // Inject content script if site is enabled
        injectContentScript(tabId);
      } else {
        // No badge for disabled sites
        chrome.action.setBadgeText({ text: '', tabId: tabId });
      }
    });
  } catch (e) {
    // Invalid URL, clear badge
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError) {
      return;
    }
    updateBadge(activeInfo.tabId, tab.url);
  });
});

// Listen for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only update when URL changes or page completes loading
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateBadge(tabId, tab.url);
  }
});

// Listen for storage changes (when user toggles a site)
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.sites) {
    // Update badge for current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        updateBadge(tabs[0].id, tabs[0].url);
      }
    });
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
chrome.webNavigation.onCommitted.addListener(function(details) {
  // Only handle main frame navigations
  if (details.frameId !== 0) return;
  
  try {
    const urlObj = new URL(details.url);
    const hostname = urlObj.hostname;
    
    // Skip special URLs
    if (!hostname || details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://')) {
      return;
    }
    
    // Check if site is enabled and inject if needed
    chrome.storage.sync.get(['sites'], async function(result) {
      const sites = result.sites || {};
      if (sites[hostname] === true) {
        await injectContentScript(details.tabId);
      }
    });
  } catch (e) {
    // Invalid URL, ignore
  }
});

// On extension install/update/reload, inject into already-open tabs with enabled sites
chrome.runtime.onInstalled.addListener(async function() {
  // Get all enabled sites
  chrome.storage.sync.get(['sites'], async function(result) {
    const sites = result.sites || {};
    
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (!tab.url) continue;
      
      try {
        const urlObj = new URL(tab.url);
        const hostname = urlObj.hostname;
        
        // Skip special URLs
        if (!hostname || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          continue;
        }
        
        // Inject if site is enabled
        if (sites[hostname] === true) {
          await injectContentScript(tab.id);
        }
        
        // Update badge
        updateBadge(tab.id, tab.url);
      } catch (e) {
        // Invalid URL, skip
      }
    }
  });
});
