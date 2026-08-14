#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export type BumpType = 'major' | 'minor' | 'patch'

const MANIFEST_PATH = 'src/manifest.json'

export function bumpVersion(version: string, bump: BumpType): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Invalid manifest version: ${version}`)

  const parts = match.slice(1).map(Number)
  if (bump === 'major') {
    parts[0] += 1
    parts[1] = 0
    parts[2] = 0
  } else if (bump === 'minor') {
    parts[1] += 1
    parts[2] = 0
  } else {
    parts[2] += 1
  }
  return parts.join('.')
}

export function updateManifestVersionText(
  text: string,
  bump: BumpType,
): {
  text: string
  version: string
} {
  const manifest = JSON.parse(text) as { version?: unknown }
  if (typeof manifest.version !== 'string') {
    throw new Error(`Invalid manifest version: ${String(manifest.version)}`)
  }

  const version = bumpVersion(manifest.version, bump)
  const nextText = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`)
  if (nextText === text) throw new Error('Could not replace manifest version')
  return { text: nextText, version }
}

function parseBump(value: string | undefined): BumpType {
  const bump = value ?? 'patch'
  if (bump === 'major' || bump === 'minor' || bump === 'patch') return bump
  throw new Error(`Unknown bump type: ${bump}. Use major, minor, or patch.`)
}

export function main(args = process.argv.slice(2)): void {
  const bump = parseBump(args[0])
  let text: string
  try {
    text = readFileSync(MANIFEST_PATH, 'utf8')
  } catch (error) {
    throw new Error(`Could not read ${MANIFEST_PATH}: ${getErrorMessage(error)}`)
  }

  const result = updateManifestVersionText(text, bump)
  try {
    writeFileSync(MANIFEST_PATH, result.text)
  } catch (error) {
    throw new Error(`Could not write ${MANIFEST_PATH}: ${getErrorMessage(error)}`)
  }
  console.log(result.version)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(getErrorMessage(error))
    process.exitCode = 1
  }
}
