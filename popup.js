// Popup script for Allow Copy extension

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('toggleExtension');
  const statusDiv = document.getElementById('status');
  const siteNameSpan = document.getElementById('siteName');

  // Get current tab
  chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
    if (!tabs || tabs.length === 0) {
      updateStatus(false, 'Unknown site');
      return;
    }

    const tab = tabs[0];
    const url = new URL(tab.url);
    const hostname = url.hostname;

    // Display current site
    siteNameSpan.textContent = hostname;

    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js'],
        injectImmediately: true
      });
    } catch (e) {
      // Content script might already be injected or tab doesn't support injection
      console.log('Content script injection skipped:', e.message);
    }

    // Load saved state for this site
    chrome.storage.sync.get(['sites'], function(result) {
      const sites = result.sites || {};
      const enabled = sites[hostname] === true; // Default to false (disabled)
      toggle.checked = enabled;
      updateStatus(enabled, hostname);
    });

    // Listen for toggle changes
    toggle.addEventListener('change', function() {
      const enabled = toggle.checked;

      // Load current sites object
      chrome.storage.sync.get(['sites'], function(result) {
        const sites = result.sites || {};

        // Update this site's state
        if (enabled) {
          sites[hostname] = true;
        } else {
          delete sites[hostname]; // Remove from object to save space
        }

        // Save updated sites
        chrome.storage.sync.set({ sites: sites }, function() {
          updateStatus(enabled, hostname);

          // Notify the current tab to update
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleSite',
            hostname: hostname,
            enabled: enabled
          }, function(response) {
            // Ignore errors for tabs that don't have content script
            if (chrome.runtime.lastError) {
              // Tab doesn't have content script, that's okay
            }
          });
        });
      });
    });
  });

  function updateStatus(enabled, hostname) {
    if (enabled) {
      statusDiv.className = 'status enabled';
      statusDiv.textContent = '✓ Enabled for this site';
    } else {
      statusDiv.className = 'status disabled';
      statusDiv.textContent = '✗ Disabled for this site';
    }
  }
});
