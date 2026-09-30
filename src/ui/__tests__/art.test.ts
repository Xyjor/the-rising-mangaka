// Checks the art pipeline's output on disk, without importing sharp or any browser API: manifest shape, that every
// entry has both a raw source and a generated PNG, no orphan PNGs, and that every PNG is a small indexed (colour
// type 3) image whose IHDR size matches its manifest `native` size and whose PLTE entries are all in ART_PALETTE.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ART_PALETTE } from '../art/palette'

const ROOT = join(__dirname, '..', '..', '..')
const MANIFEST_PATH = join(ROOT, 'art', 'manifest.json')
const ART_DIR = join(ROOT, 'src', 'assets', 'art')
const SCENE_DIR = join(ROOT, 'src', 'ui', 'scene')
const TOKENS_PATH = join(ROOT, 'src', 'styles', 'tokens.css')

interface ManifestEntry {
  id: string
  source: string
  seed: number | null
  job?: string
  native: [number, number]
  colors?: number
  sheet?: { src: string }
}

function loadManifest(): ManifestEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]
}

function pngPathFor(id: string): string {
  return join(ART_DIR, `${id}.png`)
}

function rawPathFor(entry: ManifestEntry): string {
  const src = entry.sheet ? entry.sheet.src : entry.id
  return join(ROOT, 'art', 'raw', /\.(png|webp)$/.test(src) ? src : `${src}.webp`)
}

function listPngsUnder(dir: string, prefix = ''): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out = out.concat(listPngsUnder(full, prefix ? `${prefix}/${name}` : name))
    } else if (name.endsWith('.png')) {
      out.push(prefix ? `${prefix}/${name.replace(/\.png$/, '')}` : name.replace(/\.png$/, ''))
    }
  }
  return out
}

/** Minimal PNG parser: just enough to read IHDR (size, colour type) and PLTE (palette entries) without a library. */
function parsePng(path: string): {
  width: number
  height: number
  colorType: number
  palette: string[]
  bytes: number
} {
  // PLTE entries made fully transparent by tRNS are never drawn (the encoder picks their RGB freely), so they are
  // left out of the returned palette.
  const buf = readFileSync(path)
  const sig = buf.subarray(0, 8)
  const expectedSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!sig.equals(expectedSig)) throw new Error(`${path}: not a PNG`)

  let offset = 8
  let width = 0
  let height = 0
  let colorType = -1
  let palette: string[] = []
  const transparent = new Set<number>()

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart)
      height = buf.readUInt32BE(dataStart + 4)
      colorType = buf.readUInt8(dataStart + 9)
    } else if (type === 'PLTE') {
      palette = []
      for (let i = 0; i < length; i += 3) {
        const r = buf.readUInt8(dataStart + i)
        const g = buf.readUInt8(dataStart + i + 1)
        const b = buf.readUInt8(dataStart + i + 2)
        palette.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
      }
    } else if (type === 'tRNS' && colorType === 3) {
      for (let i = 0; i < length; i++) if (buf.readUInt8(dataStart + i) === 0) transparent.add(i)
    }
    offset = dataStart + length + 4 // skip data + CRC
    if (type === 'IEND') break
  }

  return { width, height, colorType, palette: palette.filter((_, i) => !transparent.has(i)), bytes: buf.length }
}

describe('art manifest', () => {
  const manifest = loadManifest()

  it('has unique ids', () => {
    const ids = manifest.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names its host: a Hugging Face Space with a seed, or a Higgsfield job id instead of a seed', () => {
    for (const entry of manifest) {
      if (entry.source === 'hf-space:mcp-tools/Z-Image-Turbo') {
        expect(typeof entry.seed, `${entry.id} seed`).toBe('number')
      } else {
        expect(entry.source, `${entry.id} source`).toBe('higgsfield:z_image')
        expect(entry.seed, `${entry.id} seed`).toBeNull()
        expect(entry.job, `${entry.id} job`).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
      }
    }
  })

  it('has a raw source and a generated PNG for every entry', () => {
    for (const entry of manifest) {
      expect(statSync(rawPathFor(entry)).isFile(), `raw source for ${entry.id}`).toBe(true)
      expect(statSync(pngPathFor(entry.id)).isFile(), `generated PNG for ${entry.id}`).toBe(true)
    }
  })

  it('has no orphan PNGs under src/assets/art', () => {
    const generated = new Set(manifest.map((e) => e.id))
    const onDisk = listPngsUnder(ART_DIR)
    for (const id of onDisk) {
      expect(generated.has(id), `orphan PNG: ${id}`).toBe(true)
    }
  })
})

describe('generated PNGs', () => {
  const manifest = loadManifest()
  const sceneText = readdirSync(SCENE_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(SCENE_DIR, f), 'utf8'))
    .join('\n')
  const tokensText = readFileSync(TOKENS_PATH, 'utf8')
  const allowedText = sceneText + '\n' + tokensText

  it('every ART_PALETTE colour appears literally in scene sources or tokens.css', () => {
    for (const hex of ART_PALETTE) {
      expect(allowedText.includes(hex), `${hex} missing from scene/*.ts or tokens.css`).toBe(true)
    }
  })

  it('IHDR size matches native, colour type is indexed (3), and every PLTE colour is in ART_PALETTE', () => {
    const palette = new Set(ART_PALETTE)
    for (const entry of manifest) {
      const png = parsePng(pngPathFor(entry.id))
      expect(png.width, `${entry.id} width`).toBe(entry.native[0])
      expect(png.height, `${entry.id} height`).toBe(entry.native[1])
      expect(png.colorType, `${entry.id} colour type`).toBe(3)
      expect(png.palette.length, `${entry.id} colour cap`).toBeLessThanOrEqual(entry.colors ?? 16)
      for (const hex of png.palette) {
        expect(palette.has(hex), `${entry.id}: PLTE colour ${hex} not in ART_PALETTE`).toBe(true)
      }
    }
  })

  it('stays within the byte-size caps: 16 KB for title/hero, 4 KB each other entry, 100 KB total', () => {
    let total = 0
    for (const entry of manifest) {
      const bytes = statSync(pngPathFor(entry.id)).size
      total += bytes
      const cap = entry.id === 'title/hero' ? 16 * 1024 : 4 * 1024
      expect(bytes, `${entry.id} size`).toBeLessThanOrEqual(cap)
    }
    expect(total).toBeLessThanOrEqual(100 * 1024)
  })
})
