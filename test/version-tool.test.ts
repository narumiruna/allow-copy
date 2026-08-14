import { describe, expect, it } from 'vitest'
import { bumpVersion, updateManifestVersionText } from '../.github/scripts/bump-manifest-version'

describe('manifest version tool', () => {
  it('supports semantic major, minor, and patch bumps', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('updates only the version while preserving manifest formatting', () => {
    const source = '{\n  "name": "Allow Copy",\n  "version": "1.2.3"\n}\n'
    expect(updateManifestVersionText(source, 'patch')).toEqual({
      text: '{\n  "name": "Allow Copy",\n  "version": "1.2.4"\n}\n',
      version: '1.2.4',
    })
  })

  it('rejects invalid versions', () => {
    expect(() => bumpVersion('1.2', 'patch')).toThrow('Invalid manifest version')
  })
})
