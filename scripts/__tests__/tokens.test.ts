import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Mirrors scripts/contrast.ts's own block-slicing so this test fails the same way that script would
// if the markers or block shape changed.
const here = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(resolve(here, '../../src/styles/tokens.css'), 'utf8')
const packageJson = readFileSync(resolve(here, '../../package.json'), 'utf8')
const mainTsx = readFileSync(resolve(here, '../../src/main.tsx'), 'utf8')

function block(marker: string): string {
  const start = tokensCss.indexOf(marker)
  if (start < 0) throw new Error(`tokens.css: could not find "${marker}"`)
  const open = tokensCss.indexOf('{', start)
  const close = tokensCss.indexOf('}', open)
  return tokensCss.slice(open + 1, close)
}

function parse(decls: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of decls.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const HEX = /^#[0-9a-f]{6}$/i
const HEX_TOKENS = ['--panel', '--bevel-light', '--bevel-dark', '--gold-text', '--stage-bg'] as const

describe('tokens.css: fonts, tokens, kit primitives', () => {
  const root = parse(block(':root {'))
  const darkExplicit = parse(block(":root[data-theme='dark']"))
  const darkMedia = parse(block('@media (prefers-color-scheme: dark)'))

  it('defines --font-display and --font-num starting with Silkscreen', () => {
    expect(root['--font-display']).toMatch(/^'Silkscreen'/)
    expect(root['--font-num']).toMatch(/^'Silkscreen'/)
  })

  it('sets --radius-s to 4px and --hud-h to 56px', () => {
    expect(root['--radius-s']).toBe('4px')
    expect(root['--hud-h']).toBe('56px')
  })

  it('defines the new panel/bevel/gold/stage tokens as flat hex in :root', () => {
    for (const t of HEX_TOKENS) {
      expect(root[t], `${t} should be defined`).toBeDefined()
      expect(root[t]).toMatch(HEX)
    }
  })

  it('defines the same five tokens, with equal values, in both dark blocks', () => {
    for (const t of HEX_TOKENS) {
      expect(darkExplicit[t], `${t} in :root[data-theme='dark']`).toBeDefined()
      expect(darkExplicit[t]).toMatch(HEX)
      expect(darkMedia[t], `${t} in @media (prefers-color-scheme: dark)`).toBeDefined()
      expect(darkMedia[t]).toMatch(HEX)
      expect(darkMedia[t]).toBe(darkExplicit[t])
    }
  })

  it('has no nested { inside any of the three blocks', () => {
    expect(block(':root {')).not.toContain('{')
    expect(block(":root[data-theme='dark']")).not.toContain('{')
    expect(block('@media (prefers-color-scheme: dark)')).not.toContain('{')
  })
})

describe('package.json: fontsource switch', () => {
  it('adds @fontsource/silkscreen and removes @fontsource/bangers', () => {
    expect(packageJson).toMatch(/"@fontsource\/silkscreen"/)
    expect(packageJson).not.toMatch(/@fontsource\/bangers/)
  })
})

describe('main.tsx: font imports', () => {
  it('imports silkscreen 400 and 700 and not bangers', () => {
    expect(mainTsx).toMatch(/@fontsource\/silkscreen\/400\.css/)
    expect(mainTsx).toMatch(/@fontsource\/silkscreen\/700\.css/)
    expect(mainTsx).not.toMatch(/@fontsource\/bangers/)
  })
})
