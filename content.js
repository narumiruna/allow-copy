// Allow Copy - Content Script
// This script re-enables text selection, copying, and right-clicking on websites

;(function () {
  'use strict'

  // Prevent multiple injections
  if (window.__allowCopyInjected) {
    return
  }
  window.__allowCopyInjected = true

  // Constants
  const MOUSE_BUTTON = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
  }

  const STYLE_ID = 'allow-copy-style'

  const DOCUMENT_PROPERTIES = ['oncontextmenu', 'onselectstart', 'oncopy', 'oncut', 'onpaste']

  const RAF_MAX_ATTEMPTS = 50 // Max 50 frames. At 60fps: ~833ms, at 30fps: ~1667ms

  // State
  let isEnabled = true
  let features = {
    textSelection: true,
    contextMenu: true,
    copyPaste: true,
    cursor: true,
  }
  let eventListeners = []
  let observer = null
  let observerThrottleTimer = null
  let detectionResults = null // Will be set on first detection
  let hasDetectedOnce = false // Track if we've done initial detection

  // Create unified mouse event handler
  function createMouseEventHandler() {
    return function (e) {
      if (e.button === MOUSE_BUTTON.LEFT) {
        // Left mouse button - allow selection and normal clicks
        e.stopPropagation()
        e.stopImmediatePropagation()
        // Do NOT preventDefault() - we want normal left-click to work
      } else if (e.button === MOUSE_BUTTON.RIGHT) {
        // Right mouse button - block navigation but allow contextmenu
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.preventDefault()
      }
    }
  }

  // Create simple event handler that only stops propagation
  function createStopPropagationHandler() {
    return function (e) {
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }

  // Function to detect CSS-based restrictions on an element
  function detectCSSRestrictions(element) {
    const computed = window.getComputedStyle(element)
    const results = {
      userSelect: false,
      pointerEvents: false,
      cursor: false,
    }

    // Check user-select
    const userSelect = computed.userSelect || computed.webkitUserSelect || computed.mozUserSelect
    if (userSelect === 'none') {
      results.userSelect = true
    }

    // Check pointer-events
    if (computed.pointerEvents === 'none') {
      results.pointerEvents = true
    }

    // Check cursor (detect if cursor is not default/auto/text)
    const cursor = computed.cursor
    const normalCursors = [
      'auto',
      'default',
      'text',
      'pointer',
      'help',
      'wait',
      'move',
      'crosshair',
    ]
    if (cursor && !normalCursors.includes(cursor)) {
      results.cursor = true
    }

    return results
  }

  // Function to detect restrictions across the page
  function detectRestrictions() {
    // If we've already detected once, return the cached results
    // This is important because our CSS modifications will interfere with detection
    if (hasDetectedOnce && detectionResults) {
      return detectionResults
    }

    const results = {
      cssRestrictions: {
        userSelect: false,
        pointerEvents: false,
        cursor: false,
      },
      jsRestrictions: {
        contextmenu: false,
        selectstart: false,
        copy: false,
      },
    }

    // Check body and common content elements for CSS restrictions
    const elementsToCheck = [document.body, document.documentElement]
    const contentElements = document.querySelectorAll('p, div, span, article, section, main')
    const sampleElements = Array.from(contentElements).slice(0, 10) // Sample first 10 content elements

    elementsToCheck.push(...sampleElements)

    elementsToCheck.forEach((element) => {
      if (!element) return
      const cssResults = detectCSSRestrictions(element)
      if (cssResults.userSelect) results.cssRestrictions.userSelect = true
      if (cssResults.pointerEvents) results.cssRestrictions.pointerEvents = true
      if (cssResults.cursor) results.cssRestrictions.cursor = true
    })

    // Check for JavaScript restrictions by examining document properties
    DOCUMENT_PROPERTIES.forEach((prop) => {
      const value = document[prop]
      if (value !== null && value !== undefined) {
        // Property has been set by the website
        if (prop === 'oncontextmenu') results.jsRestrictions.contextmenu = true
        if (prop === 'onselectstart') results.jsRestrictions.selectstart = true
        if (prop === 'oncopy') results.jsRestrictions.copy = true
      }
    })

    // Cache the results
    detectionResults = results
    hasDetectedOnce = true

    return results
  }

  // Function to enable document interactions based on enabled features
  function enableInteractions() {
    // First, remove any existing listeners to avoid duplicates
    disableInteractions()

    // Mouse events for text selection (textSelection feature)
    if (features.textSelection) {
      const mouseEvents = ['mousedown', 'mouseup', 'click']
      const mouseHandler = createMouseEventHandler()
      mouseEvents.forEach((eventType) => {
        document.addEventListener(eventType, mouseHandler, true)
        eventListeners.push({ type: eventType, handler: mouseHandler })
      })
    }

    // Context menu event (contextMenu feature)
    if (features.contextMenu) {
      const contextmenuHandler = createStopPropagationHandler()
      document.addEventListener('contextmenu', contextmenuHandler, true)
      eventListeners.push({ type: 'contextmenu', handler: contextmenuHandler })
    }

    // Text selection event (textSelection feature)
    if (features.textSelection) {
      const selectstartHandler = (e) => e.stopPropagation()
      document.addEventListener('selectstart', selectstartHandler, true)
      eventListeners.push({ type: 'selectstart', handler: selectstartHandler })
    }

    // Copy/cut events (copyPaste feature)
    if (features.copyPaste) {
      const copyEvents = ['copy', 'cut']
      const copyPasteHandler = (e) => e.stopPropagation()
      copyEvents.forEach((eventType) => {
        document.addEventListener(eventType, copyPasteHandler, true)
        eventListeners.push({ type: eventType, handler: copyPasteHandler })
      })
    }
  }

  // Function to disable all interactions
  function disableInteractions() {
    // Remove all event listeners
    eventListeners.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler, true)
    })
    eventListeners = []
  }

  // Function to inject CSS that enables text selection and cursor restoration
  function injectStyle() {
    if (!isEnabled) return

    // Build CSS based on enabled features
    const cssRules = []

    // Text selection CSS (textSelection feature)
    if (features.textSelection) {
      cssRules.push(`
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      `)
    }

    // Cursor restoration CSS (cursor feature)
    if (features.cursor) {
      cssRules.push(`
        cursor: auto !important;
      `)
    }

    // Wait for head to exist with timeout fallback
    let attempts = 0

    const addStyle = () => {
      if (document.head) {
        // Always remove existing style first
        const existingStyle = document.getElementById(STYLE_ID)
        if (existingStyle) {
          existingStyle.remove()
        }

        // Only inject new style if there are rules to apply
        if (cssRules.length > 0 && isEnabled) {
          const style = document.createElement('style')
          style.textContent = `
            * {
              ${cssRules.join('\n')}
            }
          `
          style.id = STYLE_ID
          document.head.appendChild(style)

          // Force browser reflow to ensure styles are applied immediately
          void document.body.offsetHeight
        }
      } else {
        attempts++
        if (attempts < RAF_MAX_ATTEMPTS) {
          requestAnimationFrame(addStyle)
        } else {
          // Fallback: document.head not available after timeout, give up
          console.log('Allow Copy: document.head not available, skipping style injection')
        }
      }
    }
    addStyle()
  }

  // Function to override document properties based on enabled features
  function overrideDocumentProperties() {
    DOCUMENT_PROPERTIES.forEach((prop) => {
      // Check if the feature for this property is enabled
      let shouldOverride = false

      if (prop === 'oncontextmenu' && features.contextMenu) {
        shouldOverride = true
      } else if (prop === 'onselectstart' && features.textSelection) {
        shouldOverride = true
      } else if (
        (prop === 'oncopy' || prop === 'oncut' || prop === 'onpaste') &&
        features.copyPaste
      ) {
        shouldOverride = true
      }

      if (shouldOverride) {
        try {
          Object.defineProperty(document, prop, {
            get: () => null,
            set: () => {},
          })
        } catch (_e) {
          // Some properties might not be configurable
        }
      }
    })
  }

  // Function to remove inline event handlers and styles that prevent selection
  function cleanupDocument() {
    if (!isEnabled) return

    injectStyle()
    overrideDocumentProperties()
  }

  // Function to remove cleanup
  function removeCleanup() {
    // Clear any pending throttle timer
    if (observerThrottleTimer) {
      clearTimeout(observerThrottleTimer)
      observerThrottleTimer = null
    }

    // Remove the style element
    const existingStyle = document.getElementById(STYLE_ID)
    if (existingStyle) {
      existingStyle.remove()
    }

    // Stop observer
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  // Function to start observer
  function startObserving() {
    if (!isEnabled) return

    // Observer to handle dynamically added content
    // Throttle callback to prevent excessive CPU usage on rapidly changing pages
    observer = new MutationObserver(() => {
      // Cancel any pending throttle timer
      if (observerThrottleTimer) {
        clearTimeout(observerThrottleTimer)
      }

      // Throttle to max once per 100ms to reduce CPU usage
      observerThrottleTimer = setTimeout(() => {
        observerThrottleTimer = null
        // Check if style was removed and re-inject if needed
        if (isEnabled && !document.getElementById(STYLE_ID)) {
          injectStyle()
        }
      }, 100)
    })

    // Start observing when head is available with timeout fallback
    let attempts = 0

    const startObserver = () => {
      if (document.head) {
        observer.observe(document.head, {
          childList: true,
          subtree: false,
        })
      } else {
        attempts++
        if (attempts < RAF_MAX_ATTEMPTS) {
          requestAnimationFrame(startObserver)
        } else {
          // Fallback: document.head not available after timeout, give up
          console.log('Allow Copy: document.head not available, skipping observer setup')
        }
      }
    }
    startObserver()
  }

  // Function to initialize extension with feature settings
  function initialize(enabled, featureSettings = null) {
    isEnabled = enabled

    // Update features if provided
    if (featureSettings) {
      features = { ...StorageUtils.DEFAULT_FEATURES, ...featureSettings }

      // Clear text selection if textSelection feature is disabled
      if (!features.textSelection && window.getSelection) {
        const selection = window.getSelection()
        if (selection && selection.removeAllRanges) {
          selection.removeAllRanges()
        }
      }
    }

    if (isEnabled) {
      // First, ensure clean state by removing any previous setup
      removeCleanup()

      // Enable interactions immediately (this will also call disableInteractions first)
      enableInteractions()

      // Clean up document
      cleanupDocument()

      // Re-apply on DOM changes (some sites dynamically add restrictions)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanupDocument)
      }

      // Start observing
      startObserving()
    } else {
      disableInteractions()
      removeCleanup()
    }
  }

  // Function to run when DOM is ready
  function runWhenReady(callback) {
    if (document.body) {
      callback()
    } else {
      let attempts = 0
      const checkReady = () => {
        if (document.body || attempts >= RAF_MAX_ATTEMPTS) {
          callback()
        } else {
          attempts++
          requestAnimationFrame(checkReady)
        }
      }
      checkReady()
    }
  }

  // Perform initial detection and initialize
  runWhenReady(async () => {
    // Perform initial detection before any modifications
    // This must be done before initialize() applies CSS changes
    detectRestrictions()

    // Load initial state and features from storage
    const hostname = window.location.hostname
    const config = await StorageUtils.getSiteConfig(hostname)
    initialize(config.enabled, config.features)
  })

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const hostname = window.location.hostname

    if (request.action === 'ping') {
      // Respond to ping to indicate content script is injected
      sendResponse({ pong: true })
      return true
    }

    if (request.action === 'getDetectionInfo') {
      // Run detection and send results
      const results = detectRestrictions()
      sendResponse({
        detectionResults: results,
        isEnabled: isEnabled,
        features: features,
      })
      return true
    }

    if (request.action === 'toggleSite' && request.hostname === hostname) {
      // Features may be included in request, or use existing/default
      const requestFeatures = request.features || null
      initialize(request.enabled, requestFeatures)
      return true
    }

    if (request.action === 'updateFeatures' && request.hostname === hostname) {
      // Update features while keeping enabled state
      if (isEnabled && request.features) {
        console.log('Allow Copy: Updating features', request.features)
        initialize(true, request.features)
        console.log('Allow Copy: Features updated successfully')
      }
      sendResponse({ success: true })
      return true
    }
  })
})()
