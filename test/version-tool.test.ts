import { describe, expect, it } from 'vitest'
import { bumpVersion, updateManifestVersionText } from '../.github/scripts/bump-manifest-version'
import npmPackage from '../package.json'
import lockfile from '../package-lock.json'
import manifest from '../src/manifest.json'

describe('manifest version tool', () => {
  it('uses only the manifest as the private project version source', () => {
    expect(npmPackage.private).toBe(true)
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/u)
    expect(npmPackage).not.toHaveProperty('version')
    expect(lockfile).not.toHaveProperty('version')
    expect(lockfile.packages['']).not.toHaveProperty('version')
  })

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
