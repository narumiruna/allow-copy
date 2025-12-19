// Popup script for Allow Copy extension

// Update status display
function updateStatus(enabled) {
  const statusDiv = document.getElementById('status');
  if (!statusDiv) return;
  
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
    return { success: true };
  } catch (e) {
    // Expected errors: script already injected, tab doesn't support injection (e.g., chrome:// URLs)
    if (e.message && !e.message.includes('Cannot access') && !e.message.includes('duplicate')) {
      console.log('Content script injection skipped:', e.message);
      return { success: false, error: e.message };
    }
    return { success: true }; // Expected error, treat as success
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

// Queue-based toggle to prevent race conditions without busy-waiting
const toggleQueue = [];
let processingQueue = false;

async function processToggleQueue() {
  // Atomic check-and-set to prevent race conditions
  if (processingQueue) {
    return;
  }
  processingQueue = true;
  
  try {
    while (toggleQueue.length > 0) {
      const { tab, hostname, enabled, resolve, reject } = toggleQueue.shift();
      
      try {
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
        
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  } finally {
    processingQueue = false;
  }
}

async function toggleSite(tab, hostname, enabled) {
  return new Promise((resolve, reject) => {
    toggleQueue.push({ tab, hostname, enabled, resolve, reject });
    // Start processing queue (non-blocking)
    // Individual operations resolve/reject their own promises
    // This catch only handles unexpected queue processing errors
    processToggleQueue().catch(err => {
      console.error('Queue processing error:', err);
    });
  });
}

// Initialize popup
async function init() {
  const toggle = document.getElementById('toggleExtension');
  const siteNameSpan = document.getElementById('siteName');

  // Validate DOM elements exist
  if (!toggle || !siteNameSpan) {
    console.error('Required DOM elements not found');
    return;
  }

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
  const injectionResult = await injectContentScript(tab.id);
  if (injectionResult && !injectionResult.success && injectionResult.error) {
    // Show error message for unexpected injection failures
    updateStatus(false);
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.className = 'status disabled';
      statusDiv.textContent = '⚠ Could not enable on this page';
    }
    toggle.disabled = true;
    return;
  }

  // Load saved state for this site
  const sites = await getSites();
  const enabled = sites[hostname] === true; // Default to false (disabled)
  toggle.checked = enabled;
  updateStatus(enabled);

  // Listen for toggle changes
  toggle.addEventListener('change', async () => {
    const newState = toggle.checked;
    try {
      await toggleSite(tab, hostname, newState);
    } catch (e) {
      console.error('Failed to toggle site state:', e);
      // Revert UI state since the change was not successfully applied
      toggle.checked = !newState;
      updateStatus(toggle.checked);
    }
  });
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
