export interface InjectionErrorClassification {
  success: boolean
  error?: string
  shouldLog: boolean
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

export function parseSupportedHttpUrl(rawUrl: unknown): URL | null {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) return null

  try {
    const parsedUrl = new URL(rawUrl)
    const supportedProtocol = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
    return supportedProtocol && parsedUrl.hostname ? parsedUrl : null
  } catch {
    return null
  }
}

export function parseSupportedHostname(rawUrl: unknown): string | null {
  return parseSupportedHttpUrl(rawUrl)?.hostname ?? null
}

export function classifyPopupInjectionError(error: unknown): InjectionErrorClassification {
  const message = getErrorMessage(error)

  if (message.includes('Cannot access')) {
    return {
      success: false,
      error: 'Cannot access this page',
      shouldLog: false,
    }
  }

  if (message && !message.includes('duplicate')) {
    return { success: false, error: message, shouldLog: true }
  }

  return { success: true, shouldLog: false }
}

export function shouldLogBackgroundInjectionError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return Boolean(message && !message.includes('Cannot access') && !message.includes('No tab'))
}
