import { describe, expect, it } from 'vitest'
import {
  classifyPopupInjectionError,
  parseSupportedHostname,
  parseSupportedHttpUrl,
  shouldLogBackgroundInjectionError,
} from '../src/lib/extension-logic'

describe('extension URL and error logic', () => {
  it('accepts only HTTP and HTTPS URLs with a hostname', () => {
    expect(parseSupportedHttpUrl('https://example.com/path')?.hostname).toBe('example.com')
    expect(parseSupportedHttpUrl('http://example.com')?.hostname).toBe('example.com')
    expect(parseSupportedHttpUrl('file:///tmp/index.html')).toBeNull()
    expect(parseSupportedHttpUrl('chrome://extensions/')).toBeNull()
    expect(parseSupportedHttpUrl('not-a-url')).toBeNull()
  })

  it('returns a hostname only for supported URLs', () => {
    expect(parseSupportedHostname('https://news.ycombinator.com/item?id=1')).toBe(
      'news.ycombinator.com',
    )
    expect(parseSupportedHostname('chrome://settings/')).toBeNull()
  })

  it('classifies popup injection errors', () => {
    expect(classifyPopupInjectionError(new Error('Cannot access contents of url'))).toEqual({
      success: false,
      error: 'Cannot access this page',
      shouldLog: false,
    })
    expect(classifyPopupInjectionError(new Error('Script already injected duplicate'))).toEqual({
      success: true,
      shouldLog: false,
    })
    expect(classifyPopupInjectionError(new Error('Boom'))).toEqual({
      success: false,
      error: 'Boom',
      shouldLog: true,
    })
  })

  it('logs only unexpected background injection failures', () => {
    expect(shouldLogBackgroundInjectionError(new Error('Cannot access page'))).toBe(false)
    expect(shouldLogBackgroundInjectionError(new Error('No tab with id: 1'))).toBe(false)
    expect(shouldLogBackgroundInjectionError(new Error('unexpected failure'))).toBe(true)
    expect(shouldLogBackgroundInjectionError('unexpected string failure')).toBe(false)
  })
})
