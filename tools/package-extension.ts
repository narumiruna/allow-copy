import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8')) as {
  version?: unknown
}
if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(manifest.version)) {
  throw new Error('src/manifest.json must contain a semantic version')
}

const zipName = `allow-copy-${manifest.version}.zip`
const zipPath = path.join('dist', 'chrome', zipName)
if (existsSync(zipPath)) {
  throw new Error(`${zipPath} already exists; run npm run clean or remove it first`)
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(
  command,
  [
    'extension',
    'build',
    '--browser=chrome',
    '--zip',
    `--zip-filename=${zipName}`,
    '--no-telemetry',
  ],
  { stdio: 'inherit' },
)

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
if (!existsSync(zipPath)) throw new Error(`Extension.js did not create ${zipPath}`)

console.log(`Created ${zipPath}`)
