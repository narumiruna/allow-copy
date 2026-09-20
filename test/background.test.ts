import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FEATURES } from '../src/lib/storage'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('background installation reconciliation', () => {
  it('restores an enabled permitted tab after installation', async () => {
    let onInstalled: (() => void) | undefined
    let syncState: Record<string, unknown> = {
      sites: {
        'example.com': {
          enabled: true,
          features: DEFAULT_FEATURES,
        },
      },
    }

    const executeScript = vi.fn(async () => [])
    const setBadgeText = vi.fn(async () => undefined)
    const setBadgeBackgroundColor = vi.fn(async () => undefined)

    vi.stubGlobal('chrome', {
      action: {
        setBadgeText,
        setBadgeBackgroundColor,
      },
      permissions: {
        contains: vi.fn(async () => true),
        onAdded: { addListener: vi.fn() },
      },
      runtime: {
        onInstalled: {
          addListener: vi.fn((listener: () => void) => {
            onInstalled = listener
          }),
        },
      },
      scripting: { executeScript },
      storage: {
        onChanged: { addListener: vi.fn() },
        session: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
        },
        sync: {
          get: vi.fn(async () => structuredClone(syncState)),
          set: vi.fn(async (items: Record<string, unknown>) => {
            syncState = { ...syncState, ...structuredClone(items) }
          }),
        },
      },
      tabs: {
        get: vi.fn(),
        onActivated: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
        query: vi.fn(async () => [{ id: 7, url: 'https://example.com/article' }]),
      },
      webNavigation: {
        onCommitted: { addListener: vi.fn() },
      },
    })

    await import('../src/background')
    expect(onInstalled).toBeTypeOf('function')

    onInstalled?.()

    await vi.waitFor(() => {
      expect(setBadgeText).toHaveBeenCalledWith({ text: '✓', tabId: 7 })
      expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#46a758', tabId: 7 })
      expect(executeScript).toHaveBeenCalled()
    })
  })
})
