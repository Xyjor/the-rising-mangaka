// Checks the art pipeline's output on disk, without importing sharp or any browser API: manifest shape, that every
// entry has both a raw source and a generated PNG, no orphan PNGs, and that every PNG is a small indexed (colour
// type 3) image whose IHDR size matches its manifest `native` size and whose PLTE entries are all in its own entry's palette (base or scene),
// and that each generated wall's plaster stays flat (its pixels decoded with node:zlib, the decoder itself checked on a
// synthetic image of every PNG filter type).
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'
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
  /** `code`: the scene draws this room's floor, so the image is the wall alone, the rows above the seam */
  floor?: 'code'
  /** a wall's plaster flattened to its modal colour within an OKLab radius, before the palette snap */
  flatten?: { radius: number }
  tolerance?: number
  holes?: [number, number][]
  flip?: boolean
  sheet?: { src: string }
}

/** A `kind: "sprite"` entry: a pose cell the `--sprite` mode turns into a string-map frame module, not a PNG. */
interface SpriteEntry {
  id: string
  kind: 'sprite'
  /** a candidate the scene does not draw: its recipe and raw sheet stay, no frame module is committed */
  retired?: boolean
  source: string
  seed: number | null
  job?: string
  sheet: { src: string }
  crop: [number, number, number, number]
  frame: [number, number]
  keys: string
  sample: string
  name: string
  graft?: string
  cells?: [number, number, string][]
  fit?: [number, number]
  remap?: { rows: [number, number]; from: string; to: string }[]
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

/**
 * Decodes an 8-bit indexed (colour type 3), non-interlaced PNG (its bytes; `path` names it in errors) to its pixels as
 * `#rrggbb`, row by row, without a library: the IDAT chunks inflated (`node:zlib`) and each scanline unfiltered (types
 * 0-4, one byte per pixel). Anything else (no PNG signature, another bit depth or colour type, interlacing, an unknown
 * filter) throws, since the room walls are all 8-bit indexed (`scripts/pixelate.ts` writes them with sharp's palette
 * encoder).
 */
function decodeIndexed(buf: Buffer, path: string): { width: number; height: number; at: (x: number, y: number) => string } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!buf.subarray(0, 8).equals(signature)) throw new Error(`${path}: not a PNG`)
  let offset = 8
  let width = 0
  let height = 0
  const palette: string[] = []
  const idat: Buffer[] = []
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const [depth, colorType, , , interlace] = data.subarray(8, 13)
      if (depth !== 8) throw new Error(`${path}: bit depth ${depth}, only 8 is decoded`)
      if (colorType !== 3) throw new Error(`${path}: colour type ${colorType}, only indexed (3) is decoded`)
      if (interlace !== 0) throw new Error(`${path}: interlaced, only non-interlaced is decoded`)
    } else if (type === 'PLTE') {
      for (let i = 0; i < length; i += 3) palette.push(`#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  if (raw.length !== height * (width + 1)) throw new Error(`${path}: ${raw.length} bytes inflated, ${height * (width + 1)} expected`)
  const px = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)]
    const line = raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1))
    for (let x = 0; x < width; x++) {
      const a = x > 0 ? px[y * width + x - 1] : 0
      const b = y > 0 ? px[(y - 1) * width + x] : 0
      const c = x > 0 && y > 0 ? px[(y - 1) * width + x - 1] : 0
      let predict: number
      if (filter === 0) predict = 0
      else if (filter === 1) predict = a
      else if (filter === 2) predict = b
      else if (filter === 3) predict = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
        predict = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else throw new Error(`${path}: row ${y} has filter type ${filter}`)
      px[y * width + x] = (line[x] + predict) & 0xff
    }
  }
  return {
    width,
    height,
    at: (x, y) => {
      const hex = palette[px[y * width + x]]
      if (!hex) throw new Error(`${path}: (${x}, ${y}) indexes past the palette`)
      return hex
    },
  }
}

describe('the indexed PNG decoder', () => {
  // A 6x5 indexed image, one scanline per filter type, its filtered bytes worked by hand from the PNG spec (each byte the
  // index less the filter's prediction, mod 256) rather than by an encoder that could share a mistake with the decoder.
  // The two room walls use filter 0 only, so this is the decoder's one meeting with types 1-4.
  const INDICES = [
    [3, 1, 4, 1, 5, 2],
    [5, 2, 6, 5, 3, 0],
    [3, 5, 0, 7, 1, 4],
    [4, 6, 1, 3, 4, 2],
    [2, 7, 5, 1, 5, 6],
  ]
  const SCANLINES = [
    [0, 3, 1, 4, 1, 5, 2], // 0 None: the indices as they are
    [1, 5, 253, 4, 255, 254, 253], // 1 Sub: less the pixel to the left
    [2, 254, 3, 250, 2, 254, 4], // 2 Up: less the pixel above
    [3, 3, 2, 254, 255, 2, 254], // 3 Average: less floor((left + above) / 2)
    // 4 Paeth: less the neighbour nearest left + above - upper left: above, upper left, above, left, left (tied with
    // the upper left, which left wins), above (tied with the upper left, which above wins)
    [4, 254, 3, 4, 252, 4, 4],
  ]
  const PALETTE = ['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  /** A chunk: its length, type and data, then a zero CRC (the decoder, like the art.test parser, never reads one). */
  function chunk(type: string, data: Buffer): Buffer {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    return Buffer.concat([head, data, Buffer.alloc(4)])
  }

  /** The image as an 8-bit indexed PNG, its deflated scanlines split over two IDAT chunks. */
  function syntheticPng(signature = SIGNATURE): Buffer {
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(6, 0)
    ihdr.writeUInt32BE(5, 4)
    ihdr.set([8, 3, 0, 0, 0], 8) // bit depth 8, colour type 3 (indexed), deflate, adaptive filtering, no interlace
    const plte = Buffer.from(PALETTE.flatMap((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))))
    const idat = deflateSync(Buffer.from(SCANLINES.flat()))
    const half = idat.length >> 1
    return Buffer.concat([
      Buffer.from(signature), chunk('IHDR', ihdr), chunk('PLTE', plte),
      chunk('IDAT', idat.subarray(0, half)), chunk('IDAT', idat.subarray(half)), chunk('IEND', Buffer.alloc(0)),
    ])
  }

  it('unfilters a scanline of each filter type (0-4) back to its indices', () => {
    const png = decodeIndexed(syntheticPng(), 'synthetic.png')
    expect([png.width, png.height]).toEqual([6, 5])
    const decoded = INDICES.map((row, y) => row.map((_, x) => png.at(x, y)))
    expect(decoded).toEqual(INDICES.map((row) => row.map((i) => PALETTE[i])))
  })

  it('refuses bytes without the PNG signature', () => {
    expect(() => decodeIndexed(syntheticPng(), 'synthetic.png')).not.toThrow()
    const wrong = [...SIGNATURE]
    wrong[1] = 0x51 // 'Q' for 'P'
    expect(() => decodeIndexed(syntheticPng(wrong), 'synthetic.png')).toThrow('synthetic.png: not a PNG')
  })
})

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

  it('gives the apartment and the loft a generated wall image, and the flat none: its wall is code-drawn (0.10.1)', () => {
    expect(manifest.filter((e) => e.id.startsWith('room/')).map((e) => e.id).sort()).toEqual(['room/apartment', 'room/loft'])
    // ROOM_ART lists every tier (a full record, so a new tier fails tsc until its wall is decided), the flat as null
    expect(Object.keys(registry.ROOM_ART).sort()).toEqual(['apartment', 'flat', 'loft'])
    expect(registry.ROOM_ART.flat).toBeNull()
    expect(registry.ROOM_ART.apartment?.id).toBe('room/apartment')
    expect(registry.ROOM_ART.loft?.id).toBe('room/loft')
    expect(existsSync(pngPathFor('room/flat')), 'src/assets/art/room/flat.png').toBe(false)
    expect(existsSync(join(ROOT, 'art', 'raw', 'rooms', 'flat.png')), 'art/raw/rooms/flat.png').toBe(false)
  })

  it("makes each generated room a 320x114 scene-palette wall of at most 32 colours, the raw's rows above its seam", () => {
    const rooms = manifest.filter((e) => e.id.startsWith('room/'))
    expect(rooms.length).toBeGreaterThan(0)
    for (const e of rooms) {
      // the scene draws every floor in code (TIER_FLOOR), so each room image is its wall, canvas rows 0-113
      expect(e.floor, `${e.id} floor`).toBe('code')
      expect(e.native, e.id).toEqual([320, 114])
      expect(e.seam?.dst, `${e.id} seam dst`).toBe(e.native[1])
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
    // only a room is seam-remapped or code-floored; a lightness weight, where set, is in (0, 1]; a flatten radius,
    // where set, is in (0, 1] and only on a code-floored wall
    for (const e of manifest) {
      if (!e.id.startsWith('room/')) expect(e.seam, `${e.id} seam`).toBeUndefined()
      if (!e.id.startsWith('room/')) expect(e.floor, `${e.id} floor`).toBeUndefined()
      if (e.lightness !== undefined) expect(e.lightness > 0 && e.lightness <= 1, `${e.id} lightness`).toBe(true)
      if (e.flatten !== undefined) {
        expect(e.flatten.radius > 0 && e.flatten.radius <= 1, `${e.id} flatten radius`).toBe(true)
        expect(e.floor, `${e.id} flatten needs floor "code"`).toBe('code')
      }
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
      expect([undefined, true], `${e.id} retired`).toContain(e.retired)
      // every recipe, retired or not, keeps its committed raw sheet with the crop inside it (IHDR)
      expect(statSync(join(ROOT, 'art', 'raw', e.sheet.src)).isFile(), `raw sheet for ${e.id}`).toBe(true)
      const [cx, cy, cw, ch] = e.crop
      const sheet = parsePng(join(ROOT, 'art', 'raw', e.sheet.src))
      expect(cx >= 0 && cy >= 0 && cx + cw <= sheet.width && cy + ch <= sheet.height, `${e.id} crop`).toBe(true)
      // a retired candidate (the readability gate lost it) has no module; `npm run art -- <id>` restores it
      if (e.retired) continue
      // a person 24x32, lying down 30x14, the cat 12x8 (task C2)
      expect([[24, 32], [30, 14], [12, 8]], `${e.id} frame`).toContainEqual(e.frame)
      const [fw, fh] = e.frame
      expect(e.keys, `${e.id} keys`).toMatch(/^[A-Za-z]+$/)
      expect(e.keys, `${e.id} keys has the outline`).toContain('L')
      expect([undefined, 'anchor-head'], `${e.id} graft`).toContain(e.graft)
      expect(['area', 'nearest'], `${e.id} sample`).toContain(e.sample)
      if (e.fit) {
        const [bw, bh] = e.fit
        expect(Number.isInteger(bw) && Number.isInteger(bh) && bw > 0 && bh > 0 && bw <= fw && bh <= fh, `${e.id} fit`).toBe(true)
      }
      for (const [r, c, k] of e.cells ?? []) {
        expect(e.keys.includes(k), `${e.id} cell [${r}, ${c}] key ${k}`).toBe(true)
        expect(r >= 0 && r < fh && c >= 0 && c < fw, `${e.id} cell [${r}, ${c}] inside the frame`).toBe(true)
      }
      for (const m of e.remap ?? []) expect(m.from.length, `${e.id} remap ${m.from} to ${m.to}`).toBe(m.to.length)
      const mod = readFileSync(join(SCENE_DIR, 'generated', `${e.id.slice(7)}.ts`), 'utf8')
      expect(mod, e.id).toContain(`npm run art -- ${e.id}`)
      expect(mod, e.id).toContain(`export const ${e.name}: string[] = [`)
      expect(mod.includes('graft: anchor-head'), `${e.id} records its graft`).toBe(e.graft === 'anchor-head')
      // hand-touched cells are disclosed in the module's header
      const touched = e.cells?.length ?? 0
      expect(mod.includes(`cells: ${touched} touched in the manifest`), `${e.id} discloses its cells`).toBe(touched > 0)
    }
  })

  it('remaps the doze\'s folded arms (rows 27-30) from the torso J to the sleeves j, as the mangaka\'s body (task B3)', () => {
    const doze = loadSprites().find((e) => e.id === 'sprite/assistant-doze')
    expect(doze?.remap).toEqual([{ rows: [27, 30], from: 'J', to: 'j' }])
    // and the generated module carries it: no J on those rows (the eight manifest cells touch none of them)
    const mod = readFileSync(join(SCENE_DIR, 'generated', 'assistant-doze.ts'), 'utf8')
    const rows = [...mod.matchAll(/^\s+'([.A-Za-z]{24})', \/\/ (\d+)$/gm)].map((m) => [Number(m[2]), m[1]] as const)
    expect(rows).toHaveLength(32)
    for (const [r, row] of rows) if (r >= 27 && r <= 30) expect(row, `row ${r}`).not.toContain('J')
    expect(rows.filter(([r]) => r >= 27 && r <= 30).some(([, row]) => row.includes('j'))).toBe(true)
  })

  it('has no generated frame module without a non-retired sprite entry', () => {
    const live = new Set(loadSprites().filter((e) => !e.retired).map((e) => `${e.id.slice(7)}.ts`))
    const onDisk = readdirSync(join(SCENE_DIR, 'generated')).filter((f) => f.endsWith('.ts'))
    for (const f of onDisk) expect(live.has(f), `orphan or retired frame module: generated/${f}`).toBe(true)
    // and the controller's ruling: only the assistants' doze is drawn from a generated frame
    expect(onDisk).toEqual(['assistant-doze.ts'])
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
      // the flat (code-drawn since 0.10.1): the teal stripes on the pale ground (#cbc7bf, below), the walnut wainscot and
      // its grooves, frame and baseboard (its rail is the bookshelf's #5a3d28, below), honey planks, the rug
      '#6f9a90', '#8a5f3a', '#6e4a2c', '#c8894e', '#a86d3a', '#b04a3f', '#e0b25a',
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

  it("keeps each generated wall's plaster flat: at most 2 colours in a box well inside it", () => {
    // Boxes in output pixels, inclusive, read off the committed PNGs (row by row and column by column): the apartment's
    // plaster is #e6d3a8 alone over x 3-316, rows 10-111 (the beam above row 10, the pillars' 3 px at each edge, the
    // baseboard from row 112), so its box keeps 4-5 px clear of each; the loft's is #f5f1c9 alone over rows 12-106 (the
    // steel beam above, the baseboard from row 107) on both sides of the brick column (x 229-253, its mortar edge and
    // pink highlight included), so it has a box each side of the column, 4 px clear of everything.
    const BOXES: Record<string, [x0: number, x1: number, y0: number, y1: number][]> = {
      'room/apartment': [[8, 311, 14, 107]],
      'room/loft': [[4, 224, 16, 102], [258, 315, 16, 102]],
    }
    expect(Object.keys(BOXES).sort()).toEqual(manifest.filter((e) => e.id.startsWith('room/')).map((e) => e.id).sort())
    for (const [id, boxes] of Object.entries(BOXES)) {
      const png = decodeIndexed(readFileSync(pngPathFor(id)), pngPathFor(id))
      expect([png.width, png.height], id).toEqual([320, 114])
      const colours = new Set<string>()
      for (const [x0, x1, y0, y1] of boxes) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) colours.add(png.at(x, y))
      }
      expect(colours.size, `${id}: ${[...colours].join(', ')}`).toBeLessThanOrEqual(2)
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
