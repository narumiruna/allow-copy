export interface PermissionsApi {
  contains(permissions: { origins: string[] }): Promise<boolean>
  request?: (permissions: { origins: string[] }) => Promise<boolean>
}

function getPermissionsApi(): PermissionsApi {
  return chrome.permissions
}

export function getPermissionOriginForUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return null

  try {
    const parsedUrl = new URL(rawUrl)
    const supported = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
    return supported && parsedUrl.hostname ? `${parsedUrl.protocol}//${parsedUrl.hostname}/*` : null
  } catch {
    return null
  }
}

export function getPermissionOriginsForHostname(hostname: string): string[] {
  if (!hostname || /[\s/\\]/u.test(hostname)) return []
  return [`http://${hostname}/*`, `https://${hostname}/*`]
}

export async function hasPersistentSiteAccessForUrl(
  rawUrl: unknown,
  permissionsApi: PermissionsApi | null = getPermissionsApi(),
): Promise<boolean> {
  const origin = getPermissionOriginForUrl(rawUrl)
  if (!origin || !permissionsApi?.contains) return false
  return permissionsApi.contains({ origins: [origin] })
}

export async function ensurePersistentSiteAccess(
  hostname: string,
  permissionsApi: PermissionsApi | null = getPermissionsApi(),
): Promise<boolean> {
  const origins = getPermissionOriginsForHostname(hostname)
  if (origins.length === 0 || !permissionsApi?.contains) return false

  if (await permissionsApi.contains({ origins })) return true
  if (!permissionsApi.request) return false
  return permissionsApi.request({ origins })
}
