// Allow Copy - Content Script
// This script re-enables text selection, copying, and right-clicking on websites

(function() {
  'use strict';

  let isEnabled = true;
  let eventListeners = [];
  let styleElement = null;
  let observer = null;

  // Function to enable all document interactions
  function enableInteractions() {
    // First, remove any existing listeners to avoid duplicates
    disableInteractions();

    // Block mousedown on both left and right clicks to prevent interference
    const mousedownHandler = function(e) {
      if (e.button === 0) { // Left mouse button - allow selection
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Do NOT preventDefault() - we want normal left-click to work
      } else if (e.button === 2) { // Right mouse button
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault(); // Prevent navigation but still allow contextmenu
      }
    };
    document.addEventListener('mousedown', mousedownHandler, true);
    eventListeners.push({ type: 'mousedown', handler: mousedownHandler });

    // Block mouseup on both left and right clicks to prevent interference
    const mouseupHandler = function(e) {
      if (e.button === 0) { // Left mouse button - allow selection
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Do NOT preventDefault() - we want normal left-click to work
      } else if (e.button === 2) { // Right mouse button
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault(); // Prevent navigation but still allow contextmenu
      }
    };
    document.addEventListener('mouseup', mouseupHandler, true);
    eventListeners.push({ type: 'mouseup', handler: mouseupHandler });

    // Block click on both left and right clicks to prevent interference
    const clickHandler = function(e) {
      if (e.button === 0) { // Left mouse button - allow normal clicks
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Do NOT preventDefault() - we want normal clicks to work
      } else if (e.button === 2) { // Right mouse button
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    document.addEventListener('click', clickHandler, true);
    eventListeners.push({ type: 'click', handler: clickHandler });

    // Re-enable right-click context menu
    const contextmenuHandler = function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Do NOT call e.preventDefault() - we want the browser's context menu to show
    };
    document.addEventListener('contextmenu', contextmenuHandler, true);
    eventListeners.push({ type: 'contextmenu', handler: contextmenuHandler });

    // Re-enable text selection
    const selectstartHandler = function(e) {
      e.stopPropagation();
    };
    document.addEventListener('selectstart', selectstartHandler, true);
    eventListeners.push({ type: 'selectstart', handler: selectstartHandler });

    // Re-enable copy
    const copyHandler = function(e) {
      e.stopPropagation();
    };
    document.addEventListener('copy', copyHandler, true);
    eventListeners.push({ type: 'copy', handler: copyHandler });

    // Re-enable cut
    const cutHandler = function(e) {
      e.stopPropagation();
    };
    document.addEventListener('cut', cutHandler, true);
    eventListeners.push({ type: 'cut', handler: cutHandler });
  }

  // Function to disable all interactions
  function disableInteractions() {
    // Remove all event listeners
    eventListeners.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler, true);
    });
    eventListeners = [];
  }

  // Function to remove inline event handlers and styles that prevent selection
  function cleanupDocument() {
    if (!isEnabled) return;

    // Remove styles that prevent text selection
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        cursor: auto !important;
      }
    `;
    style.id = 'allow-copy-style';
    
    // Wait for head to exist
    const addStyle = () => {
      if (document.head) {
        // Remove existing style if present
        const existingStyle = document.getElementById('allow-copy-style');
        if (existingStyle) {
          existingStyle.remove();
        }
        if (isEnabled) {
          document.head.appendChild(style);
          styleElement = style;
        }
      } else {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(addStyle);
      }
    };
    addStyle();

    // Override common JavaScript properties used to disable right-click
    try {
      Object.defineProperty(document, 'oncontextmenu', {
        get: function() { return null; },
        set: function() { }
      });
      
      Object.defineProperty(document, 'onselectstart', {
        get: function() { return null; },
        set: function() { }
      });
      
      Object.defineProperty(document, 'oncopy', {
        get: function() { return null; },
        set: function() { }
      });
      
      Object.defineProperty(document, 'oncut', {
        get: function() { return null; },
        set: function() { }
      });
      
      Object.defineProperty(document, 'onpaste', {
        get: function() { return null; },
        set: function() { }
      });
    } catch (e) {
      // Some properties might not be configurable, that's okay
      console.log('Allow Copy: Some properties could not be overridden');
    }
  }

  // Function to remove cleanup
  function removeCleanup() {
    // Remove the style element
    const existingStyle = document.getElementById('allow-copy-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    styleElement = null;

    // Stop observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Function to start observer
  function startObserving() {
    if (!isEnabled) return;

    // Observer to handle dynamically added content
    observer = new MutationObserver(function(mutations) {
      // Check if style was removed
      if (isEnabled && !document.getElementById('allow-copy-style')) {
        cleanupDocument();
      }
    });

    // Start observing when head is available
    const startObserver = () => {
      if (document.head) {
        observer.observe(document.head, {
          childList: true,
          subtree: false
        });
      } else {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(startObserver);
      }
    };
    startObserver();
  }

  // Function to initialize extension
  function initialize(enabled) {
    isEnabled = enabled;

    if (isEnabled) {
      // First, ensure clean state by removing any previous setup
      removeCleanup();

      // Enable interactions immediately (this will also call disableInteractions first)
      enableInteractions();

      // Clean up document
      cleanupDocument();

      // Re-apply on DOM changes (some sites dynamically add restrictions)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanupDocument);
      }

      // Start observing
      startObserving();
    } else {
      disableInteractions();
      removeCleanup();
    }
  }

  // Load initial state from storage
  const hostname = window.location.hostname;
  chrome.storage.sync.get(['sites'], function(result) {
    const sites = result.sites || {};
    const enabled = sites[hostname] === true; // Default to false (disabled)
    initialize(enabled);
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleSite') {
      // Only respond if this is the correct hostname
      if (request.hostname === hostname) {
        initialize(request.enabled);
      }
    }
  });

})();
