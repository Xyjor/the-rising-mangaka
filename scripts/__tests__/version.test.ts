import { describe, expect, it } from 'vitest'
import { readCargoVersion, setCargoVersion, tagMatches } from '../lib/version'

// A trimmed but structurally real src-tauri/Cargo.toml: a [package] table (with its own version line) followed by
// other tables, including a dependency that carries a `version` field of its own that must never be touched.
const SAMPLE = [
  '[package]',
  'name = "rising-mangaka"',
  'version = "0.1.0"',
  'edition = "2021"',
  'publish = false',
  '',
  '[lib]',
  'name = "rising_mangaka_lib"',
  '',
  '[dependencies]',
  'tauri = { version = "2", features = [] }',
  '',
  '[profile.release]',
  'strip = true',
  '',
].join('\n')

// The same content with CRLF line endings, as Cargo.toml is actually saved on this project.
const SAMPLE_CRLF = SAMPLE.replace(/\n/g, '\r\n')

// No [package] table at all: only a table whose own field happens to be named `version`.
const DEPENDENCY_ONLY = ['[dependencies]', 'tauri = { version = "2", features = [] }', ''].join('\n')

describe('readCargoVersion', () => {
  it('reads the [package] table version', () => {
    expect(readCargoVersion(SAMPLE)).toBe('0.1.0')
  })

  it('reads it the same way with CRLF line endings', () => {
    expect(readCargoVersion(SAMPLE_CRLF)).toBe('0.1.0')
  })

  it('returns null for a dependency-only TOML with no [package] table', () => {
    expect(readCargoVersion(DEPENDENCY_ONLY)).toBeNull()
  })
})

describe('setCargoVersion', () => {
  it('changes only the [package] version line', () => {
    const updated = setCargoVersion(SAMPLE, '0.2.0')
    expect(updated).toBe(SAMPLE.replace('version = "0.1.0"', 'version = "0.2.0"'))
    expect(readCargoVersion(updated)).toBe('0.2.0')
  })

  it('preserves CRLF line endings, changing only the version line', () => {
    const updated = setCargoVersion(SAMPLE_CRLF, '0.2.0')
    expect(updated).toBe(SAMPLE_CRLF.replace('version = "0.1.0"', 'version = "0.2.0"'))
  })

  it('accepts a pre-release suffix', () => {
    const updated = setCargoVersion(SAMPLE, '0.2.0-rc.1')
    expect(readCargoVersion(updated)).toBe('0.2.0-rc.1')
  })

  it('throws on a version that is not MAJOR.MINOR.PATCH', () => {
    expect(() => setCargoVersion(SAMPLE, 'banana')).toThrow()
  })

  it('throws when there is no [package] version line', () => {
    expect(() => setCargoVersion(DEPENDENCY_ONLY, '0.2.0')).toThrow()
  })
})

describe('tagMatches', () => {
  it('matches a v-prefixed tag to the version it names', () => {
    expect(tagMatches('v0.2.0', '0.2.0')).toBe(true)
  })

  it('rejects a tag with no v prefix, even if the digits match', () => {
    expect(tagMatches('0.2.0', '0.2.0')).toBe(false)
  })

  it('rejects a tag naming a different version', () => {
    expect(tagMatches('v0.2.1', '0.2.0')).toBe(false)
  })
})
