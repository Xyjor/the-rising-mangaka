// Keeps src-tauri/Cargo.toml's [package] version in step with package.json (tauri.conf.json already reads its own
// version from ../package.json, so Cargo.toml is the one other file that needs it kept in sync by hand).
// Usage:
//   vite-node scripts/sync-version.ts                 # writes package.json's version into Cargo.toml
//   vite-node scripts/sync-version.ts --check          # exit 1 unless Cargo.toml already matches; else print it
//   vite-node scripts/sync-version.ts --check v0.1.0   # also exit 1 unless the tag names that version
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCargoVersion, setCargoVersion, tagMatches } from './lib/version'

const here = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = resolve(here, '../package.json')
const cargoTomlPath = resolve(here, '../src-tauri/Cargo.toml')

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
const check = args[0] === '--check'
if (args.length > (check ? 2 : 0)) {
  fail('Usage: vite-node scripts/sync-version.ts [--check [tag]]')
}
const tag = check ? args[1] : undefined

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
const version = pkg.version
const toml = readFileSync(cargoTomlPath, 'utf8')

if (check) {
  const cargoVersion = readCargoVersion(toml)
  if (cargoVersion !== version) {
    fail(`src-tauri/Cargo.toml is at ${cargoVersion ?? 'no [package] version'}, package.json is at ${version}`)
  }
  if (tag !== undefined && !tagMatches(tag, version)) {
    fail(`tag "${tag}" does not name package.json's version ${version}`)
  }
  console.log(version)
} else {
  const updated = setCargoVersion(toml, version)
  if (updated === toml) {
    console.log(`src-tauri/Cargo.toml is already at ${version}`)
  } else {
    writeFileSync(cargoTomlPath, updated)
    console.log(`src-tauri/Cargo.toml updated to ${version}`)
  }
}
