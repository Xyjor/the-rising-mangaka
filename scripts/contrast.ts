/// <reference types="node" />
// Contrast check: reads src/styles/tokens.css, resolves the light theme, the explicit dark theme
// (:root[data-theme='dark']) and the OS dark theme (the nested prefers-color-scheme block), then
// computes WCAG 2 contrast ratios for every text/background pair the UI relies on.
// Exits non-zero if any pair is under 4.5:1 (WCAG AA for normal text).
// Run with: npx vite-node scripts/contrast.ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../src/styles/tokens.css'), 'utf8')

type Tokens = Record<string, string>

/** Returns the declarations inside the first `{ ... }` that follows `marker`. */
function block(marker: string): string {
  const start = css.indexOf(marker)
  if (start < 0) throw new Error(`tokens.css: could not find "${marker}"`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

function parse(decls: string): Tokens {
  const out: Tokens = {}
  for (const m of decls.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** Follows `var(--x)` references until a literal value remains. */
function resolveVar(tokens: Tokens, name: string, depth = 0): string {
  const raw = tokens[name]
  if (raw === undefined) throw new Error(`token ${name} is not defined`)
  const m = raw.match(/^var\((--[\w-]+)\)$/)
  if (!m) return raw
  if (depth > 8) throw new Error(`token ${name} references itself`)
  return resolveVar(tokens, m[1], depth + 1)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const light = parse(block(':root {'))
// Dark themes inherit every token they do not redefine.
const darkExplicit: Tokens = { ...light, ...parse(block(":root[data-theme='dark']")) }
const darkMedia: Tokens = { ...light, ...parse(block('@media (prefers-color-scheme: dark)')) }

const THEMES: Record<string, Tokens> = { light, 'dark (data-theme)': darkExplicit, 'dark (OS)': darkMedia }
const FAMILIES = ['accent', 'blue', 'green', 'purple'] as const
const MIN = 4.5

type Pair = { fg: string; bg: string; label: string }
const PAIRS: Pair[] = [
  { fg: '--ink-3', bg: '--paper', label: 'ink-3 on paper' },
  { fg: '--accent-ink', bg: '--accent', label: 'accent-ink on accent (primary button)' },
  ...FAMILIES.map((f) => ({ fg: `--${f}-text`, bg: '--paper', label: `${f}-text on paper` })),
  ...FAMILIES.map((f) => ({ fg: `--${f}-text`, bg: `--${f}-soft`, label: `${f}-text on ${f}-soft (chip)` })),
  ...[0, 1, 2, 3, 4].map((r) => ({ fg: `--rating-${r}-text`, bg: '--paper', label: `rating-${r}-text on paper` })),
  ...[1, 2, 3].map((r) => ({ fg: '#16161a', bg: `--rating-${r}`, label: `#16161a on rating-${r} (notebook cell)` })),
]

let failures = 0
for (const [theme, tokens] of Object.entries(THEMES)) {
  console.log(`\n${theme}`)
  for (const p of PAIRS) {
    let line: string
    try {
      const fg = p.fg.startsWith('--') ? resolveVar(tokens, p.fg) : p.fg
      const bg = p.bg.startsWith('--') ? resolveVar(tokens, p.bg) : p.bg
      const ratio = contrast(fg, bg)
      const ok = ratio >= MIN
      if (!ok) failures++
      line = `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2).padStart(5)}:1  ${p.label}  (${fg} on ${bg})`
    } catch (err) {
      failures++
      line = `  FAIL        ${p.label}  (${(err as Error).message})`
    }
    console.log(line)
  }
}

console.log(failures ? `\n${failures} pair(s) under ${MIN}:1` : `\nAll pairs are at least ${MIN}:1 in every theme`)
process.exit(failures ? 1 : 0)
