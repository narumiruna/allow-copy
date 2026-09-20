import { vi } from 'vitest'
import type { StorageAreaLike } from '../../src/lib/storage'

export function createStorageArea(initial: Record<string, unknown> = {}) {
  let state = structuredClone(initial)
  const area = {
    get: vi.fn<StorageAreaLike['get']>(async () => structuredClone(state)),
    set: vi.fn<StorageAreaLike['set']>(async (items) => {
      state = { ...state, ...structuredClone(items) }
    }),
  }

  return { ...area, snapshot: () => structuredClone(state) }
}
