// Checks the art pipeline's output on disk, without importing sharp or any browser API: manifest shape, that every
// entry has both a raw source and a generated PNG, no orphan PNGs, and that every PNG is a small indexed (colour
// type 3) image whose IHDR size matches its manifest `native` size and whose PLTE entries are all in its own entry's palette (base or scene).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ART_PALETTE, ART_PALETTE_BASE, ART_PALETTE_SCENE } from '../art/palette'
import * as registry from '../art/registry'
import type { ArtRef } from '../art/registry'
import { PROP_FOOTPRINT } from '../scene/render'
import { DESK_PROPS, PROP_MAX_W, PROP_MIN_H, PROP_SPRITE, fitDesk, fitSprite } from '../scene/sceneArt'
import type { ScenePropId } from '../scene/sceneArt'

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
  palette?: 'base' | 'scene'
  lightness?: number
  cutout: boolean
  outline: boolean
  crop?: [number, number, number, number]
  seam?: { src: number; dst: number }
  tolerance?: number
  holes?: [number, number][]
  flip?: boolean
  sheet?: { src: string }
}

/** A `kind: "sprite"` entry: a pose cell the `--sprite` mode turns into a string-map frame module, not a PNG. */
interface SpriteEntry {
  id: string
  kind: 'sprite'
  source: string
  seed: number | null
  job?: string
  sheet: { src: string }
  crop: [number, number, number, number]
  frame: [number, number]
  keys: string
  name: string
  graft?: string
  cells?: [number, number, string][]
}

function loadAll(): (ManifestEntry | SpriteEntry)[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as (ManifestEntry | SpriteEntry)[]
}

/** The image entries (every one a PNG under src/assets/art); the sprite entries are checked on their own. */
function loadManifest(): ManifestEntry[] {
  return loadAll().filter((e) => (e as SpriteEntry).kind !== 'sprite') as ManifestEntry[]
}

function loadSprites(): SpriteEntry[] {
  return loadAll().filter((e) => (e as SpriteEntry).kind === 'sprite') as SpriteEntry[]
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
    const ids = loadAll().map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names its host: a Hugging Face Space with a seed, or a Higgsfield job id instead of a seed', () => {
    for (const entry of loadAll()) {
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

  it("makes every tier's room shell a 320x180 scene-palette image of at most 32 colours, its seam landing on row 114", () => {
    const rooms = manifest.filter((e) => e.id.startsWith('room/'))
    expect(rooms.map((e) => e.id).sort()).toEqual(['room/apartment', 'room/flat', 'room/loft'])
    for (const e of rooms) {
      expect(e.native, e.id).toEqual([320, 180])
      expect(e.cutout, e.id).toBe(false)
      expect(e.palette, e.id).toBe('scene')
      expect(e.colors, e.id).toBe(32)
      expect(e.seam, `${e.id} seam`).toBeDefined()
      const { src, dst } = e.seam!
      expect(dst, `${e.id} seam dst`).toBe(114)
      // the first floor row, measured in the raw image (after its crop): a whole row that leaves wall above it
      const height = e.crop ? e.crop[3] : parsePng(rawPathFor(e)).height
      expect(Number.isInteger(src) && src > 0 && src < height, `${e.id} seam src ${src} of ${height}`).toBe(true)
      if (e.crop) {
        const raw = parsePng(rawPathFor(e))
        expect(e.crop[0] + e.crop[2] <= raw.width && e.crop[1] + e.crop[3] <= raw.height, `${e.id} crop`).toBe(true)
      }
    }
    // only a room shell is seam-remapped; a lightness weight, where set, is in (0, 1]
    for (const e of manifest) {
      if (!e.id.startsWith('room/')) expect(e.seam, `${e.id} seam`).toBeUndefined()
      if (e.lightness !== undefined) expect(e.lightness > 0 && e.lightness <= 1, `${e.id} lightness`).toBe(true)
    }
  })

  it("sizes every prop sprite by its footprint height (a desk by its width) and its crop's aspect (PROP_SPRITE), a 16-colour outlined cutout (the bookshelf 24)", () => {
    const props = manifest.filter((e) => e.id.startsWith('prop/'))
    expect(props.map((e) => e.id.slice(5)).sort()).toEqual(Object.keys(PROP_SPRITE).sort())
    for (const e of props) {
      const id = e.id.slice(5) as ScenePropId
      expect(e.cutout && e.outline, e.id).toBe(true)
      expect(e.palette, e.id).toBe('scene')
      // the bookshelf keeps 24 so its book spines keep their colours
      expect(e.colors, e.id).toBe(id === 'bookshelf' ? 24 : 16)
      expect(e.crop, `${e.id} crop`).toBeDefined()
      const [, , cw, ch] = e.crop!
      expect(e.native, e.id).toEqual([...PROP_SPRITE[id]])
      const desk = (DESK_PROPS as readonly ScenePropId[]).includes(id)
      const fit = desk ? fitDesk(cw / ch, PROP_FOOTPRINT[id]) : fitSprite(cw / ch, PROP_FOOTPRINT[id], PROP_MAX_W[id], PROP_MIN_H[id])
      expect(fit, e.id).toEqual([...PROP_SPRITE[id]])
      // the crop lies inside its sheet (all three 0.10.0 sheets and the 0.9.0 one are 2048x1152)
      const [cx, cy] = e.crop!
      expect(cx >= 0 && cy >= 0 && cx + cw <= 2048 && cy + ch <= 1152, `${e.id} crop`).toBe(true)
    }
    // the two cutout knobs: a raised flood tolerance (the wooden chair's grey floor shadow) and a mirror (the arm lamp
    // leans left over the page), each only where it is needed
    expect(manifest.filter((e) => e.tolerance !== undefined).map((e) => [e.id, e.tolerance])).toEqual([['prop/chair', 40]])
    expect(manifest.filter((e) => e.flip !== undefined).map((e) => [e.id, e.flip])).toEqual([['prop/arm-lamp', true]])
    // and a hole seed for background walled off inside an object (the chair's backrest opening), inside its crop
    expect(manifest.filter((e) => e.holes !== undefined).map((e) => [e.id, e.holes])).toEqual([['prop/chair', [[193, 254]]]])
    for (const e of manifest.filter((x) => x.holes)) {
      for (const [hx, hy] of e.holes!) expect(hx >= 0 && hy >= 0 && hx < e.crop![2] && hy < e.crop![3], e.id).toBe(true)
    }
  })

  it('turns each sprite entry into a generated frame module (the --sprite mode), from a committed raw sheet', () => {
    const sprites = loadSprites()
    expect(sprites.length).toBeGreaterThan(0)
    for (const e of sprites) {
      expect(e.id, e.id).toMatch(/^sprite\/[a-z0-9-]+$/)
      expect(statSync(join(ROOT, 'art', 'raw', e.sheet.src)).isFile(), `raw sheet for ${e.id}`).toBe(true)
      expect([[24, 32], [30, 14]], `${e.id} frame`).toContainEqual(e.frame)
      expect(e.keys, `${e.id} keys`).toMatch(/^[A-Za-z]+$/)
      expect(e.keys, `${e.id} keys has the outline`).toContain('L')
      expect([undefined, 'anchor-head'], `${e.id} graft`).toContain(e.graft)
      const [cx, cy, cw, ch] = e.crop
      expect(cx >= 0 && cy >= 0 && cx + cw <= 2048 && cy + ch <= 1152, `${e.id} crop`).toBe(true)
      const mod = readFileSync(join(SCENE_DIR, 'generated', `${e.id.slice(7)}.ts`), 'utf8')
      expect(mod, e.id).toContain(`npm run art -- ${e.id}`)
      expect(mod, e.id).toContain(`export const ${e.name}: string[] = [`)
      expect(mod.includes('graft: anchor-head'), `${e.id} records its graft`).toBe(e.graft === 'anchor-head')
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

  it('keeps ART_PALETTE lowercase #rrggbb with no duplicates', () => {
    for (const hex of ART_PALETTE) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(ART_PALETTE).size).toBe(ART_PALETTE.length)
  })

  it("holds the room shells' day colours (roomArt.ts, studioArt.ts), so a generated shell can match the drawn one", () => {
    // four of these were in the palette before 0.9.0 (#e0b25a, #a9a59c, #cbc7bf, #8aa0c8); the rest are the scene additions
    const ROOM_COLOURS = [
      // the apartment: sand plaster and its streaks, the wood molding, beam and pillars, the baseboard, the tatami
      '#e6d3a8', '#ecdcb6', '#9c7550', '#c9b48a', '#b88d62', '#7a5a3e', '#cdbd7c', '#bfae6c', '#3d4a3a', '#a8984f',
      // the flat: teal wallpaper and its stripes, the wainscot and its rail, the dark wood frame, honey planks, the rug
      '#8fb5ac', '#9dc2b9', '#8a5f3a', '#b98a5c', '#a0764c', '#6e4a2c', '#c8894e', '#a86d3a', '#b04a3f', '#e0b25a',
      // the loft: pale plaster and its molding, brick and mortar, the frame, the steel baseboard, concrete, the rug
      '#dcd8cf', '#a9a59c', '#b5574a', '#d9b7a5', '#6b4a32', '#4a4a55', '#bdb8ae', '#cbc7bf', '#a9a49a', '#3f4f7a',
      '#8aa0c8',
      // every room's switch and outlet; the woods of the window frame, the sill and the bookshelf
      '#f0ead6', '#b8b2a5', '#5a4634', '#4a3828', '#6d4c33', '#8b6543', '#5a3d28',
    ]
    for (const hex of ROOM_COLOURS) expect(ART_PALETTE, hex).toContain(hex)
  })

  it('freezes ART_PALETTE_BASE at its pre-0.9.0 73 colours, so every committed illustration regenerates byte for byte', () => {
    expect(ART_PALETTE_BASE).toHaveLength(73)
    const digest = createHash('sha256').update(ART_PALETTE_BASE.join(',')).digest('hex')
    expect(digest).toBe('8a855b3aa5618d958e01a44dba45b8856f89a6845e3dd236f39779866bd480e6')
    // the scene palette is the base, in order, then only new colours; ART_PALETTE is that union
    expect(ART_PALETTE_SCENE.slice(0, ART_PALETTE_BASE.length)).toEqual(ART_PALETTE_BASE)
    const base = new Set(ART_PALETTE_BASE)
    for (const hex of ART_PALETTE_SCENE.slice(ART_PALETTE_BASE.length)) expect(base.has(hex), hex).toBe(false)
    expect(ART_PALETTE).toEqual(ART_PALETTE_SCENE)
  })

  it('every ART_PALETTE colour appears literally in scene sources or tokens.css', () => {
    for (const hex of ART_PALETTE) {
      expect(allowedText.includes(hex), `${hex} missing from scene/*.ts or tokens.css`).toBe(true)
    }
  })

  it('IHDR size matches native, colour type is indexed (3), and every PLTE colour is in the entry palette', () => {
    for (const entry of manifest) {
      // an entry snaps to the frozen base unless it opts into the scene palette
      expect([undefined, 'base', 'scene'], `${entry.id} palette`).toContain(entry.palette)
      const palette = new Set(entry.palette === 'scene' ? ART_PALETTE_SCENE : ART_PALETTE_BASE)
      const png = parsePng(pngPathFor(entry.id))
      expect(png.width, `${entry.id} width`).toBe(entry.native[0])
      expect(png.height, `${entry.id} height`).toBe(entry.native[1])
      expect(png.colorType, `${entry.id} colour type`).toBe(3)
      expect(png.palette.length, `${entry.id} colour cap`).toBeLessThanOrEqual(entry.colors ?? 16)
      for (const hex of png.palette) {
        expect(palette.has(hex), `${entry.id}: PLTE colour ${hex} not in its ${entry.palette ?? 'base'} palette`).toBe(true)
      }
    }
  })

  it('stays within the byte-size caps: 16 KB for title/hero, 12 KB for a room/* shell, 4 KB each other entry, 160 KB total', () => {
    let total = 0
    for (const entry of manifest) {
      const bytes = statSync(pngPathFor(entry.id)).size
      total += bytes
      const cap = entry.id === 'title/hero' ? 16 * 1024 : entry.id.startsWith('room/') ? 12 * 1024 : 4 * 1024
      expect(bytes, `${entry.id} size`).toBeLessThanOrEqual(cap)
    }
    expect(total).toBeLessThanOrEqual(160 * 1024)
  })
  it("gives every registry ArtRef its manifest entry's native size", () => {
    const byId = new Map(loadManifest().map((e) => [e.id, e]))
    const refs: ArtRef[] = []
    const isRef = (v: unknown): v is ArtRef =>
      typeof v === 'object' && v !== null && typeof (v as ArtRef).id === 'string' && typeof (v as ArtRef).w === 'number'
    for (const value of Object.values(registry)) {
      if (isRef(value)) refs.push(value)
      else if (typeof value === 'object' && value !== null) refs.push(...Object.values(value).filter(isRef))
    }
    expect(refs.length).toBeGreaterThan(50)
    for (const ref of refs) {
      const entry = byId.get(ref.id)
      expect(entry, `${ref.id} has a manifest entry`).toBeDefined()
      expect([ref.w, ref.h], `${ref.id} size`).toEqual(entry!.native)
    }
  })
})
