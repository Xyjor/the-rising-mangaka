// [package] version helpers for src-tauri/Cargo.toml, shared by scripts/sync-version.ts and its tests.
// TOML is parsed just enough to find the `[package]` table's own `version = "..."` line: a dependency's version
// (`tauri = { version = "2" }`, or a `[dependencies.tauri]` table's own `version = "2"` line) lives in a different
// table and is never read or touched. Everything else in the file — indentation, comments, other lines, and CRLF
// vs LF line endings — is left byte-for-byte when a version is written.

const PACKAGE_HEADER = /^\[package\][ \t]*(\r?\n|$)/m
const SECTION_HEADER = /^\[[^\]]*\][ \t]*(\r?\n|$)/m
const VERSION_LINE = /^version[ \t]*=[ \t]*"([^"]*)"/m
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/

/** The `[package]` table's body span (after its header, up to the next `[...]` header or end of file), or null when there is no `[package]` table. */
function packageSection(toml: string): { start: number; end: number } | null {
  const header = PACKAGE_HEADER.exec(toml)
  if (!header) return null
  const start = header.index + header[0].length
  const next = SECTION_HEADER.exec(toml.slice(start))
  const end = next ? start + next.index : toml.length
  return { start, end }
}

/** The `[package]` table's `version` value, or null when there is no `[package]` table or it has no version line. */
export function readCargoVersion(toml: string): string | null {
  const section = packageSection(toml)
  if (!section) return null
  const match = VERSION_LINE.exec(toml.slice(section.start, section.end))
  return match ? match[1] : null
}

/**
 * Returns `toml` with the `[package]` table's version value replaced by `version`. Every other character —
 * other tables' own `version` lines, comments, indentation, and CRLF vs LF line endings — is unchanged.
 * Throws when `version` is not `MAJOR.MINOR.PATCH` (optionally with a `-pre.release` suffix), or when `toml` has
 * no `[package]` version line to replace.
 */
export function setCargoVersion(toml: string, version: string): string {
  if (!SEMVER.test(version)) throw new Error(`setCargoVersion: "${version}" is not a MAJOR.MINOR.PATCH version`)
  const section = packageSection(toml)
  if (!section) throw new Error('setCargoVersion: no [package] table found')
  const body = toml.slice(section.start, section.end)
  const match = VERSION_LINE.exec(body)
  if (!match) throw new Error('setCargoVersion: no [package] version line found')
  const valueStart = section.start + match.index + match[0].indexOf('"') + 1
  const valueEnd = valueStart + match[1].length
  return toml.slice(0, valueStart) + version + toml.slice(valueEnd)
}

/** Whether `tag` (e.g. `v0.2.0`, from `github.ref_name` on a `v*` tag push) names `version` exactly. */
export function tagMatches(tag: string, version: string): boolean {
  return tag === `v${version}`
}
