// Popup script for Allow Right Click extension

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('toggleExtension');
  const statusDiv = document.getElementById('status');
  
  // Load saved state
  chrome.storage.sync.get(['enabled'], function(result) {
    const enabled = result.enabled !== false; // Default to true
    toggle.checked = enabled;
    updateStatus(enabled);
  });
  
  // Listen for toggle changes
  toggle.addEventListener('change', function() {
    const enabled = toggle.checked;
    
    // Save state
    chrome.storage.sync.set({ enabled: enabled }, function() {
      updateStatus(enabled);
      
      // Notify all tabs to update
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleExtension',
            enabled: enabled
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        });
      });
    });
  });
  
  function updateStatus(enabled) {
    if (enabled) {
      statusDiv.className = 'status enabled';
      statusDiv.textContent = '✓ Extension is enabled';
    } else {
      statusDiv.className = 'status disabled';
      statusDiv.textContent = '✗ Extension is disabled';
    }
  }
});
