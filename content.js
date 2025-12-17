// Allow Right Click - Content Script
// This script re-enables right-clicking, text selection, and copying on websites

(function() {
  'use strict';

  // Function to enable all document interactions
  function enableInteractions() {
    // Re-enable right-click context menu
    document.addEventListener('contextmenu', function(e) {
      e.stopPropagation();
      return true;
    }, true);

    // Re-enable text selection
    document.addEventListener('selectstart', function(e) {
      e.stopPropagation();
      return true;
    }, true);

    // Re-enable copy
    document.addEventListener('copy', function(e) {
      e.stopPropagation();
    }, true);

    // Re-enable cut
    document.addEventListener('cut', function(e) {
      e.stopPropagation();
    }, true);
  }

  // Function to remove inline event handlers and styles that prevent selection
  function cleanupDocument() {
    // Remove styles that prevent text selection
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    style.id = 'allow-right-click-style';
    
    // Wait for head to exist
    const addStyle = () => {
      if (document.head) {
        // Remove existing style if present
        const existingStyle = document.getElementById('allow-right-click-style');
        if (existingStyle) {
          existingStyle.remove();
        }
        document.head.appendChild(style);
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
      console.log('Allow Right Click: Some properties could not be overridden');
    }
  }

  // Enable interactions immediately
  enableInteractions();
  
  // Clean up document
  cleanupDocument();

  // Re-apply on DOM changes (some sites dynamically add restrictions)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupDocument);
  }

  // Observer to handle dynamically added content
  const observer = new MutationObserver(function(mutations) {
    // Check if style was removed
    if (!document.getElementById('allow-right-click-style')) {
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

})();
