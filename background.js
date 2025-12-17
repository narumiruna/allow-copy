// Background service worker for Allow Copy extension
// Handles badge updates when switching tabs

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
