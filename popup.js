// Popup script for Allow Copy extension

// Update status display
function updateStatus(enabled) {
  const statusDiv = document.getElementById('status');
  if (enabled) {
    statusDiv.className = 'status enabled';
    statusDiv.textContent = '✓ Enabled for this site';
  } else {
    statusDiv.className = 'status disabled';
    statusDiv.textContent = '✗ Disabled for this site';
  }
}

// Get current tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0];
}

// Inject content script if not already injected
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js'],
      injectImmediately: true
    });
  } catch (e) {
    // Expected errors: script already injected, tab doesn't support injection (e.g., chrome:// URLs)
    if (e.message && !e.message.includes('Cannot access') && !e.message.includes('duplicate')) {
      console.log('Content script injection skipped:', e.message);
    }
  }
}

// Get sites from storage
async function getSites() {
  const result = await chrome.storage.sync.get(['sites']);
  return result.sites || {};
}

// Save sites to storage
async function saveSites(sites) {
  await chrome.storage.sync.set({ sites });
}

// Toggle site state
async function toggleSite(tab, hostname, enabled) {
  const sites = await getSites();

  // Update this site's state
  if (enabled) {
    sites[hostname] = true;
  } else {
    delete sites[hostname]; // Remove from object to save space
  }

  // Save updated sites
  await saveSites(sites);
  updateStatus(enabled);

  // Notify the current tab to update
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'toggleSite',
      hostname,
      enabled
    });
  } catch (e) {
    // Tab doesn't have content script, that's okay
  }
}

// Initialize popup
async function init() {
  const toggle = document.getElementById('toggleExtension');
  const siteNameSpan = document.getElementById('siteName');

  const tab = await getCurrentTab();
  if (!tab) {
    updateStatus(false);
    return;
  }

  let hostname;
  try {
    if (!tab.url) {
      throw new Error('Missing tab URL');
    }
    const url = new URL(tab.url);
    hostname = url.hostname;
  } catch (e) {
    console.error('Unable to parse tab URL in popup:', e);
    updateStatus(false);
    siteNameSpan.textContent = 'Unknown site';
    toggle.disabled = true;
    return;
  }

  // Display current site
  siteNameSpan.textContent = hostname;

  // Inject content script if not already injected
  await injectContentScript(tab.id);

  // Load saved state for this site
  const sites = await getSites();
  const enabled = sites[hostname] === true; // Default to false (disabled)
  toggle.checked = enabled;
  updateStatus(enabled);

  // Listen for toggle changes
  toggle.addEventListener('change', () => {
    toggleSite(tab, hostname, toggle.checked);
  });
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
