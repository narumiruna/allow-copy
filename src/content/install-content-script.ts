export function installContentScript(): void {
  type FeatureSettings = {
    textSelection: boolean
    contextMenu: boolean
    copyPaste: boolean
    cursor: boolean
  }

  type DetectionResults = {
    cssRestrictions: {
      userSelect: boolean
      pointerEvents: boolean
      cursor: boolean
    }
    jsRestrictions: {
      contextmenu: boolean
      selectstart: boolean
      copy: boolean
    }
  }

  type DocumentEventProperty = 'oncontextmenu' | 'onselectstart' | 'oncopy' | 'oncut' | 'onpaste'

  type RegisteredListener = {
    type: string
    handler: EventListener
  }

  const injectedWindow = window as Window & { __allowCopyInjected?: boolean }
  if (injectedWindow.__allowCopyInjected) return
  injectedWindow.__allowCopyInjected = true

  const MOUSE_BUTTON = { LEFT: 0, RIGHT: 2 } as const
  const STYLE_ID = 'allow-copy-style'
  const PREVENT_RIGHT_CLICK_NAV_KEY = '__allowCopyPreventRightClickNavAt'
  const PREVENT_RIGHT_CLICK_NAV_WINDOW_MS = 200
  const PREVENT_RIGHT_CLICK_NAV_TTL_MS = 10 * 60 * 1000
  const RAF_MAX_ATTEMPTS = 50
  const DOCUMENT_PROPERTIES: DocumentEventProperty[] = [
    'oncontextmenu',
    'onselectstart',
    'oncopy',
    'oncut',
    'onpaste',
  ]
  const DEFAULT_FEATURES: FeatureSettings = {
    textSelection: true,
    contextMenu: true,
    copyPaste: true,
    cursor: true,
  }

  let isEnabled = false
  let features = { ...DEFAULT_FEATURES }
  let eventListeners: RegisteredListener[] = []
  let observer: MutationObserver | null = null
  let observerThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let detectionResults: DetectionResults | null = null
  let hasDetectedOnce = false
  let lastRightClickAt = 0
  let shouldPreventRightClickNavigation = false
  let domReadyCleanupRegistered = false
  const originalDocumentPropertyDescriptors = new Map<
    DocumentEventProperty,
    PropertyDescriptor | undefined
  >()

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  function normalizeFeatures(value: unknown): FeatureSettings {
    const candidate = isRecord(value) ? value : {}
    return {
      textSelection:
        typeof candidate.textSelection === 'boolean'
          ? candidate.textSelection
          : DEFAULT_FEATURES.textSelection,
      contextMenu:
        typeof candidate.contextMenu === 'boolean'
          ? candidate.contextMenu
          : DEFAULT_FEATURES.contextMenu,
      copyPaste:
        typeof candidate.copyPaste === 'boolean' ? candidate.copyPaste : DEFAULT_FEATURES.copyPaste,
      cursor: typeof candidate.cursor === 'boolean' ? candidate.cursor : DEFAULT_FEATURES.cursor,
    }
  }

  function normalizeSiteConfig(value: unknown): {
    enabled: boolean
    features: FeatureSettings
  } {
    if (typeof value === 'boolean') {
      return { enabled: value, features: { ...DEFAULT_FEATURES } }
    }

    if (!isRecord(value)) {
      return { enabled: false, features: { ...DEFAULT_FEATURES } }
    }

    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : value.enabled === undefined,
      features: normalizeFeatures(value.features),
    }
  }

  async function loadSiteConfig(): Promise<{
    enabled: boolean
    features: FeatureSettings
  }> {
    try {
      const result = await chrome.storage.sync.get(['sites'])
      const sites = isRecord(result.sites) ? result.sites : {}
      return Object.hasOwn(sites, window.location.hostname)
        ? normalizeSiteConfig(sites[window.location.hostname])
        : { enabled: false, features: { ...DEFAULT_FEATURES } }
    } catch {
      return { enabled: false, features: { ...DEFAULT_FEATURES } }
    }
  }

  function loadRightClickNavigationPreference(): boolean {
    try {
      const raw = window.sessionStorage?.getItem(PREVENT_RIGHT_CLICK_NAV_KEY)
      if (!raw) return false
      const savedAt = Number(raw)
      if (!Number.isFinite(savedAt)) return false
      if (Date.now() - savedAt <= PREVENT_RIGHT_CLICK_NAV_TTL_MS) return true
      window.sessionStorage?.removeItem(PREVENT_RIGHT_CLICK_NAV_KEY)
    } catch {
      // Session storage can be unavailable on restricted pages.
    }
    return false
  }

  function persistRightClickNavigationPreference(): void {
    try {
      window.sessionStorage?.setItem(PREVENT_RIGHT_CLICK_NAV_KEY, String(Date.now()))
    } catch {
      // This preference is best effort only.
    }
  }

  function stopEvent(event: Event): void {
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  function createLeftMouseEventHandler(): EventListener {
    return (event) => {
      if (!(event instanceof MouseEvent) || event.button !== MOUSE_BUTTON.LEFT) return
      stopEvent(event)
    }
  }

  function createRightMouseEventHandler(eventType: string): EventListener {
    return (event) => {
      if (!(event instanceof MouseEvent) || event.button !== MOUSE_BUTTON.RIGHT) return
      lastRightClickAt = performance.now()
      stopEvent(event)

      const canNavigate = eventType === 'mousedown' || eventType === 'mouseup'
      if (shouldPreventRightClickNavigation && canNavigate && event.cancelable) {
        event.preventDefault()
      }
    }
  }

  function detectCssRestrictions(element: Element): {
    userSelect: boolean
    pointerEvents: boolean
    cursor: boolean
  } {
    const computed = window.getComputedStyle(element)
    const userSelect = computed.userSelect || computed.webkitUserSelect
    const normalCursors = new Set([
      'auto',
      'default',
      'text',
      'pointer',
      'help',
      'wait',
      'move',
      'crosshair',
    ])

    return {
      userSelect: userSelect === 'none',
      pointerEvents: computed.pointerEvents === 'none',
      cursor: Boolean(computed.cursor && !normalCursors.has(computed.cursor)),
    }
  }

  function detectRestrictions(): DetectionResults {
    if (hasDetectedOnce && detectionResults) return detectionResults

    const results: DetectionResults = {
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

    const candidates = [document.body, document.documentElement]
    const sampledContent = Array.from(
      document.querySelectorAll('p, div, span, article, section, main'),
    ).slice(0, 10)

    for (const element of [...candidates, ...sampledContent]) {
      if (!element) continue
      const restrictions = detectCssRestrictions(element)
      if (restrictions.userSelect) results.cssRestrictions.userSelect = true
      if (restrictions.pointerEvents) results.cssRestrictions.pointerEvents = true
      if (restrictions.cursor) results.cssRestrictions.cursor = true
    }

    for (const property of DOCUMENT_PROPERTIES) {
      if (Reflect.get(document, property) == null) continue
      if (property === 'oncontextmenu') results.jsRestrictions.contextmenu = true
      if (property === 'onselectstart') results.jsRestrictions.selectstart = true
      if (property === 'oncopy') results.jsRestrictions.copy = true
    }

    detectionResults = results
    hasDetectedOnce = true
    return results
  }

  function disableInteractions(): void {
    for (const { type, handler } of eventListeners) {
      document.removeEventListener(type, handler, true)
    }
    eventListeners = []
  }

  function registerListener(type: string, handler: EventListener): void {
    document.addEventListener(type, handler, true)
    eventListeners.push({ type, handler })
  }

  function enableInteractions(): void {
    disableInteractions()

    if (features.textSelection) {
      const mouseHandler = createLeftMouseEventHandler()
      for (const eventType of ['mousedown', 'mouseup', 'click']) {
        registerListener(eventType, mouseHandler)
      }
      registerListener('selectstart', (event) => event.stopPropagation())
    }

    if (features.contextMenu) {
      for (const eventType of ['mousedown', 'mouseup', 'click']) {
        registerListener(eventType, createRightMouseEventHandler(eventType))
      }
      registerListener('contextmenu', stopEvent)
    }

    if (features.copyPaste) {
      const copyHandler: EventListener = (event) => event.stopPropagation()
      registerListener('copy', copyHandler)
      registerListener('cut', copyHandler)
    }
  }

  function injectStyle(): void {
    if (!isEnabled) return

    const cssRules: string[] = []
    if (features.textSelection) {
      cssRules.push(`
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      `)
    }
    if (features.cursor) cssRules.push('cursor: auto !important;')

    let attempts = 0
    const addStyle = (): void => {
      if (!document.head) {
        attempts += 1
        if (attempts < RAF_MAX_ATTEMPTS) requestAnimationFrame(addStyle)
        return
      }

      document.getElementById(STYLE_ID)?.remove()
      if (cssRules.length === 0 || !isEnabled) return

      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `* { ${cssRules.join('\n')} }`
      document.head.appendChild(style)
      void document.body?.offsetHeight
    }
    addStyle()
  }

  function shouldOverrideProperty(property: DocumentEventProperty): boolean {
    if (property === 'oncontextmenu') return features.contextMenu
    if (property === 'onselectstart') return features.textSelection
    return features.copyPaste
  }

  function overrideDocumentProperties(): void {
    for (const property of DOCUMENT_PROPERTIES) {
      if (!shouldOverrideProperty(property)) continue

      try {
        if (!originalDocumentPropertyDescriptors.has(property)) {
          originalDocumentPropertyDescriptors.set(
            property,
            Object.getOwnPropertyDescriptor(document, property),
          )
        }
        Object.defineProperty(document, property, {
          get: () => null,
          set: () => undefined,
          configurable: true,
        })
      } catch {
        // Some document properties are not configurable.
      }
    }
  }

  function restoreDocumentProperties(): void {
    for (const property of DOCUMENT_PROPERTIES) {
      if (!originalDocumentPropertyDescriptors.has(property)) continue

      try {
        const descriptor = originalDocumentPropertyDescriptors.get(property)
        if (descriptor) Object.defineProperty(document, property, descriptor)
        else Reflect.deleteProperty(document, property)
      } catch {
        // A page can replace a property with a non-configurable descriptor.
      } finally {
        originalDocumentPropertyDescriptors.delete(property)
      }
    }
  }

  function cleanupDocument(): void {
    if (!isEnabled) return
    injectStyle()
    overrideDocumentProperties()
  }

  function removeCleanup(): void {
    if (observerThrottleTimer) {
      clearTimeout(observerThrottleTimer)
      observerThrottleTimer = null
    }
    document.getElementById(STYLE_ID)?.remove()
    observer?.disconnect()
    observer = null
    restoreDocumentProperties()
  }

  function startObserving(): void {
    if (!isEnabled) return

    observer = new MutationObserver(() => {
      if (observerThrottleTimer) clearTimeout(observerThrottleTimer)
      observerThrottleTimer = setTimeout(() => {
        observerThrottleTimer = null
        if (isEnabled && !document.getElementById(STYLE_ID)) injectStyle()
      }, 100)
    })

    let attempts = 0
    const startObserver = (): void => {
      if (document.head) {
        observer?.observe(document.head, { childList: true })
        return
      }
      attempts += 1
      if (attempts < RAF_MAX_ATTEMPTS) requestAnimationFrame(startObserver)
    }
    startObserver()
  }

  function onDomReadyCleanup(): void {
    domReadyCleanupRegistered = false
    cleanupDocument()
  }

  function initialize(enabled: boolean, featureSettings: unknown): void {
    isEnabled = enabled
    features = normalizeFeatures(featureSettings)

    if (!features.textSelection) window.getSelection()?.removeAllRanges()

    if (!isEnabled) {
      if (domReadyCleanupRegistered) {
        document.removeEventListener('DOMContentLoaded', onDomReadyCleanup)
        domReadyCleanupRegistered = false
      }
      disableInteractions()
      removeCleanup()
      return
    }

    removeCleanup()
    enableInteractions()
    cleanupDocument()

    if (document.readyState === 'loading' && !domReadyCleanupRegistered) {
      document.addEventListener('DOMContentLoaded', onDomReadyCleanup, { once: true })
      domReadyCleanupRegistered = true
    }
    startObserving()
  }

  function runWhenReady(callback: () => void): void {
    if (document.body) {
      callback()
      return
    }

    let attempts = 0
    const checkReady = (): void => {
      if (document.body || attempts >= RAF_MAX_ATTEMPTS) {
        callback()
        return
      }
      attempts += 1
      requestAnimationFrame(checkReady)
    }
    checkReady()
  }

  runWhenReady(() => {
    detectRestrictions()
    shouldPreventRightClickNavigation = loadRightClickNavigationPreference()
    void loadSiteConfig().then((config) => initialize(config.enabled, config.features))
  })

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState !== 'hidden' || !features.contextMenu || !lastRightClickAt) {
        return
      }
      if (performance.now() - lastRightClickAt > PREVENT_RIGHT_CLICK_NAV_WINDOW_MS) return
      shouldPreventRightClickNavigation = true
      persistRightClickNavigationPreference()
    },
    true,
  )

  chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse) => {
    if (!isRecord(request) || typeof request.action !== 'string') return

    if (request.action === 'getDetectionInfo') {
      sendResponse({
        detectionResults: detectRestrictions(),
        isEnabled,
        features: { ...features },
      })
      return
    }

    if (request.hostname !== window.location.hostname) return

    if (request.action === 'toggleSite' && typeof request.enabled === 'boolean') {
      initialize(request.enabled, request.features)
      sendResponse({ success: true })
      return
    }

    if (request.action === 'updateFeatures' && isEnabled) {
      initialize(true, request.features)
      sendResponse({ success: true })
    }
  })
}
