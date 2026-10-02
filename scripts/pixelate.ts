// The art pipeline's IO layer: reads a manifest entry's raw source, runs it through the pure pixel operations in
// src/ui/art/pixelOps.ts, and writes an indexed PNG under src/assets/art/<id>.png, or, for a `kind: "sprite"` entry,
// a string-map frame module under src/ui/scene/generated/<name>.ts (the `--sprite` mode). Run with:
//   npm run art -- title/hero
//   npm run art -- --all
// `--all` skips a `retired: true` sprite entry (a candidate the readability gate lost: its recipe and raw sheet stay
// committed, its frame module does not); naming a retired id regenerates its module (to restore or re-inspect it).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { ART_PALETTE_BASE, ART_PALETTE_SCENE } from '../src/ui/art/palette'
import {
  addOutline,
  anchoredPalette,
  placeInFrame,
  alphaBoundingBox,
  closeOutline,
  despeckleGrid,
  graftRows,
  outlineToL,
  padBottomCentred,
  remapRows,
  runCount,
  setCells,
  snapToKeys,
  spriteModule,
  despeckle,
  downsampleArea,
  downsampleNearest,
  findBlobs,
  flipHorizontal,
  floodTransparentFromEdges,
  padToAspect,
  reduceColors,
  remapSeam,
  snapToPalette,
  wallOnly,
  type RgbaImage,
} from '../src/ui/art/pixelOps'
import { ANCHOR_HEAD, PAL, faceRules, frameRules } from '../src/ui/scene/spriteCore'

const ROOT = join(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'art', 'manifest.json')
const OUTLINE_HEX = '#1c1a26'
const FLOOD_TOLERANCE = 24
const DEFAULT_COLORS = 16

interface SheetSpec {
  src: string
  /** An equal grid over the sheet; omit all three to take the whole sheet (then `crop` picks the object). */
  cols?: number
  rows?: number
  cell?: [number, number]
}

interface ManifestEntry {
  id: string
  /** where it was generated: `hf-space:mcp-tools/Z-Image-Turbo` or `higgsfield:z_image` */
  source: string
  model: string
  resolution: string
  /** null for a Higgsfield generation (no seed exposed; `job` identifies it instead) */
  seed: number | null
  job?: string
  steps: number
  shift: number
  prompt: string
  preamble: 'scene' | 'cutout' | 'none'
  native: [number, number]
  sample: 'area' | 'nearest'
  cutout: boolean
  outline: boolean
  colors?: number
  /** which palette to snap to: `base` (the default, frozen, every pre-0.9.0 asset) or `scene` (base plus the room colours) */
  palette?: 'base' | 'scene'
  /**
   * The palette snap's OKLab lightness weight (pixelOps `nearestPaletteIndex`), 1 when absent: below 1 a shaded wall
   * keeps its hue (the flat's teal stays teal) and its lighting flattens to fewer steps, as cel-shaded pixel art does.
   */
  lightness?: number
  crop?: [number, number, number, number]
  /**
   * A room shell's wall/floor seam: `src` is the first floor row of the raw image (after `crop`), `dst` the canvas row
   * it must land on (114). The wall and the floor are then resampled separately (pixelOps `remapSeam`); not for a
   * cutout.
   */
  seam?: { src: number; dst: number }
  /**
   * `code`: the scene draws this room's floor (roomArt.ts `TIER_FLOOR`), so the image is the wall alone, the raw rows
   * above `seam.src` resampled to `native` (pixelOps `wallOnly`), whose height must be `seam.dst`.
   */
  floor?: 'code'
  /**
   * The cutout's flood tolerance (RGB distance from the corner colour), FLOOD_TOLERANCE when absent: raised where the
   * sheet drew a soft grey shadow under an object that the default leaves behind.
   */
  tolerance?: number
  /**
   * Seed points [x, y] (in the crop, after the flip if any) for background the cutout's edge flood cannot reach: an opening
   * walled off inside the object, cleared to transparent with the same tolerance.
   */
  holes?: [number, number][]
  /** Mirror the crop left to right before anything else (an object the sheet drew facing the wrong way for its spot). */
  flip?: boolean
  sheet?: SheetSpec
}

/**
 * A `kind: "sprite"` entry (the `--sprite` mode, 0.11.0): one pose cell of a character sheet turned into a string-map
 * frame in PAL keys, written to src/ui/scene/generated/<id without "sprite/">.ts as `export const <name>`.
 */
interface SpriteEntry {
  id: string
  kind: 'sprite'
  /**
   * A candidate the scene does not draw (0.11.0's readability gate): `--all` skips it and no frame module is
   * committed for it, while its recipe and raw sheet stay. Naming its id regenerates the module.
   */
  retired?: boolean
  source: string
  model: string
  seed: number | null
  job?: string
  prompt: string
  sheet: { src: string }
  /** the pose's box on the sheet ([x, y, w, h], from `--measure`) */
  crop: [number, number, number, number]
  /** the frame's size: [24, 32] for a person, [30, 14] lying down */
  frame: [number, number]
  /** the PAL keys the snap may use, in priority order (the first listed wins a duplicate hex) */
  keys: string
  sample: 'area' | 'nearest'
  /** the exported constant's name */
  name: string
  tolerance?: number
  /** key swaps on a row range, after the snap: the sheet draws the trousers in the hair's colour */
  remap?: { rows: [number, number]; from: string; to: string }[]
  /** `anchor-head`: rows 0-15 replaced by the hand-drawn anchor head (ANCHOR_HEAD), for a frame that fails faceRules */
  graft?: 'anchor-head'
  /** touched cells [row, col, key], set after the outline and the graft (an eye the downsample lost) */
  cells?: [number, number, string][]
  /** a frame that never takes the FACES overlay (walking, panic, lying): faceRules is not reported for it */
  faceless?: boolean
  /**
   * The sheet colour each key stands for (0.11.0 C2, pixelOps `anchoredPalette`): the snap compares against these
   * instead of PAL's own colours for the listed keys (the sheet's light grey hoodie is J, its navy hair H).
   */
  anchors?: Record<string, string>
  /**
   * The box [w, h] the cutout is fitted to (aspect kept, unless `stretch`) instead of the whole frame, then placed on
   * the frame's last rows, centred (pixelOps `placeInFrame`): a body cropped below the sheet's head, fitted to rows
   * 16-31 under the anchor head graft, or a pose drawn smaller than the frame.
   */
  fit?: [number, number]
  /** Resample the cutout to the `fit` box exactly, without keeping its aspect (a sheet body narrower than the anchor's). */
  stretch?: boolean
  /** Mirror the crop left to right first (a sheet that drew the pose facing right; frames face left). */
  flip?: boolean
}

/** A raw source path: `name` as given when it carries an extension (the Higgsfield sheets are .png), else `.webp`. */
function rawPath(name: string): string {
  return join(ROOT, 'art', 'raw', /\.(png|webp)$/.test(name) ? name : `${name}.webp`)
}

type AnyEntry = ManifestEntry | SpriteEntry

function loadManifest(): AnyEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as AnyEntry[]
}

const isSprite = (e: AnyEntry): e is SpriteEntry => (e as SpriteEntry).kind === 'sprite'

/** A person's frame (24x32) that takes the FACES overlay: the only kind faceRules is reported for. */
const facedPerson = (e: SpriteEntry) => e.frame[0] === 24 && e.frame[1] === 32 && !e.faceless

async function loadRgba(path: string): Promise<RgbaImage> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}

/** Slices one region out of a larger RGBA image (used for both `crop` and a sheet cell). */
function sliceRegion(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) {
    const srcOffset = ((y + row) * img.width + x) * 4
    const dstOffset = row * w * 4
    out.set(img.data.subarray(srcOffset, srcOffset + w * 4), dstOffset)
  }
  return { width: w, height: h, data: out }
}

async function processEntry(entry: ManifestEntry): Promise<{ outPath: string; colours: number; bytes: number }> {
  let raw: RgbaImage
  if (entry.sheet) {
    const sheetPath = rawPath(entry.sheet.src)
    const sheetImg = await loadRgba(sheetPath)
    const { cols = 1, rows = 1, cell = [0, 0] } = entry.sheet
    const cellW = Math.floor(sheetImg.width / cols)
    const cellH = Math.floor(sheetImg.height / rows)
    raw = sliceRegion(sheetImg, cell[0] * cellW, cell[1] * cellH, cellW, cellH)
  } else {
    raw = await loadRgba(rawPath(entry.id))
  }

  let working = raw
  if (entry.crop) {
    const [cx, cy, cw, ch] = entry.crop
    working = sliceRegion(working, cx, cy, cw, ch)
  }
  if (entry.flip) working = flipHorizontal(working)

  if (entry.cutout) {
    working = floodTransparentFromEdges(working, entry.tolerance ?? FLOOD_TOLERANCE, entry.holes)
    const bbox = alphaBoundingBox(working)
    if (bbox) {
      const [targetW, targetH] = entry.native
      const padded = padToAspect(bbox, targetW, targetH, working.width, working.height)
      working = sliceRegion(working, padded.x, padded.y, padded.width, padded.height)
    }
  }

  const [nativeW, nativeH] = entry.native
  if (entry.floor === 'code') {
    if (!entry.seam) throw new Error(`${entry.id}: floor "code" needs a seam`)
    if (nativeH !== entry.seam.dst) {
      throw new Error(`${entry.id}: floor "code" keeps the wall only, so native height ${nativeH} must be seam.dst ${entry.seam.dst}`)
    }
  }
  if (entry.seam) {
    if (entry.cutout) throw new Error(`${entry.id}: a seam remap is for a room shell, not a cutout`)
    working = entry.floor === 'code'
      ? wallOnly(working, entry.seam.src, nativeW, nativeH, entry.sample)
      : remapSeam(working, entry.seam.src, nativeW, nativeH, entry.seam.dst, entry.sample)
  } else {
    working =
      entry.sample === 'nearest'
        ? downsampleNearest(working, nativeW, nativeH)
        : downsampleArea(working, nativeW, nativeH)
  }
  const palette = entry.palette === 'scene' ? ART_PALETTE_SCENE : ART_PALETTE_BASE
  working = snapToPalette(working, palette, entry.lightness ?? 1)
  // The outline colour counts toward the cap, so leave it a slot.
  working = reduceColors(working, (entry.colors ?? DEFAULT_COLORS) - (entry.outline ? 1 : 0), entry.lightness ?? 1)
  working = despeckle(working)
  if (entry.outline) {
    working = addOutline(working, OUTLINE_HEX)
  }

  const outPath = join(ROOT, 'src', 'assets', 'art', `${entry.id}.png`)
  mkdirSync(dirname(outPath), { recursive: true })

  // One more slot than the colour cap for the transparent entry, so the encoder never re-quantises opaque colours.
  const paletteCount = Math.min(256, (entry.colors ?? DEFAULT_COLORS) + (entry.cutout ? 1 : 0))
  const buffer = await sharp(Buffer.from(working.data.buffer, working.data.byteOffset, working.data.length), {
    raw: { width: working.width, height: working.height, channels: 4 },
  })
    .png({ palette: true, colours: paletteCount, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer()

  const fs = await import('node:fs/promises')
  await fs.writeFile(outPath, buffer)

  // Re-read and verify every pixel colour is in the entry's palette.
  const { data: verifyData } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const paletteSet = new Set(palette)
  const usedColours = new Set<string>()
  for (let i = 0; i < verifyData.length; i += 4) {
    if (verifyData[i + 3] === 0) continue
    const hex = `#${[verifyData[i], verifyData[i + 1], verifyData[i + 2]]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`
    usedColours.add(hex)
    if (!paletteSet.has(hex)) {
      throw new Error(`${entry.id}: pixel colour ${hex} is not in its ${entry.palette ?? 'base'} palette`)
    }
  }

  return { outPath, colours: usedColours.size, bytes: buffer.length }
}

/** The `--sprite` mode's pure steps on an already cropped cell: the frame rows, and what faceRules said before a graft. */
function spriteFrame(cell: RgbaImage, entry: SpriteEntry): { rows: string[]; faceBefore: string[] } {
  const [fw, fh] = entry.frame
  const [bw, bh] = entry.fit ?? entry.frame
  let working = floodTransparentFromEdges(entry.flip ? flipHorizontal(cell) : cell, entry.tolerance ?? FLOOD_TOLERANCE)
  const bbox = alphaBoundingBox(working)
  if (!bbox) throw new Error(`${entry.id}: the cutout is empty`)
  working = sliceRegion(working, bbox.x, bbox.y, bbox.width, bbox.height)
  if (!entry.stretch) working = padBottomCentred(working, bw, bh)
  working = entry.sample === 'nearest' ? downsampleNearest(working, bw, bh) : downsampleArea(working, bw, bh)
  let rows = snapToKeys(working, entry.keys, anchoredPalette(PAL, entry.keys, entry.anchors))
  if (entry.fit) rows = placeInFrame(rows, fw, fh)
  for (const m of entry.remap ?? []) rows = remapRows(rows, m.rows, m.from, m.to)
  rows = closeOutline(outlineToL(despeckleGrid(rows)))
  const faceBefore = facedPerson(entry) ? faceRules(rows) : []
  if (entry.graft === 'anchor-head') rows = closeOutline(graftRows(rows, ANCHOR_HEAD))
  if (entry.cells) rows = setCells(rows, entry.cells)
  return { rows, faceBefore }
}

async function processSprite(entry: SpriteEntry): Promise<{ outPath: string; runs: number; notes: string[] }> {
  const sheet = await loadRgba(rawPath(entry.sheet.src))
  const [cx, cy, cw, ch] = entry.crop
  const { rows, faceBefore } = spriteFrame(sliceRegion(sheet, cx, cy, cw, ch), entry)
  const [fw, fh] = entry.frame
  const broken = frameRules(rows, fw, fh)
  if (broken.length) throw new Error(`${entry.id} breaks frameRules:\n  ${broken.join('\n  ')}\n${rows.join('\n')}`)
  const notes: string[] = []
  if (entry.fit) notes.push(`fit: the cutout ${entry.stretch ? 'stretched' : 'fitted'} to ${entry.fit[0]}x${entry.fit[1]} on the frame's last rows`)
  if (entry.flip) notes.push('flip: the sheet drew the pose facing right')
  if (entry.graft) notes.push(`graft: ${entry.graft} (rows 0-15 are ANCHOR_HEAD; faceRules failed ${faceBefore.length} cells before it)`)
  if (entry.cells?.length) notes.push(`cells: ${entry.cells.length} touched in the manifest (art/manifest.json)`)
  const faceAfter = facedPerson(entry) ? faceRules(rows) : []
  if (faceAfter.length) console.warn(`${entry.id}: faceRules: ${faceAfter.length} failures, e.g. ${faceAfter.slice(0, 3).join('; ')}`)
  const outPath = join(ROOT, 'src', 'ui', 'scene', 'generated', `${entry.id.replace(/^sprite\//, '')}.ts`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, spriteModule(entry.id, entry.name, rows, notes))
  return { outPath, runs: runCount(rows), notes }
}

/** `--measure <sheet> [mergeGap] [minArea]`: prints each object's bounding box on a raw sheet, for committing as crops. */
async function measure(sheet: string, mergeGap: number, minArea: number) {
  const img = await loadRgba(rawPath(sheet))
  const boxes = findBlobs(img, { tolerance: FLOOD_TOLERANCE, mergeGap, minArea })
  console.log(`${sheet} (${img.width}x${img.height}): ${boxes.length} objects`)
  for (const b of boxes) console.log(JSON.stringify([b.x, b.y, b.width, b.height]))
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--measure') {
    await measure(args[1], Number(args[2] ?? 12), Number(args[3] ?? 400))
    return
  }
  const manifest = loadManifest()
  const ids = args.includes('--all')
    ? manifest.filter((e) => !(isSprite(e) && e.retired)).map((e) => e.id)
    : args.filter((a) => !a.startsWith('--'))

  if (ids.length === 0) {
    console.error('Usage: npm run art -- <id> [<id> ...] | npm run art -- --all')
    console.error(`Known ids: ${manifest.map((e) => e.id).join(', ')}`)
    process.exit(1)
  }

  for (const id of ids) {
    const entry = manifest.find((e) => e.id === id)
    if (!entry) {
      console.error(`Unknown art id: ${id}`)
      process.exit(1)
    }
    if (isSprite(entry)) {
      if (entry.retired) console.log(`${id}: retired (the scene does not draw it; --all skips it), regenerating as asked`)
      const { outPath, runs } = await processSprite(entry)
      console.log(`${id}: ${outPath} (${runs} fills)`)
      continue
    }
    const { outPath, colours, bytes } = await processEntry(entry)
    console.log(`${id}: ${outPath} (${bytes} bytes, ${colours} colours)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
