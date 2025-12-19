// Allow Copy - Content Script
// This script re-enables text selection, copying, and right-clicking on websites

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__allowCopyInjected) {
    return;
  }
  window.__allowCopyInjected = true;

  // Constants
  const MOUSE_BUTTON = {
    LEFT: 0,
    RIGHT: 2
  };

  const STYLE_ID = 'allow-copy-style';

  const DOCUMENT_PROPERTIES = [
    'oncontextmenu',
    'onselectstart',
    'oncopy',
    'oncut',
    'onpaste'
  ];

  // State
  let isEnabled = true;
  let eventListeners = [];
  let styleElement = null;
  let observer = null;

  // Create unified mouse event handler
  function createMouseEventHandler() {
    return function(e) {
      if (e.button === MOUSE_BUTTON.LEFT) {
        // Left mouse button - allow selection and normal clicks
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Do NOT preventDefault() - we want normal left-click to work
      } else if (e.button === MOUSE_BUTTON.RIGHT) {
        // Right mouse button - block navigation but allow contextmenu
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
  }

  // Create simple event handler that only stops propagation
  function createStopPropagationHandler() {
    return function(e) {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
  }

  // Function to enable all document interactions
  function enableInteractions() {
    // First, remove any existing listeners to avoid duplicates
    disableInteractions();

    // Mouse events (mousedown, mouseup, click)
    const mouseEvents = ['mousedown', 'mouseup', 'click'];
    const mouseHandler = createMouseEventHandler();
    mouseEvents.forEach(eventType => {
      document.addEventListener(eventType, mouseHandler, true);
      eventListeners.push({ type: eventType, handler: mouseHandler });
    });

    // Context menu event
    const contextmenuHandler = createStopPropagationHandler();
    document.addEventListener('contextmenu', contextmenuHandler, true);
    eventListeners.push({ type: 'contextmenu', handler: contextmenuHandler });

    // Text selection and clipboard events
    const textEvents = ['selectstart', 'copy', 'cut'];
    const textEventsHandler = (e) => e.stopPropagation();
    textEvents.forEach(eventType => {
      const handler = textEventsHandler;
      document.addEventListener(eventType, handler, true);
      eventListeners.push({ type: eventType, handler });
    });
  }

  // Function to disable all interactions
  function disableInteractions() {
    // Remove all event listeners
    eventListeners.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler, true);
    });
    eventListeners = [];
  }

  // Function to inject CSS that enables text selection
  function injectStyle() {
    if (!isEnabled) return;

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
    style.id = STYLE_ID;

    // Wait for head to exist
    const addStyle = () => {
      if (document.head) {
        // Remove existing style if present
        const existingStyle = document.getElementById(STYLE_ID);
        if (existingStyle) {
          existingStyle.remove();
        }
        if (isEnabled) {
          document.head.appendChild(style);
          styleElement = style;
        }
      } else {
        requestAnimationFrame(addStyle);
      }
    };
    addStyle();
  }

  // Function to override document properties
  function overrideDocumentProperties() {
    DOCUMENT_PROPERTIES.forEach(prop => {
      try {
        Object.defineProperty(document, prop, {
          get: () => null,
          set: () => {}
        });
      } catch (e) {
        // Some properties might not be configurable
      }
    });
  }

  // Function to remove inline event handlers and styles that prevent selection
  function cleanupDocument() {
    if (!isEnabled) return;

    injectStyle();
    overrideDocumentProperties();
  }

  // Function to remove cleanup
  function removeCleanup() {
    // Remove the style element
    const existingStyle = document.getElementById(STYLE_ID);
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
    observer = new MutationObserver(() => {
      // Check if style was removed
      if (!document.getElementById(STYLE_ID)) {
        injectStyle();
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
  chrome.storage.sync.get(['sites'], (result) => {
    const sites = result.sites || {};
    const enabled = sites[hostname] === true; // Default to false (disabled)
    initialize(enabled);
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      // Respond to ping to indicate content script is injected
      sendResponse({ pong: true });
      return true;
    }

    if (request.action === 'toggleSite' && request.hostname === hostname) {
      initialize(request.enabled);
      return true;
    }
  });

})();
