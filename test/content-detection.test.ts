// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { installContentScript } from '../src/content/install-content-script'
import { DEFAULT_FEATURES } from '../src/lib/storage'

const properties = ['oncontextmenu', 'onselectstart', 'oncopy', 'oncut', 'onpaste'] as const
const originalDescriptors = new Map(
  properties.map((key) => [key, Object.getOwnPropertyDescriptor(document, key)]),
)
let messageListener: (request: unknown, sender: unknown, respond: (value: unknown) => void) => void

function send(request: unknown) {
  const respond = vi.fn()
  messageListener(request, {}, respond)
  return respond.mock.calls[0]?.[0]
}

afterEach(() => {
  send({
    action: 'toggleSite',
    hostname: window.location.hostname,
    enabled: false,
    features: DEFAULT_FEATURES,
  })
  for (const key of properties) {
    const descriptor = originalDescriptors.get(key)
    if (descriptor) Object.defineProperty(document, key, descriptor)
    else Reflect.deleteProperty(document, key)
  }
  Reflect.deleteProperty(window, '__allowCopyInjected')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function install() {
  // Isolate the permanent visibility listener; detection itself remains real.
  vi.spyOn(document, 'addEventListener').mockImplementation(() => undefined)
  vi.stubGlobal('chrome', {
    storage: { sync: { get: vi.fn(async () => ({ sites: {} })) } },
    runtime: {
      onMessage: {
        addListener: (listener: typeof messageListener) => {
          messageListener = listener
        },
      },
    },
  })
  installContentScript()
  await Promise.resolve()
}

describe('content restriction detection', () => {
  it('reports all three JavaScript restrictions and caches them across enablement', async () => {
    for (const key of properties) {
      Object.defineProperty(document, key, { configurable: true, value: () => false })
    }
    await install()
    const before = send({ action: 'getDetectionInfo' })
    expect(before).toMatchObject({
      detectionResults: {
        jsRestrictions: { contextmenu: true, selectstart: true, copy: true },
      },
    })

    send({
      action: 'toggleSite',
      hostname: window.location.hostname,
      enabled: true,
      features: DEFAULT_FEATURES,
    })
    expect(document.oncontextmenu).toBeNull()
    expect(send({ action: 'getDetectionInfo' })).toEqual(before)
  })

  it('reads cut and paste getters once even though they are not reported restrictions', async () => {
    const cut = vi.fn(() => null)
    const paste = vi.fn(() => null)
    Object.defineProperty(document, 'oncut', { configurable: true, get: cut })
    Object.defineProperty(document, 'onpaste', { configurable: true, get: paste })
    await install()
    expect(send({ action: 'getDetectionInfo' })).toMatchObject({
      detectionResults: {
        jsRestrictions: { contextmenu: false, selectstart: false, copy: false },
      },
    })
    expect(cut).toHaveBeenCalledTimes(1)
    expect(paste).toHaveBeenCalledTimes(1)
    send({ action: 'getDetectionInfo' })
    expect(cut).toHaveBeenCalledTimes(1)
  })
})
