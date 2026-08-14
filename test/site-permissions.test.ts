import { describe, expect, it, vi } from 'vitest'
import {
  ensurePersistentSiteAccess,
  getPermissionOriginForUrl,
  getPermissionOriginsForHostname,
  hasPersistentSiteAccessForUrl,
  type PermissionsApi,
} from '../src/lib/site-permissions'

describe('site permissions', () => {
  it('builds HTTP and HTTPS origins for a valid hostname', () => {
    expect(getPermissionOriginsForHostname('example.com')).toEqual([
      'http://example.com/*',
      'https://example.com/*',
    ])
    expect(getPermissionOriginsForHostname('')).toEqual([])
  })

  it('builds an origin pattern for a supported page only', () => {
    expect(getPermissionOriginForUrl('https://example.com/path?x=1')).toBe('https://example.com/*')
    expect(getPermissionOriginForUrl('chrome://settings')).toBeNull()
    expect(getPermissionOriginForUrl('bad url')).toBeNull()
  })

  it('does not request permissions that are already granted', async () => {
    const contains = vi.fn(async () => true)
    const request = vi.fn(async () => true)
    const permissionsApi: PermissionsApi = { contains, request }

    await expect(ensurePersistentSiteAccess('example.com', permissionsApi)).resolves.toBe(true)
    expect(contains).toHaveBeenCalledWith({
      origins: ['http://example.com/*', 'https://example.com/*'],
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('returns the browser decision when requesting missing access', async () => {
    const permissionsApi: PermissionsApi = {
      contains: vi.fn(async () => false),
      request: vi.fn(async () => false),
    }

    await expect(ensurePersistentSiteAccess('example.com', permissionsApi)).resolves.toBe(false)
    expect(permissionsApi.request).toHaveBeenCalledWith({
      origins: ['http://example.com/*', 'https://example.com/*'],
    })
  })

  it('fails closed when the API or URL is unavailable', async () => {
    await expect(ensurePersistentSiteAccess('example.com', null)).resolves.toBe(false)
    await expect(hasPersistentSiteAccessForUrl('chrome://settings', null)).resolves.toBe(false)
  })

  it('checks access for the current page origin only', async () => {
    const contains = vi.fn(async () => true)

    await expect(
      hasPersistentSiteAccessForUrl('https://example.com/path', { contains }),
    ).resolves.toBe(true)
    expect(contains).toHaveBeenCalledWith({ origins: ['https://example.com/*'] })
  })
})
